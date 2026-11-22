// Runs automatic answers for ONE tenant. Database client, Zernio client and the sender check are injected.
//
// Exactly-once: a decision row (unique per customer turn) is inserted BEFORE anything external happens; a duplicate run
// hits the unique key and skips. The send itself is: prepare (database re-verifies everything) -> atomic claim -> ONE
// dispatch attempt -> finalize. An ambiguous delivery is 'unknown' and is never retried. Three consecutive provider
// failures pause the tenant (the database trigger then demotes every automatic topic).
import {listTopics, toEngine, loadKnowledge} from './topic-store.mjs';
import {assignTopic} from './topic-discovery.mjs';
import {topicConfidence} from './topic-confidence.mjs';
import {decideAutoAnswer} from './auto-answer.mjs';
import {dispatchClaimed} from './outbox-dispatch.mjs';

const HOUR = 3600000, WINDOW = 23 * HOUR;
const COUNTED = ['queued', 'sent', 'unknown', 'rejected'];
const DB_CODES = ['crm_access_denied', 'tenant_automatic_replies_disabled', 'topic_not_automatic', 'answer_not_approved_verbatim', 'hourly_cap_reached',
  'customer_daily_cap_reached', 'contact_forbidden', 'conversation_stale_or_locked', 'reply_window_closed', 'newer_business_reply_exists',
  'channel_identity_not_verified', 'trusted_conversation_missing', 'turn_already_has_send', 'auto_answer_not_sendable', 'channel_not_enabled', 'missing_inbound_anchor', 'review_not_found'];
const safeCode = error => { const m = String(error?.message || ''); return (DB_CODES.find(c => m.includes(c)) || 'prepare_failed').toUpperCase(); };

// The customer's current turn: consecutive inbound messages since the business last spoke. Risk is judged on ALL of them.
async function currentTurn(db, tenantId, customerId) {
  const {data} = await db.from('crm_interactions').select('direction,kind,body,occurred_at')
    .eq('tenant_id', tenantId).eq('customer_id', customerId).eq('channel', 'instagram').eq('kind', 'message').order('occurred_at', {ascending: false}).limit(12);
  const rows = data || [];
  if (!rows.length || rows[0].direction !== 'inbound') return {text: '', answered: true};
  const turn = [];
  for (const r of rows) { if (r.direction !== 'inbound') break; turn.unshift(String(r.body || '').trim()); }
  return {text: turn.filter(Boolean).join(' ').slice(0, 600), answered: false};
}

// field_key -> {verified}: verified only when the customer's value is CONFIRMED (never merely proposed or asked).
async function verifiedFields(db, tenantId, customerId, keys) {
  if (!keys.length) return {};
  const {data: defs} = await db.from('crm_field_definitions').select('id,key').eq('tenant_id', tenantId).eq('enabled', true).in('key', keys);
  const ids = (defs || []).map(d => d.id);
  const {data: states} = ids.length ? await db.from('crm_information_states').select('field_id,status').eq('tenant_id', tenantId).eq('customer_id', customerId).in('field_id', ids) : {data: []};
  const confirmed = new Set((states || []).filter(s => s.status === 'confirmed').map(s => s.field_id));
  return Object.fromEntries(keys.map(key => [key, {verified: (defs || []).some(d => d.key === key && confirmed.has(d.id))}]));
}

async function settle(db, tenantId, id, status, reasons) {
  const patch = {status, ...(reasons ? {reasons: reasons.slice(0, 20).map(r => String(r).slice(0, 80))} : {})};
  await db.from('sima_auto_answers').update(patch).eq('tenant_id', tenantId).eq('id', id);
}

async function sendDecision({db, tenantId, id, accountId, request, verifySender}) {
  if (!(await verifySender(tenantId, accountId))) { await settle(db, tenantId, id, 'failed', ['SENDER_NOT_CONNECTED']); return 'failed'; }
  const prepared = await db.rpc('sima_prepare_auto_send', {p_auto_answer_id: id});
  if (prepared.error || !prepared.data?.outbox_id) { await settle(db, tenantId, id, 'failed', [safeCode(prepared.error)]); return 'failed'; }
  const outboxId = prepared.data.outbox_id;
  const claimed = await db.rpc('sima_claim_auto_send', {p_outbox_id: outboxId});
  if (claimed.error || !claimed.data) { await settle(db, tenantId, id, 'failed', ['CLAIM_REFUSED']); return 'failed'; }
  const result = await dispatchClaimed(request, claimed.data, outboxId);   // the one and only attempt
  const finished = await db.rpc('sima_finalize_human_send', {p_outbox_id: outboxId, p_status: result.status, p_message_id: result.providerMessageId, p_error_code: result.errorCode});
  const actual = finished.error ? 'unknown' : (finished.data?.status || 'unknown');
  const status = actual === 'accepted' ? 'sent' : actual === 'rejected' ? 'rejected' : 'unknown';
  await settle(db, tenantId, id, status, status === 'sent' ? null : [`PROVIDER_${(result.errorCode || actual).toUpperCase()}`]);
  return status;
}

// Three provider-side failures in a row: stop automatic replies for this tenant until the owner looks.
async function circuitOpen(db, tenantId) {
  const {data} = await db.from('sima_auto_answers').select('status,mode,created_at').eq('tenant_id', tenantId).eq('mode', 'live').order('created_at', {ascending: false}).limit(3);
  const recent = (data || []).filter(r => r.status !== 'queued');
  return recent.length === 3 && recent.every(r => r.status === 'rejected' || r.status === 'unknown');
}

export async function runAutoAnswers({db, tenantId, mode, now = Date.now(), limit = 10, verifySender, request}) {
  const summary = {tenantId, mode, examined: 0, blocked: 0, dryRun: 0, sent: 0, rejected: 0, unknown: 0, failed: 0, skipped: null, paused: false};
  if (mode !== 'dry_run' && mode !== 'live') { summary.skipped = 'mode_off'; return summary; }
  const {data: settings} = await db.from('sima_autonomy_settings').select('auto_enabled,paused_at,auto_hourly_cap,auto_customer_daily_cap').eq('tenant_id', tenantId).maybeSingle();
  if (!settings?.auto_enabled || settings.paused_at) { summary.skipped = 'tenant_off'; return summary; }
  const tenant = {autoEnabled: true, paused: false, hourlyCap: settings.auto_hourly_cap ?? 20, customerDailyCap: settings.auto_customer_daily_cap ?? 3};

  const listed = await listTopics(db, tenantId);
  if (!listed.ok) { summary.skipped = 'topics_unavailable'; return summary; }
  const topics = listed.topics.filter(t => t.status === 'active' && t.stage === 'auto' && !t.never_auto && Array.isArray(t.profile) && t.profile.length).map(toEngine);
  if (!topics.length) { summary.skipped = 'no_automatic_topics'; return summary; }
  const knowledge = await loadKnowledge(db, tenantId);
  if (!knowledge.ok) { summary.skipped = 'knowledge_unavailable'; return summary; }

  const {data: cases} = await db.from('sima_human_review_cases').select('id,customer_id,account_id,channel,last_occurred_at,state,conversation_version')
    .eq('tenant_id', tenantId).eq('state', 'awaiting_human').eq('channel', 'instagram').order('last_occurred_at', {ascending: true}).limit(200);
  const open = (cases || []).filter(c => { const t = Date.parse(c.last_occurred_at); return Number.isFinite(t) && now - t < WINDOW && t - now <= 5 * 60000; });
  if (!open.length) return summary;
  const [{data: decidedRows}, {data: outcomeRows}, {data: recentRows}] = await Promise.all([
    db.from('sima_auto_answers').select('review_id,conversation_version').eq('tenant_id', tenantId).in('review_id', open.map(c => c.id)),
    db.from('sima_topic_outcomes').select('topic_id,outcome,source,created_at').eq('tenant_id', tenantId).in('topic_id', topics.map(t => t.id)).limit(20000),
    db.from('sima_auto_answers').select('customer_id,status,mode,created_at').eq('tenant_id', tenantId).limit(2000)]);
  const decided = new Set((decidedRows || []).map(d => `${d.review_id}:${d.conversation_version}`));
  const outcomes = new Map();
  for (const o of outcomeRows || []) (outcomes.get(o.topic_id) || outcomes.set(o.topic_id, []).get(o.topic_id)).push({outcome: o.outcome, source: o.source, at: o.created_at});
  const live = (recentRows || []).filter(r => r.mode === 'live' && COUNTED.includes(r.status));
  const tenantHour = {n: live.filter(r => now - Date.parse(r.created_at) < HOUR).length};
  const byCustomer = new Map();
  for (const r of live.filter(r => now - Date.parse(r.created_at) < 24 * HOUR)) byCustomer.set(r.customer_id, (byCustomer.get(r.customer_id) || 0) + 1);

  let processed = 0;
  for (const c of open) {
    if (processed >= limit) break;
    if (decided.has(`${c.id}:${c.conversation_version}`)) continue;
    const turn = await currentTurn(db, tenantId, c.customer_id);
    if (!turn.text || turn.answered) continue;
    const hit = assignTopic(turn.text, topics);
    if (!hit) continue;   // not about any automatic topic: a human handles it, nothing to audit
    processed += 1; summary.examined += 1;
    const topic = hit.topic;
    const [{data: customer}, fields, {data: pending}] = await Promise.all([
      db.from('crm_customers').select('do_not_contact').eq('tenant_id', tenantId).eq('id', c.customer_id).maybeSingle(),
      verifiedFields(db, tenantId, c.customer_id, topic.requiredFields),
      db.from('sima_message_outbox').select('id').eq('tenant_id', tenantId).eq('review_id', c.id).eq('conversation_version', c.conversation_version).limit(1)]);
    const confidence = topicConfidence(outcomes.get(topic.id) || [], {now});
    const decision = decideAutoAnswer({mode, tenant, topic, confidence, fields, turnText: turn.text, customer: {doNotContact: Boolean(customer?.do_not_contact)},
      window: {open: true}, thread: {pendingSend: (pending || []).length > 0}, knowledge: knowledge.rows,
      counts: {tenantLastHour: tenantHour.n, customerLast24h: byCustomer.get(c.customer_id) || 0}});
    const status = decision.action === 'send' ? 'queued' : decision.action === 'dry_run' ? 'dry_run' : 'blocked';
    const {data: row, error} = await db.from('sima_auto_answers').insert({
      tenant_id: tenantId, review_id: c.id, customer_id: c.customer_id, topic_id: topic.id, conversation_version: c.conversation_version, mode, status,
      reasons: (decision.reasons || []).slice(0, 20).map(r => String(r).slice(0, 80)),
      ...(decision.answer ? {answer_text: decision.answer, knowledge_entry_id: decision.entry.id, knowledge_revision: decision.entry.revision} : {}),
      confidence_lower_bound: confidence.status === 'measured' ? confidence.lowerBound : null, threshold: topic.threshold}).select('id').maybeSingle();
    if (error) continue;   // 23505: another run already decided this turn
    if (status === 'blocked') { summary.blocked += 1; continue; }
    if (status === 'dry_run') { summary.dryRun += 1; continue; }
    tenantHour.n += 1; byCustomer.set(c.customer_id, (byCustomer.get(c.customer_id) || 0) + 1);
    const result = await sendDecision({db, tenantId, id: row.id, accountId: c.account_id, request, verifySender});
    summary[result] += 1;
    if (await circuitOpen(db, tenantId)) {
      await db.from('sima_autonomy_settings').update({paused_at: new Date(now).toISOString()}).eq('tenant_id', tenantId);
      summary.paused = true;
      break;
    }
  }
  return summary;
}

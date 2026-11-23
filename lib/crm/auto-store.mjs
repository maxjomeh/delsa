// Owner-facing control of automatic replies for ONE tenant: the master switch, the kill switch, caps, the decision log,
// and "this answer was wrong". Database client injected; every query is scoped to the tenant. Never sends anything.
import {listTopics, loadKnowledge, loadAutonomy, evaluateTopic} from './topic-store.mjs';
import {nextThreshold} from './topic-confidence.mjs';

const fail = code => ({ok: false, error: code});
const LOG_COLUMNS = 'id,review_id,topic_id,status,mode,reasons,answer_text,confidence_lower_bound,threshold,wrong_marked_at,created_at';

export async function autoOverview(db, tenantId, {now = Date.now()} = {}) {
  const {data: settings, error} = await db.from('sima_autonomy_settings').select('auto_enabled,paused_at,auto_hourly_cap,auto_customer_daily_cap,default_floor').eq('tenant_id', tenantId).maybeSingle();
  if (error) return fail('auto_unavailable');
  const {data: log, error: logError} = await db.from('sima_auto_answers').select(LOG_COLUMNS).eq('tenant_id', tenantId).order('created_at', {ascending: false}).limit(25);
  if (logError) return fail('auto_unavailable');
  const topics = await listTopics(db, tenantId);
  const labels = new Map((topics.topics || []).map(t => [t.id, t.label]));
  const since = now - 24 * 3600000;
  const {data: recent} = await db.from('sima_auto_answers').select('status,created_at').eq('tenant_id', tenantId).limit(2000);
  const counts = {};
  for (const r of recent || []) if (Date.parse(r.created_at) >= since) counts[r.status] = (counts[r.status] || 0) + 1;
  return {ok: true, enabled: Boolean(settings?.auto_enabled), paused: Boolean(settings?.paused_at), pausedAt: settings?.paused_at || null,
    caps: {hourly: settings?.auto_hourly_cap ?? 20, customerDaily: settings?.auto_customer_daily_cap ?? 3}, floor: Number(settings?.default_floor ?? 0.9),
    counts, log: (log || []).map(r => ({...r, topicLabel: labels.get(r.topic_id) || null}))};
}

async function setSettings(db, tenantId, patch) {
  const {error} = await db.from('sima_autonomy_settings').upsert({tenant_id: tenantId, ...patch}, {onConflict: 'tenant_id'});
  return error ? fail('update_refused') : {ok: true};
}
// Turning ON needs an explicit acknowledgement; stopping never does.
export async function enableAuto(db, tenantId, {acknowledged} = {}) {
  if (acknowledged !== true) return fail('acknowledgement_required');
  return setSettings(db, tenantId, {auto_enabled: true, paused_at: null});
}
export const disableAuto = (db, tenantId) => setSettings(db, tenantId, {auto_enabled: false});
// The database trigger demotes every automatic topic the moment this is written.
export const pauseAuto = (db, tenantId, {now = Date.now()} = {}) => setSettings(db, tenantId, {paused_at: new Date(now).toISOString()});
export async function resumeAuto(db, tenantId, {acknowledged} = {}) {
  if (acknowledged !== true) return fail('acknowledgement_required');
  return setSettings(db, tenantId, {paused_at: null});
}
export async function setCaps(db, tenantId, {hourly, customerDaily}) {
  const ok = (v, max) => Number.isInteger(v) && v >= 1 && v <= max;
  if (!ok(hourly, 200) || !ok(customerDaily, 20)) return fail('invalid_caps');
  return setSettings(db, tenantId, {auto_hourly_cap: hourly, auto_customer_daily_cap: customerDaily});
}

// The owner says an automatic answer that was SENT was wrong: recorded once, becomes a heavy failure in the topic's
// evidence, the threshold rises, and the topic may be demoted right away.
export async function markWrong(db, tenantId, id, {now = Date.now()} = {}) {
  const {data: answer, error} = await db.from('sima_auto_answers').select('id,review_id,topic_id,status,wrong_marked_at').eq('tenant_id', tenantId).eq('id', id).maybeSingle();
  if (error) return fail('auto_unavailable');
  if (!answer) return fail('not_found');
  if (answer.status !== 'sent') return fail('not_sent');
  if (answer.wrong_marked_at) return fail('already_marked');
  const {data: review} = await db.from('sima_human_review_cases').select('last_message_id').eq('tenant_id', tenantId).eq('id', answer.review_id).maybeSingle();
  const marked = await db.from('sima_auto_answers').update({wrong_marked_at: new Date(now).toISOString()}).eq('tenant_id', tenantId).eq('id', id);
  if (marked.error) return fail('update_refused');
  const outcome = await db.from('sima_topic_outcomes').upsert({tenant_id: tenantId, topic_id: answer.topic_id, source: 'auto', outcome: 'wrong',
    interaction_id: review?.last_message_id ?? null, created_at: new Date(now).toISOString()}, {onConflict: 'tenant_id,topic_id,source,interaction_id', ignoreDuplicates: true});
  if (outcome.error) return fail('update_refused');
  // Exactly one threshold step per wrong mark (the mark itself is once-only), never below the owner's floor, capped at 0.995.
  const {data: topicRow} = await db.from('sima_topics').select('confidence_floor,confidence_threshold').eq('tenant_id', tenantId).eq('id', answer.topic_id).maybeSingle();
  if (topicRow) {
    const raised = nextThreshold({threshold: Number(topicRow.confidence_threshold), floor: Number(topicRow.confidence_floor), recentAuto: {sent: 0, wrong: 1}});
    if (raised !== Number(topicRow.confidence_threshold)) await db.from('sima_topics').update({confidence_threshold: raised}).eq('tenant_id', tenantId).eq('id', answer.topic_id);
  }
  const [topics, knowledge, autonomy] = await Promise.all([listTopics(db, tenantId), loadKnowledge(db, tenantId), loadAutonomy(db, tenantId)]);
  const row = (topics.topics || []).find(t => t.id === answer.topic_id);
  if (!row || !knowledge.ok) return {ok: true, stage: null};
  const evaluation = await evaluateTopic(db, tenantId, row, {knowledge: knowledge.rows, autonomy, now});
  return {ok: true, stage: evaluation.stage, threshold: evaluation.threshold};
}

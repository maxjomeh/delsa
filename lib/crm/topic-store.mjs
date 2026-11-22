// Persistence and orchestration for CIMA topics (phase 3). Every function takes the database client as an argument and
// scopes EVERY query to one tenant. Nothing here sends a message. Stage changes go through decideStage; the database
// separately refuses an automatic stage for never-auto topics and for tenants with automatic replies off.
import {discoverTopics, assignTopic} from './topic-discovery.mjs';
import {runBacktest, summarizeBacktest} from './backtest.mjs';
import {topicConfidence, decideStage} from './topic-confidence.mjs';

const TOPIC_COLUMNS = 'id,tenant_id,topic_key,label,risk_class,status,stage,never_auto,confidence_floor,confidence_threshold,origin,keywords,examples,profile,activated_at,created_at,updated_at';
const PAGE = 1000, MAX_PAGES = 4, CHUNK = 500;
const fail = (code) => ({ok: false, error: code});
const num = value => Number(value);

export async function loadInteractions(db, tenantId) {
  const rows = []; let truncated = false;
  for (let page = 0; page < MAX_PAGES; page++) {
    const {data, error} = await db.from('crm_interactions')
      .select('id,customer_id,channel,direction,kind,body,occurred_at,created_at').eq('tenant_id', tenantId)
      .order('created_at', {ascending: false}).range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) return {ok: false, error: 'interactions_unavailable'};
    rows.push(...(data || []));
    if ((data || []).length < PAGE) break;
    if (page === MAX_PAGES - 1) truncated = true;
  }
  return {ok: true, rows, truncated};
}
export async function loadKnowledge(db, tenantId) {
  const {data, error} = await db.from('sima_knowledge_entries')
    .select('id,title,question,answer,revision,status,expires_at').eq('tenant_id', tenantId).eq('status', 'approved').limit(250);
  return error ? {ok: false, error: 'knowledge_unavailable'} : {ok: true, rows: data || []};
}
export async function loadAutonomy(db, tenantId) {
  const {data} = await db.from('sima_autonomy_settings').select('auto_enabled,default_floor,paused_at').eq('tenant_id', tenantId).maybeSingle();
  return {autoEnabled: Boolean(data?.auto_enabled && !data?.paused_at), floor: data?.default_floor != null ? num(data.default_floor) : 0.9};
}

// Row -> the shape the discovery/confidence engines use.
export const toEngine = row => ({
  id: row.id, key: row.topic_key, label: row.label, status: row.status, stage: row.stage, riskClass: row.risk_class, neverAuto: Boolean(row.never_auto),
  floor: num(row.confidence_floor), threshold: num(row.confidence_threshold), origin: row.origin, keywords: row.keywords || [], examples: row.examples || [],
  profile: row.profile || [], activatedAt: row.activated_at || null, requiredFields: row.requiredFields || [],
});

export async function listTopics(db, tenantId) {
  const {data: topics, error} = await db.from('sima_topics').select(TOPIC_COLUMNS).eq('tenant_id', tenantId).order('created_at', {ascending: true});
  if (error) return fail('topics_unavailable');
  const {data: fields, error: fieldsError} = await db.from('sima_topic_fields').select('topic_id,field_key,required').eq('tenant_id', tenantId);
  if (fieldsError) return fail('topics_unavailable');
  const byTopic = new Map();
  for (const f of fields || []) if (f.required) (byTopic.get(f.topic_id) || byTopic.set(f.topic_id, []).get(f.topic_id)).push(f.field_key);
  return {ok: true, topics: (topics || []).map(t => ({...t, requiredFields: (byTopic.get(t.id) || []).sort()}))};
}

// New discoveries are proposals; existing keys (and any edits the owner made to them) are never touched.
export async function saveProposals(db, tenantId, discovered) {
  const {floor} = await loadAutonomy(db, tenantId);
  const rows = discovered.map(t => ({
    tenant_id: tenantId, topic_key: t.key, label: (t.label || t.key).slice(0, 120).padEnd(2, '·'), risk_class: t.riskClass, never_auto: t.neverAuto,
    status: 'proposed', stage: 'learning', origin: 'discovered', confidence_floor: floor, confidence_threshold: floor,
    keywords: t.keywords, examples: t.examples.slice(0, 5).map(e => e.slice(0, 300)), profile: t.profile,
  }));
  if (!rows.length) return {ok: true, inserted: 0, skipped: 0};
  const {data, error} = await db.from('sima_topics').upsert(rows, {onConflict: 'tenant_id,topic_key', ignoreDuplicates: true}).select('topic_key');
  if (error) return fail('topics_unavailable');
  return {ok: true, inserted: (data || []).length, skipped: rows.length - (data || []).length};
}

async function recordTransition(db, tenantId, topic, to, reason, lowerBound) {
  await db.from('sima_topic_transitions').insert({tenant_id: tenantId, topic_id: topic.id, from_stage: topic.stage, to_stage: to, reason,
    confidence_lower_bound: lowerBound ?? null, threshold: num(topic.confidence_threshold ?? topic.threshold)});
}

export async function updateTopic(db, tenantId, id, action, value) {
  const {data: current, error} = await db.from('sima_topics').select(TOPIC_COLUMNS).eq('tenant_id', tenantId).eq('id', id).maybeSingle();
  if (error) return fail('topics_unavailable');
  if (!current) return fail('not_found');
  let patch;
  if (action === 'rename') {
    const label = String(value ?? '').trim();
    if (label.length < 2 || label.length > 120) return fail('invalid_label');
    patch = {label};
  } else if (action === 'activate') {
    if (current.status === 'active') return fail('invalid_transition');
    patch = {status: 'active'};
  } else if (action === 'retire') {
    if (current.status === 'retired') return fail('invalid_transition');
    patch = {status: 'retired', stage: 'learning'};   // a retired topic can never keep an automatic stage
  } else if (action === 'set_floor') {
    const floor = num(value);
    if (!Number.isFinite(floor) || floor < 0.5 || floor > 0.999) return fail('invalid_floor');
    patch = {confidence_floor: floor, confidence_threshold: Math.max(num(current.confidence_threshold), floor)};   // the threshold can never sit below the floor
  } else return fail('invalid_action');
  const {data, error: updateError} = await db.from('sima_topics').update(patch).eq('tenant_id', tenantId).eq('id', id).select(TOPIC_COLUMNS).maybeSingle();
  if (updateError) return fail('update_refused');
  if (patch.stage && patch.stage !== current.stage) await recordTransition(db, tenantId, current, patch.stage, 'TOPIC_RETIRED', null);
  return {ok: true, topic: data};
}

export async function setRequiredFields(db, tenantId, topicId, keys) {
  if (!Array.isArray(keys) || keys.length > 20 || keys.some(k => typeof k !== 'string')) return fail('invalid_fields');
  const unique = [...new Set(keys.map(k => k.trim()).filter(Boolean))];
  const {data: topic} = await db.from('sima_topics').select('id').eq('tenant_id', tenantId).eq('id', topicId).maybeSingle();
  if (!topic) return fail('not_found');
  const {data: defs, error} = await db.from('crm_field_definitions').select('key').eq('tenant_id', tenantId).eq('enabled', true);
  if (error) return fail('fields_unavailable');
  const allowed = new Set((defs || []).map(d => d.key));
  const unknown = unique.find(k => !allowed.has(k));
  if (unknown) return {ok: false, error: 'unknown_field', field: unknown};   // only the tenant's own enabled fields can be required
  const removed = await db.from('sima_topic_fields').delete().eq('tenant_id', tenantId).eq('topic_id', topicId);
  if (removed.error) return fail('update_refused');
  if (unique.length) {
    const inserted = await db.from('sima_topic_fields').insert(unique.map(field_key => ({tenant_id: tenantId, topic_id: topicId, field_key, required: true})));
    if (inserted.error) return fail('update_refused');
  }
  return {ok: true, fields: unique};
}

// Outcomes before the topic was activated are historical replay ('backtest'); after it, they are real-time 'shadow' evidence.
export async function persistOutcomes(db, tenantId, topic, outcomes) {
  const activated = topic.activatedAt ? Date.parse(topic.activatedAt) : null;
  if (activated == null) return {ok: true, inserted: 0};   // only reviewed (active) topics collect evidence
  const rows = outcomes.map(o => ({tenant_id: tenantId, topic_id: topic.id, source: o.at < activated ? 'backtest' : 'shadow', outcome: o.outcome,
    similarity: o.similarity ?? null, interaction_id: o.interactionId, created_at: new Date(o.at).toISOString()}));
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const {data, error} = await db.from('sima_topic_outcomes').upsert(rows.slice(i, i + CHUNK), {onConflict: 'tenant_id,topic_id,source,interaction_id', ignoreDuplicates: true}).select('id');
    if (error) return fail('outcomes_unavailable');
    inserted += (data || []).length;
  }
  return {ok: true, inserted};
}

export async function evaluateTopic(db, tenantId, row, {knowledge = [], autonomy, now = Date.now()} = {}) {
  let topic = toEngine(row), stage = topic.stage;
  const {data: outcomes} = await db.from('sima_topic_outcomes').select('outcome,source,created_at').eq('tenant_id', tenantId).eq('topic_id', topic.id)
    .order('created_at', {ascending: false}).limit(5000);
  const confidence = topicConfidence((outcomes || []).map(o => ({outcome: o.outcome, source: o.source, at: o.created_at})), {now});
  const knowledgeApproved = knowledge.filter(k => assignTopic(k.question, [topic])).length;
  const steps = [];
  for (let i = 0; i < 3; i++) {   // evidence may justify more than one step (e.g. learning -> shadow -> suggest)
    const decision = decideStage({topic: {...topic, stage}, confidence, knowledgeApproved, requiredFieldsDefined: topic.requiredFields.length > 0, autoEnabled: autonomy.autoEnabled});
    if (!decision.changed) { steps.push({stage, reason: decision.reason, changed: false}); break; }
    const {error} = await db.from('sima_topics').update({stage: decision.stage}).eq('tenant_id', tenantId).eq('id', topic.id);
    if (error) { steps.push({stage, reason: 'REFUSED_BY_DATABASE', changed: false}); break; }   // the database guard said no: keep the old stage
    await recordTransition(db, tenantId, {...row, stage}, decision.stage, decision.reason, confidence.lowerBound);
    steps.push({stage: decision.stage, reason: decision.reason, changed: true});
    stage = decision.stage;
  }
  return {id: topic.id, key: topic.key, stage, confidence, steps};
}

// Read-only view for the UI: topics with their required fields and current measured confidence. One outcomes query for the tenant.
export async function describeTopics(db, tenantId, {now = Date.now()} = {}) {
  const listed = await listTopics(db, tenantId);
  if (!listed.ok) return listed;
  const {data: outcomes, error} = await db.from('sima_topic_outcomes').select('topic_id,outcome,source,created_at').eq('tenant_id', tenantId)
    .order('created_at', {ascending: false}).limit(20000);
  if (error) return fail('topics_unavailable');
  const grouped = new Map();
  for (const o of outcomes || []) (grouped.get(o.topic_id) || grouped.set(o.topic_id, []).get(o.topic_id)).push({outcome: o.outcome, source: o.source, at: o.created_at});
  return {ok: true, topics: listed.topics.map(({profile, ...t}) => ({...t, confidence: topicConfidence(grouped.get(t.id) || [], {now})}))};   // the term profile is large and not needed by the UI
}

// Re-run the historical replay with the STORED topic profiles, persist outcomes for active topics, then re-evaluate stages.
export async function replay(db, tenantId, {now = Date.now()} = {}) {
  const listed = await listTopics(db, tenantId);
  if (!listed.ok) return listed;
  const [interactions, knowledge, autonomy] = await Promise.all([loadInteractions(db, tenantId), loadKnowledge(db, tenantId), loadAutonomy(db, tenantId)]);
  if (!interactions.ok) return interactions;
  if (!knowledge.ok) return knowledge;
  const rows = listed.topics.filter(t => t.status !== 'retired' && Array.isArray(t.profile) && t.profile.length);
  const engineTopics = rows.map(toEngine);
  const report = runBacktest({interactions: interactions.rows, knowledge: knowledge.rows, topics: engineTopics, now});
  let persisted = 0;
  for (const entry of report.topics) {
    const topic = engineTopics.find(t => t.key === entry.topic.key);
    const written = await persistOutcomes(db, tenantId, topic, entry.outcomes);
    if (!written.ok) return written;
    persisted += written.inserted;
  }
  const fresh = await listTopics(db, tenantId);
  const evaluations = [];
  for (const row of fresh.topics.filter(t => t.status === 'active')) evaluations.push(await evaluateTopic(db, tenantId, row, {knowledge: knowledge.rows, autonomy, now}));
  return {ok: true, report: summarizeBacktest(report), persisted, evaluations, truncated: interactions.truncated};
}

export async function discover(db, tenantId) {
  const interactions = await loadInteractions(db, tenantId);
  if (!interactions.ok) return interactions;
  const found = discoverTopics(interactions.rows);
  const saved = await saveProposals(db, tenantId, found);
  return saved.ok ? {...saved, found: found.length, truncated: interactions.truncated} : saved;
}

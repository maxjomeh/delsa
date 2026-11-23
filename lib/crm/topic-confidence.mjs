// Per-topic confidence and graduated autonomy for CIMA. Pure functions: no I/O, no sending.
//
// Confidence is NOT a model's self-reported score. It is the lower bound of how often a drafted
// answer for this topic was accepted by a human without material change, measured on real outcomes
// (historical replay, shadow mode, human feedback, auto-sent answers), with recent outcomes weighing
// more and a wrong automatic answer weighing heavily. With too few samples it is `null`, never a guess.
import {assessTopicRisk} from './topic-risk.mjs';

export const STAGES = Object.freeze(['learning', 'shadow', 'suggest', 'auto']);
export const DEFAULTS = Object.freeze({
  halfLifeDays: 45,   // an outcome's weight halves every 45 days
  minSamples: 30,     // effective samples required before a confidence exists at all
  minShadow: 20,      // replay/shadow samples required before a topic may go (or stay) automatic
  z: 1.96,            // 95% Wilson interval
  wrongWeight: 3,     // an automatic answer judged wrong counts as 3 failures
  hysteresis: 0.03,   // an automatic topic is demoted only when clearly below its threshold
});
const DAY = 86400000;
const round = value => Math.round(value * 1000) / 1000;
const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
const when = value => {
  const ms = typeof value === 'number' ? value : Date.parse(value || '');
  return Number.isFinite(ms) ? ms : null;
};

export function wilsonLowerBound(success, total, z = DEFAULTS.z) {
  if (!(total > 0)) return 0;
  const p = clamp(success / total, 0, 1);
  const centre = p + (z * z) / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);
  return Math.max(0, (centre - margin) / (1 + (z * z) / total));
}

// outcomes: [{outcome:'accepted'|'edited'|'rejected'|'wrong', source:'backtest'|'shadow'|'human_feedback'|'auto', at}]
export function topicConfidence(outcomes = [], {now = Date.now(), halfLifeDays = DEFAULTS.halfLifeDays, minSamples = DEFAULTS.minSamples, wrongWeight = DEFAULTS.wrongWeight} = {}) {
  let success = 0, failure = 0, shadowSamples = 0, count = 0;
  for (const item of outcomes) {
    if (!item) continue;
    const at = when(item.at);
    const age = at == null ? 0 : Math.max(0, now - at) / DAY;
    const weight = Math.pow(0.5, age / halfLifeDays);
    if (item.outcome === 'accepted') success += weight;
    else if (item.outcome === 'edited') { success += 0.5 * weight; failure += 0.5 * weight; }
    else if (item.outcome === 'rejected') failure += weight;
    else if (item.outcome === 'wrong') failure += wrongWeight * weight;
    else continue;
    count += 1;
    if (item.source === 'backtest' || item.source === 'shadow') shadowSamples += 1;
  }
  const effectiveN = success + failure;
  const measured = effectiveN >= minSamples;
  const lowerBound = round(wilsonLowerBound(success, effectiveN));
  return {
    status: measured ? 'measured' : 'insufficient_data',
    confidence: measured ? lowerBound : null,   // null until measured: "not enough evidence" is not "low"
    lowerBound, rate: effectiveN ? round(success / effectiveN) : 0,
    effectiveN: round(effectiveN), count, shadowSamples,
  };
}

// Owner sets the floor; the system may only move the threshold at or above it.
export function nextThreshold({threshold, floor, recentAuto = {sent: 0, wrong: 0}}) {
  const base = Math.max(floor, threshold || floor);
  if (recentAuto.wrong > 0) return round(clamp(base + 0.02 * recentAuto.wrong, floor, 0.995));   // any wrong automatic answer raises it
  if (recentAuto.sent >= 50) return round(clamp(base - 0.01, floor, 0.995));                      // slowly relax only after clean volume
  return round(base);
}

export function decideStage({topic, confidence, knowledgeApproved = 0, requiredFieldsDefined = false, autoEnabled = false, recentAuto = {sent: 0, wrong: 0}, minShadow = DEFAULTS.minShadow, hysteresis = DEFAULTS.hysteresis}) {
  const stage = topic.stage;
  const threshold = Math.max(topic.threshold ?? topic.floor, topic.floor);
  const measured = confidence?.status === 'measured';
  const lb = confidence?.lowerBound ?? 0;
  const shadow = confidence?.shadowSamples ?? 0;
  const move = (to, reason) => ({stage: to, changed: to !== stage, reason});

  if (topic.neverAuto && stage === 'auto') return move('suggest', 'NEVER_AUTO_TOPIC');
  if (stage === 'auto') {
    if (!autoEnabled) return move('suggest', 'AUTO_REPLY_DISABLED');
    if (recentAuto.wrong >= 3) return move('shadow', 'REPEATED_WRONG_AUTOMATIC_ANSWERS');
    if (!measured || lb < threshold - hysteresis) return move('suggest', 'CONFIDENCE_BELOW_THRESHOLD');
    return move('auto', 'CONFIDENCE_HOLDS');
  }
  if (stage === 'learning') {
    return knowledgeApproved > 0 && requiredFieldsDefined ? move('shadow', 'READY_FOR_SHADOW') : move('learning', 'NEEDS_KNOWLEDGE_AND_FIELDS');
  }
  if (stage === 'shadow') {
    return measured && shadow >= minShadow && lb >= Math.max(0.5, threshold - 0.15) ? move('suggest', 'SHADOW_EVIDENCE_SUFFICIENT') : move('shadow', 'COLLECTING_SHADOW_EVIDENCE');
  }
  // suggest
  if (topic.neverAuto) return move('suggest', 'NEVER_AUTO_TOPIC');
  if (measured && lb < threshold - 0.2) return move('shadow', 'CONFIDENCE_COLLAPSED');
  if (autoEnabled && measured && shadow >= minShadow && lb >= threshold) return move('auto', 'CONFIDENCE_AT_THRESHOLD');
  return move('suggest', autoEnabled ? 'BELOW_AUTO_THRESHOLD' : 'AUTO_REPLY_DISABLED');
}

// The last gate before an automatic answer. Every reason is listed so the UI can explain a refusal.
// `fields` maps field_key -> {verified:boolean}. Missing or unverified required information blocks the answer.
export function canAutoAnswer({tenant = {}, topic, confidence, fields = {}, message = '', customer = {}, window = {}, thread = {}}) {
  const reasons = [];
  if (!tenant.autoEnabled) reasons.push('AUTO_REPLY_DISABLED');
  if (tenant.paused) reasons.push('TENANT_PAUSED');
  if (!topic || topic.status !== 'active') reasons.push('TOPIC_NOT_ACTIVE');
  if (topic?.neverAuto) reasons.push('NEVER_AUTO_TOPIC');
  if (topic && topic.stage !== 'auto') reasons.push('TOPIC_NOT_AUTOMATIC');
  if (topic && !(topic.threshold >= topic.floor)) reasons.push('THRESHOLD_BELOW_OWNER_FLOOR');
  if (topic && !(confidence?.status === 'measured' && confidence.lowerBound >= topic.threshold)) reasons.push('CONFIDENCE_BELOW_THRESHOLD');
  for (const key of topic?.requiredFields || []) if (!fields[key]?.verified) reasons.push(`MISSING_FIELD:${key}`);
  for (const code of assessTopicRisk(message, {doNotContact: customer.doNotContact}).blocks) reasons.push(`RISK:${code}`);
  if (window.open !== true) reasons.push('MESSAGING_WINDOW_CLOSED');
  if (thread.alreadyReplied || thread.pendingSend) reasons.push('ALREADY_HANDLED');
  return {allow: reasons.length === 0, reasons};
}

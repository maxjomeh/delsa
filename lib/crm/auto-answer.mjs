// The decision to answer a customer automatically. Pure: no I/O, no sending. Every refusal lists its reasons.
//
// An automatic answer is ALWAYS the exact text of an approved knowledge entry belonging to the matched topic: the model
// never writes free text to a customer. All conditions must hold at once; the database re-verifies the critical ones
// (tenant switch, topic stage, verbatim approved text, caps, conversation rules) when the send is queued and claimed.
import {matchAnswer} from './knowledge-match.mjs';
import {assessTopicRisk} from './topic-risk.mjs';
import {canAutoAnswer} from './topic-confidence.mjs';

export const AUTO_MODES = Object.freeze(['off', 'dry_run', 'live']);
// Server-level mode. Anything unknown means OFF: the safe default.
export function autoMode(env = process.env) {
  const value = String(env?.CIMA_AUTO_MODE || 'off').trim().toLowerCase();
  return AUTO_MODES.includes(value) ? value : 'off';
}

export function decideAutoAnswer({mode = 'off', tenant = {}, topic, confidence, fields = {}, turnText = '', customer = {}, window = {}, thread = {}, knowledge = [], counts = {}, now = Date.now()}) {
  if (mode === 'off') return {action: 'skip', reasons: ['MODE_OFF']};
  const gate = canAutoAnswer({tenant, topic, confidence, fields, message: turnText, customer, window, thread});
  const reasons = [...gate.reasons];

  // The answer: the approved entry of THIS topic that is clearly closest to what the customer wrote (see knowledge-match.mjs).
  const match = matchAnswer({message: turnText, topic, knowledge, now});
  let entry = null;
  if (match.status === 'matched') {
    entry = match.entry;
    if (String(entry.answer).trim().length > 4000) { reasons.push('ANSWER_TOO_LONG'); entry = null; }
    // An approved answer that itself talks about price/stock/commitments is not something to send on its own.
    else if (assessTopicRisk(entry.answer).locked.length) { reasons.push('ANSWER_CONTAINS_LOCKED_TOPIC'); entry = null; }
  } else reasons.push(match.status === 'ambiguous' ? 'AMBIGUOUS_KNOWLEDGE' : match.reason);
  if ((counts.tenantLastHour ?? 0) >= (tenant.hourlyCap ?? 20)) reasons.push('HOURLY_CAP');
  if ((counts.customerLast24h ?? 0) >= (tenant.customerDailyCap ?? 3)) reasons.push('CUSTOMER_DAILY_CAP');

  if (reasons.length || !entry) return {action: 'blocked', reasons: [...new Set(reasons)]};
  return {action: mode === 'live' ? 'send' : 'dry_run', reasons: [], answer: String(entry.answer).trim(), entry: {id: entry.id, revision: entry.revision}};
}

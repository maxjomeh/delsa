// Historical replay ("backtest"): for every past customer question that a human answered, would CIMA's grounded
// draft have matched the human's real reply? Produces per-topic outcomes (the evidence the confidence engine learns
// from) and knowledge suggestions. Pure: reads arrays, returns a report. Nothing is sent or written.
import {matchAnswer} from './knowledge-match.mjs';
import {assessTopicRisk} from './topic-risk.mjs';
import {compareDraftToHuman, numbersIn, similarity} from './shadow-eval.mjs';
import {topicConfidence} from './topic-confidence.mjs';
import {assignTopic, discoverTopics, isQuestion} from './topic-discovery.mjs';

const ms = value => { const t = Date.parse(value || ''); return Number.isFinite(t) ? t : null; };
const isMessage = x => x && x.kind === 'message' && typeof x.body === 'string' && x.body.trim();

// A "turn" is a run of consecutive inbound messages; the reply is the first outbound message after it.
export function pairQuestionsWithReplies(interactions = [], {maxGapHours = 24} = {}) {
  const groups = new Map();
  for (const x of interactions) {
    if (!x || !x.customer_id || !isMessage(x) || ms(x.occurred_at || x.created_at) == null) continue;
    const key = `${x.customer_id}|${x.channel || ''}`;
    (groups.get(key) || groups.set(key, []).get(key)).push(x);
  }
  const pairs = [];
  for (const list of groups.values()) {
    list.sort((a, b) => ms(a.occurred_at || a.created_at) - ms(b.occurred_at || b.created_at) || String(a.id).localeCompare(String(b.id)));
    let turn = [];
    for (const item of list) {
      if (item.direction === 'inbound') { turn.push(item); continue; }
      if (item.direction !== 'outbound' || !turn.length) continue;
      const lastAt = ms(turn[turn.length - 1].occurred_at || turn[turn.length - 1].created_at);
      const replyAt = ms(item.occurred_at || item.created_at);
      const text = turn.map(t => t.body.trim()).join(' ').slice(0, 600);
      if (replyAt - lastAt <= maxGapHours * 3600000 && isQuestion(text)) {
        pairs.push({customerId: item.customer_id, question: text, reply: item.body.trim(), questionAt: lastAt, replyAt, interactionId: item.id});
      }
      turn = [];   // a reply (or a stale turn) always closes the turn
    }
  }
  return pairs.sort((a, b) => a.replyAt - b.replyAt || String(a.interactionId).localeCompare(String(b.interactionId)));
}

// Suggest a draft knowledge entry from the owner's OWN consistent past replies: the most representative reply
// (medoid by similarity). Always a draft for human approval; replies that look risky or carry figures are flagged.
export function suggestKnowledge(pairs, {minReplies = 5, minConsistency = 0.5} = {}) {
  if (pairs.length < minReplies) return null;
  let best = null, bestMean = -1;
  for (let i = 0; i < pairs.length; i++) {
    let sum = 0;
    for (let j = 0; j < pairs.length; j++) if (i !== j) sum += similarity(pairs[i].reply, pairs[j].reply);
    const mean = sum / (pairs.length - 1);
    if (mean > bestMean) { bestMean = mean; best = pairs[i]; }
  }
  const consistency = Math.round(bestMean * 1000) / 1000;
  if (consistency < minConsistency) return null;                              // the owner answers this differently each time
  if (assessTopicRisk(best.reply).blocks.length) return null;                 // never bootstrap knowledge about price/stock/commitments
  return {question: best.question, answer: best.reply, support: pairs.length, consistency,
    containsNumbers: numbersIn(best.reply).length > 0,                        // hours, quantities, phones: owner must confirm they are current
    status: 'draft'};
}

export function runBacktest({interactions = [], knowledge = [], topics = null, now = Date.now(), maxGapHours = 24, discovery = {}, minScore = 0.3} = {}) {
  const found = topics || discoverTopics(interactions, discovery);
  const pairs = pairQuestionsWithReplies(interactions, {maxGapHours});
  const byTopic = new Map(found.map(t => [t.key, {topic: t, pairs: [], outcomes: [], uncovered: 0, ambiguous: 0, blocked: 0}]));
  let unassigned = 0;
  for (const pair of pairs) {
    const hit = assignTopic(pair.question, found, {minScore});
    if (!hit) { unassigned += 1; continue; }
    const slot = byTopic.get(hit.topic.key);
    slot.pairs.push(pair);
    // Risky questions are never scored toward automation (they can never be automatic); they are only counted.
    if (assessTopicRisk(pair.question).blocks.length) { slot.blocked += 1; continue; }
    // The same matcher the automatic path uses, so replay evidence measures what automation would really do.
    const match = matchAnswer({message: pair.question, topic: hit.topic, knowledge, now});
    if (match.status === 'ambiguous') { slot.ambiguous += 1; continue; }              // two different answers about equally close: nothing would be sent
    if (match.status !== 'matched') { slot.uncovered += 1; continue; }                // no approved knowledge: a coverage gap, not a failure
    const result = compareDraftToHuman(String(match.entry.answer).trim(), pair.reply);
    slot.outcomes.push({outcome: result.outcome, source: 'backtest', at: pair.replyAt, similarity: result.similarity,
      interactionId: pair.interactionId, knowledgeId: match.entry.id, matchScore: match.score});
  }
  const report = [...byTopic.values()].map(({topic, pairs: p, outcomes, uncovered, ambiguous, blocked}) => {
    const answerable = p.length - blocked;
    return {
      topic: {key: topic.key, label: topic.label, riskClass: topic.riskClass, neverAuto: topic.neverAuto},
      pairs: p.length, blocked, uncovered, ambiguous, scored: outcomes.length,
      coverage: answerable ? Math.round((outcomes.length / answerable) * 1000) / 1000 : 0,
      confidence: topicConfidence(outcomes, {now}),
      outcomes,
      knowledgeSuggestion: topic.neverAuto ? null : suggestKnowledge(p.filter(x => !assessTopicRisk(x.question).blocks.length)),
    };
  }).sort((a, b) => b.pairs - a.pairs || a.topic.key.localeCompare(b.topic.key));
  return {generatedAt: now, params: {maxGapHours, minScore, knowledgeEntries: knowledge.length},
    totals: {interactions: interactions.length, pairs: pairs.length, unassigned, topics: found.length}, topics: report, discovered: found};
}

// Compact, API-safe view: drops per-message outcomes and term profiles (large, and not needed to decide anything).
export function summarizeBacktest(report) {
  return {
    generatedAt: report.generatedAt, params: report.params, totals: report.totals,
    topics: report.topics.map(({outcomes, ...topic}) => ({...topic, samples: outcomes.length})),
    discovered: report.discovered.map(({profile, ...topic}) => topic),
  };
}

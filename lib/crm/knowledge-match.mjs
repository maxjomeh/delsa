// Which approved knowledge entry answers this customer message, for AUTOMATIC replies and the historical replay.
// Pure and deterministic. (The Copilot for human review keeps its own, stricter token matcher: this module does not touch it.)
//
// The existing matcher needs the customer's words to overlap the entry's question token for token, which covers only a
// fraction of real paraphrases (ساعت کاری چیه / تا چه ساعتی پاسخگو هستید / ساعت کار شما کی هست). Here the match is
//   1. SCOPED to the topic: only approved, unexpired entries whose own question belongs to the matched topic are candidates;
//   2. scored by character-trigram overlap (robust to Persian suffixes and clitics), after dropping generic question words;
//   3. accepted only above a floor AND with a clear margin: two different answers that are almost equally close are
//      AMBIGUOUS and nothing is sent.
// A wrong match is not hidden by this module: it shows up as a rejected replay outcome, which lowers the topic's confidence.
import {assignTopic, featureWords, trigrams} from './topic-discovery.mjs';

export const MATCH_DEFAULTS = Object.freeze({minScore: 0.3, minMargin: 0.08});
const grams = text => new Set(trigrams(featureWords(text)));
const dice = (a, b) => {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const g of a) if (b.has(g)) shared += 1;
  return (2 * shared) / (a.size + b.size);
};
const usable = (entry, now) => entry && entry.status === 'approved' && String(entry.question || '').trim() && String(entry.answer || '').trim()
  && !(entry.expires_at && Date.parse(entry.expires_at) <= now);

// -> {status:'matched', entry, score, margin} | {status:'ambiguous', candidates} | {status:'none', reason}
export function matchAnswer({message, topic, knowledge = [], now = Date.now(), minScore = MATCH_DEFAULTS.minScore, minMargin = MATCH_DEFAULTS.minMargin}) {
  const entries = knowledge.filter(k => usable(k, now));
  if (!entries.length) return {status: 'none', reason: 'NO_APPROVED_ANSWER'};
  const inTopic = entries.filter(k => assignTopic(k.question, [topic]));
  if (!inTopic.length) return {status: 'none', reason: 'KNOWLEDGE_NOT_IN_TOPIC'};
  const query = grams(message);
  const scored = inTopic.map(entry => ({entry, score: Math.max(dice(query, grams(entry.question)), dice(query, grams(entry.title || '')))}))
    .sort((a, b) => b.score - a.score || String(a.entry.id).localeCompare(String(b.entry.id)));
  const [best, second] = scored;
  if (best.score < minScore) return {status: 'none', reason: 'NO_CLOSE_ANSWER'};
  // A runner-up with the same answer text is not a conflict; a different answer that is nearly as close is.
  const rival = scored.find(x => x !== best && String(x.entry.answer).trim() !== String(best.entry.answer).trim());
  if (rival && best.score - rival.score < minMargin && rival.score >= minScore) {
    return {status: 'ambiguous', candidates: [best, rival].map(x => ({id: x.entry.id, score: Math.round(x.score * 1000) / 1000}))};
  }
  return {status: 'matched', entry: best.entry, score: Math.round(best.score * 1000) / 1000, margin: Math.round((best.score - (second?.score ?? 0)) * 1000) / 1000};
}

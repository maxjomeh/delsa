// Discover candidate topics from what customers actually ask. Pure and deterministic: no I/O, no model call,
// nothing is invented. Topics are PROPOSALS for the owner to review, never active by themselves.
//
// Method: incremental cosine clustering over TF-IDF vectors of inbound questions (same idea as adaptive-fields),
// then a risk assessment of each cluster using the same rules that gate automatic answers.
import {tokens} from './cima-grounding.mjs';
import {assessTopicRisk} from './topic-risk.mjs';

const INTERROGATIVE = /[؟?]|چنده|چقدر|چیه|چیست|چطور|چگونه|چی‌?کار|کی |کجا|کدام|کدوم|دارید|دارین|هستش|هست|میشه|می‌شه|می‌شود|میتونم|می‌تونم|امکان|چند /u;
export const isQuestion = text => INTERROGATIVE.test(String(text || ''));

// Persian is rich in suffixes and clitics (ساعت / ساعتی / ساعت‌هاشون), so short questions share few whole words.
// Character trigrams of each token make clustering robust to that; whole words are kept only to label a topic.
export const trigrams = terms => {
  const out = [];
  for (const term of terms) {
    const padded = ` ${term} `;
    if (padded.length <= 3) { out.push(padded); continue; }
    for (let i = 0; i + 3 <= padded.length; i++) out.push(padded.slice(i, i + 3));
  }
  return out;
};
// Words that make a message a question but say nothing about its topic; they would glue unrelated topics together.
const GENERIC = new Set(['چنده', 'چقدره', 'چقدر', 'چیه', 'چیست', 'چطوره', 'چطوریه', 'چطور', 'هست', 'هستش', 'هستید', 'هستین', 'داره', 'دارید', 'دارین',
  'میشه', 'می‌شه', 'می‌شود', 'کی', 'کجا', 'چند', 'باید', 'اقدام', 'امکان', 'لطفا', 'لطفاً', 'آیا', 'کنم', 'کنید', 'میتونم', 'می‌تونم']);
const SUFFIX = /(هایی|های|ها|تون|تان|مون|مان|ای|ی)$/u;
const stem = term => (term.length > 4 ? term.replace(SUFFIX, '') : term);

const hash = value => { let h = 5381; for (const ch of value) h = ((h << 5) + h + ch.codePointAt(0)) >>> 0; return h.toString(36); };
const idfOf = docs => {
  const df = new Map();
  for (const doc of docs) for (const term of new Set(doc)) df.set(term, (df.get(term) || 0) + 1);
  return new Map([...df].map(([term, n]) => [term, Math.log(1 + (docs.length + 1) / (n + 1))]));
};
// Plain term frequency for clustering: on very short texts IDF over-rewards accidental rare grams and splits one topic.
// IDF is still used to rank words for a topic's label.
const vectorOf = terms => {
  const v = new Map();
  for (const term of terms) v.set(term, (v.get(term) || 0) + 1);
  return v;
};
const norm = v => { let s = 0; for (const x of v.values()) s += x * x; return Math.sqrt(s); };
const cosine = (a, b) => {
  let dot = 0;
  for (const [term, x] of a) dot += x * (b.get(term) || 0);
  return dot / ((norm(a) * norm(b)) || 1);
};

// The inbound messages that look like a question and are long enough to carry meaning.
export function questionsFrom(interactions = []) {
  return interactions
    .filter(x => x && x.direction === 'inbound' && x.kind === 'message' && x.customer_id && typeof x.body === 'string')
    .map(x => ({id: x.id, customerId: x.customer_id, text: x.body.trim().slice(0, 600), at: x.occurred_at || x.created_at}))
    .filter(q => q.text.length >= 4 && isQuestion(q.text))
    .map(q => { const words = tokens(q.text).filter(w => !GENERIC.has(w)).slice(0, 30); return {...q, terms: words, grams: trigrams(words)}; })
    .filter(q => q.terms.length >= 2);
}

export function discoverTopics(interactions = [], {minOccurrences = 5, minCustomers = 3, similarity = 0.2, mergeSimilarity = 0.5, maxTopics = 40} = {}) {
  const questions = questionsFrom(interactions);
  const wordIdf = idfOf(questions.map(q => q.terms.map(stem)));
  const clusters = [];
  for (const question of questions) {
    const vec = vectorOf(question.grams);
    let best = null, bestSim = 0;
    for (const cluster of clusters) { const s = cosine(vec, cluster.centroid); if (s > bestSim) { bestSim = s; best = cluster; } }
    if (best && bestSim >= similarity) {
      best.members.push(question);
      for (const [gram, x] of vec) best.centroid.set(gram, (best.centroid.get(gram) || 0) + x);
    } else clusters.push({members: [question], centroid: new Map(vec)});
  }
  // Second pass: short questions often split one topic in two (چنده / چقدره). Merge clusters whose CENTROIDS, which
  // are far denser than single questions, are clearly similar. Unrelated topics stay apart.
  for (let merged = true; merged && clusters.length > 1;) {
    merged = false;
    let bestPair = null, bestSim = 0;
    for (let i = 0; i < clusters.length; i++) for (let j = i + 1; j < clusters.length; j++) {
      const s = cosine(clusters[i].centroid, clusters[j].centroid);
      if (s > bestSim) { bestSim = s; bestPair = [i, j]; }
    }
    if (bestPair && bestSim >= mergeSimilarity) {
      const [i, j] = bestPair;
      clusters[i].members.push(...clusters[j].members);
      for (const [gram, x] of clusters[j].centroid) clusters[i].centroid.set(gram, (clusters[i].centroid.get(gram) || 0) + x);
      clusters.splice(j, 1);
      merged = true;
    }
  }
  return clusters
    .filter(c => c.members.length >= minOccurrences && new Set(c.members.map(m => m.customerId)).size >= minCustomers)
    .map(c => {
      const top = [...c.centroid].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 120);
      const total = Math.sqrt(top.reduce((s, [, w]) => s + w * w, 0)) || 1;
      const profile = top.map(([gram, w]) => [gram, Math.round((w / total) * 1000) / 1000]);
      // Label from the words most shared by the cluster's own questions (document frequency x rarity).
      const df = new Map();
      for (const m of c.members) for (const word of new Set(m.terms.map(stem))) df.set(word, (df.get(word) || 0) + 1);
      const keywords = [...df].map(([word, n]) => [word, n * (wordIdf.get(word) || 1)])
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([word]) => word);
      // Risk of the cluster = how often its own questions hit a block rule.
      const counts = new Map();
      let risky = 0;
      for (const m of c.members) {
        const {blocks} = assessTopicRisk(m.text);
        if (blocks.length) risky += 1;
        for (const code of blocks) counts.set(code, (counts.get(code) || 0) + 1);
      }
      const share = risky / c.members.length;
      const riskClass = share >= 0.3 ? 'high' : risky > 0 ? 'medium' : 'low';
      return {
        key: 't_' + hash([...keywords].slice(0, 3).sort().join('|')),
        label: keywords.slice(0, 3).join(' '), labelIsAuto: true,   // the owner renames it; we never pretend the label is meaningful
        keywords, profile, count: c.members.length, customers: new Set(c.members.map(m => m.customerId)).size,
        examples: c.members.slice(0, 5).map(m => m.text),
        riskClass, neverAuto: riskClass === 'high',
        blocks: [...counts].map(([code, n]) => ({code, share: Math.round((n / c.members.length) * 100) / 100})).sort((a, b) => b.share - a.share),
        requiredFields: [],                                          // defined by the owner; the completeness gate stays closed until then
        origin: 'discovered', status: 'proposed',
      };
    })
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, maxTopics);
}

// Best topic for a new question, or null. Weighted overlap with the topic's term profile.
export function assignTopic(text, topics = [], {minScore = 0.3} = {}) {
  const words = tokens(text).filter(w => !GENERIC.has(w));
  if (words.length < 2) return null;
  const query = [...new Set(trigrams(words))];
  let best = null, bestScore = 0;
  for (const topic of topics) {
    const weights = new Map(topic.profile || []);
    let dot = 0;
    for (const gram of query) dot += weights.get(gram) || 0;
    const score = dot / (Math.sqrt(query.length) * (Math.sqrt([...weights.values()].reduce((s, w) => s + w * w, 0)) || 1));
    if (score > bestScore) { bestScore = score; best = topic; }
  }
  return bestScore >= minScore ? {topic: best, score: Math.round(bestScore * 1000) / 1000} : null;
}

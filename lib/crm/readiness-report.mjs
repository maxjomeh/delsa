// "Readiness" report: what the replay on REAL conversations says about each topic, in a form the business owner can act on.
// Pure and deterministic: no I/O, no model call. Reads the output of runBacktest (+ the approved knowledge) and returns
// structured data plus a Markdown rendering. Personal data is masked by default in everything it prints.
import {assignTopic} from './topic-discovery.mjs';
import {decideStage} from './topic-confidence.mjs';

const DIGIT = '[0-9\\u06F0-\\u06F9\\u0660-\\u0669]';
const RULES = [
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[ایمیل]'],
  [/(?:https?:\/\/|www\.)\S+/gi, '[لینک]'],
  [/(^|[\s(])@[A-Za-z0-9._]{2,}/g, '$1@[آیدی]'],
  // long digit runs (phone numbers, card numbers, prices with separators). Short ones such as "۹ تا ۱۷" stay.
  [new RegExp(`${DIGIT}[${'0-9\\u06F0-\\u06F9\\u0660-\\u0669'}\\s().\\-\\u2013\\u066C,]{6,}${DIGIT}`, 'g'), '[عدد بلند]'],
];
export function redactText(text) {
  let out = String(text ?? '');
  for (const [pattern, replacement] of RULES) out = out.replace(pattern, replacement);
  return out;
}

const round = v => Math.round(v * 1000) / 1000;
const fa = v => Number(v).toLocaleString('fa-IR');
const pct = v => `${fa(Math.round(v * 100))}٪`;

// How far the topic could go with today's evidence, IF the owner activates it, defines required information and turns
// automatic replies on. It is a projection from replay evidence, not a promise: live conditions still apply.
export function reachableStage({confidence, knowledgeApproved, neverAuto}) {
  let stage = 'learning';
  const path = [stage];
  for (let i = 0; i < 4; i++) {
    const d = decideStage({topic: {stage, neverAuto, threshold: 0.9, floor: 0.9, status: 'active'}, confidence, knowledgeApproved, requiredFieldsDefined: true, autoEnabled: true, recentAuto: {sent: 0, wrong: 0}});
    if (!d.changed) return {stage, path, reason: d.reason};
    stage = d.stage; path.push(stage);
  }
  return {stage, path, reason: 'LOOP_LIMIT'};
}

export function buildReadiness(result, {knowledge = []} = {}) {
  const profileOf = new Map((result.discovered || []).map(t => [t.key, t]));
  const topics = result.topics.map(entry => {
    const discovered = profileOf.get(entry.topic.key) || {};
    const counts = {accepted: 0, edited: 0, rejected: 0};
    for (const o of entry.outcomes) if (counts[o.outcome] !== undefined) counts[o.outcome] += 1;
    const knowledgeApproved = knowledge.filter(k => k.status === 'approved' && discovered.profile && assignTopic(k.question, [discovered])).length;
    const answerable = entry.pairs - entry.blocked;
    return {
      key: entry.topic.key, label: entry.topic.label, riskClass: entry.topic.riskClass, neverAuto: entry.topic.neverAuto,
      pairs: entry.pairs, blocked: entry.blocked, uncovered: entry.uncovered, ambiguous: entry.ambiguous ?? 0, scored: entry.scored,
      coverage: entry.coverage, outcomes: counts, rejectionRate: entry.scored ? round(counts.rejected / entry.scored) : null,
      confidence: {status: entry.confidence.status, confidence: entry.confidence.confidence, effectiveN: entry.confidence.effectiveN},
      knowledgeApproved, answerable,
      reachable: entry.topic.neverAuto ? {stage: 'suggest', path: ['learning', 'shadow', 'suggest'], reason: 'NEVER_AUTO_TOPIC'} : reachableStage({confidence: entry.confidence, knowledgeApproved, neverAuto: false}),
      knowledgeSuggestion: entry.knowledgeSuggestion, examples: (discovered.examples || []).slice(0, 3), blocks: discovered.blocks || [],
    };
  });

  const actions = [];
  const add = (priority, code, topic, data = {}) => actions.push({priority, code, topic: topic?.label ?? null, key: topic?.key ?? null, ...data});
  const humanOnly = topics.filter(t => t.neverAuto);
  if (humanOnly.length) add(0, 'HUMAN_ONLY', null, {topics: humanOnly.map(t => t.label), pairs: humanOnly.reduce((n, t) => n + t.pairs, 0)});
  for (const t of topics.filter(x => !x.neverAuto).sort((a, b) => b.pairs - a.pairs || a.key.localeCompare(b.key))) {
    if (t.pairs < 10) add(5, 'LOW_DATA', t, {pairs: t.pairs});
    if (!t.knowledgeApproved && t.knowledgeSuggestion) add(1, 'WRITE_KNOWLEDGE', t, {suggestion: t.knowledgeSuggestion});
    else if (!t.knowledgeApproved) add(2, 'NEED_STANDARD_ANSWER', t, {pairs: t.pairs});
    if (t.ambiguous > 0) add(2, 'RESOLVE_AMBIGUITY', t, {ambiguous: t.ambiguous});
    if (t.scored >= 5 && t.rejectionRate >= 0.3) add(2, 'ANSWERS_DIFFER', t, {rejectionRate: t.rejectionRate});
    if (t.knowledgeApproved && t.answerable >= 10 && t.uncovered / t.answerable >= 0.4) add(3, 'ADD_VARIANTS', t, {coverage: t.coverage});
    if (t.knowledgeApproved && t.reachable.stage !== 'learning') add(4, 'DEFINE_FIELDS_AND_ACTIVATE', t, {reachable: t.reachable.stage});
  }
  actions.sort((a, b) => a.priority - b.priority || String(a.key).localeCompare(String(b.key)) || a.code.localeCompare(b.code));

  const assigned = result.totals.pairs - result.totals.unassigned;
  const blocked = topics.reduce((n, t) => n + t.blocked, 0);
  return {
    summary: {interactions: result.totals.interactions, pairs: result.totals.pairs, assigned, unassigned: result.totals.unassigned, topics: topics.length,
      blockedShare: assigned ? round(blocked / assigned) : 0, humanOnlyTopics: humanOnly.length,
      eligibleForAuto: topics.filter(t => t.reachable.stage === 'auto').map(t => t.label)},
    topics, actions,
  };
}

const STAGE = {learning: 'یادگیری', shadow: 'سایه', suggest: 'پیشنهاد به انسان', auto: 'خودکار (با شواهد کافی)'};
const rd = (redact, text) => (redact ? redactText(text) : String(text));

function actionText(a, redact) {
  switch (a.code) {
    case 'HUMAN_ONLY': return `${fa(a.topics.length)} موضوع پرخطر (${a.topics.join('، ')}) پیدا شد که همیشه با انسان می‌ماند. ${fa(a.pairs)} گفت‌وگوی شما در این موضوع‌هاست و هرگز خودکار نمی‌شود.`;
    case 'WRITE_KNOWLEDGE': return `«${a.topic}»: شما همیشه تقریباً یک‌جور جواب داده‌اید. این پاسخ را در «دانش کسب‌وکار» به‌صورت پیش‌نویس بسازید و بعد از بازبینی تأیید کنید:\n   > ${rd(redact, a.suggestion.answer)}${a.suggestion.containsNumbers ? '\n   (شامل عدد است؛ پیش از تأیید درستی‌اش را بررسی کنید.)' : ''}`;
    case 'NEED_STANDARD_ANSWER': return `«${a.topic}»: ${fa(a.pairs)} پرسش دارد ولی پاسخ‌های شما یک‌شکل نیست؛ یک پاسخ استاندارد برایش بنویسید.`;
    case 'RESOLVE_AMBIGUITY': return `«${a.topic}»: ${fa(a.ambiguous)} پرسش بین دو پاسخ تأییدشده‌ی متفاوت مبهم است؛ پرسش‌های مدخل‌ها را از هم متمایز کنید یا یکی را حذف کنید.`;
    case 'ANSWERS_DIFFER': return `«${a.topic}»: پاسخ تأییدشده در ${pct(a.rejectionRate)} موارد با پاسخ واقعی شما فرق دارد؛ متن دانش را بازبینی کنید.`;
    case 'ADD_VARIANTS': return `«${a.topic}»: فقط ${pct(a.coverage)} پرسش‌ها پوشش داده می‌شود؛ شکل‌های دیگر همان پرسش را به دانش اضافه کنید.`;
    case 'DEFINE_FIELDS_AND_ACTIVATE': return `«${a.topic}»: «اطلاعات لازم پیش از پاسخ» را تعریف و موضوع را فعال کنید. با شواهد فعلی می‌تواند تا مرحله‌ی «${STAGE[a.reachable]}» برسد.`;
    case 'LOW_DATA': return `«${a.topic}»: فقط ${fa(a.pairs)} گفت‌وگو دارد؛ داده‌ی بیشتری لازم است تا نتیجه قابل اتکا باشد.`;
    default: return a.code;
  }
}

export function renderMarkdown(readiness, {redact = true, generatedAt = null} = {}) {
  const s = readiness.summary;
  const lines = ['# گزارش آمادگی سیما برای پاسخ خودکار', ''];
  if (generatedAt) lines.push(`تاریخ تولید: ${new Date(generatedAt).toISOString().slice(0, 10)}`, '');
  lines.push(redact ? '_اطلاعات شخصی (ایمیل، لینک، آیدی، شماره‌های بلند) در این گزارش ماسک شده است._' : '_⚠️ ماسک‌کردن اطلاعات شخصی خاموش است؛ این گزارش را با دیگران به‌اشتراک نگذارید._', '',
    '## خلاصه', '',
    `- تعامل بررسی‌شده: ${fa(s.interactions)}`,
    `- جفت «پرسش و پاسخ واقعی انسان»: ${fa(s.pairs)} (به موضوعی نسبت داده‌شده: ${fa(s.assigned)}، بدون موضوع: ${fa(s.unassigned)})`,
    `- موضوع پیداشده: ${fa(s.topics)}، که ${fa(s.humanOnlyTopics)} تای آن پرخطر است و همیشه با انسان می‌ماند`,
    `- سهم پرسش‌های پرخطر در میان موضوع‌های پیداشده: ${pct(s.blockedShare)}`,
    s.eligibleForAuto.length ? `- با شواهد فعلی این موضوع‌ها می‌توانند به مرحله‌ی خودکار برسند: ${s.eligibleForAuto.join('، ')}` : '- هنوز هیچ موضوعی شواهد کافی برای مرحله‌ی خودکار ندارد.', '',
    '## موضوع‌ها', '',
    '| موضوع | ریسک | جفت | پوشش | پذیرفته/ویرایش/ردشده | اعتماد‌به‌نفس | دانش تأییدشده | بالاترین مرحله‌ی قابل‌دسترس |', '|---|---|---:|---:|---|---|---:|---|');
  for (const t of readiness.topics) {
    const conf = t.confidence.status === 'measured' ? pct(t.confidence.confidence) : `نمونه‌ی کافی نیست (${fa(Math.round(t.confidence.effectiveN))} از ۳۰)`;
    lines.push(`| ${rd(redact, t.label)} | ${t.neverAuto ? 'پرخطر (انسانی)' : t.riskClass === 'medium' ? 'متوسط' : 'کم'} | ${fa(t.pairs)} | ${t.neverAuto ? '—' : pct(t.coverage)} | ${fa(t.outcomes.accepted)}/${fa(t.outcomes.edited)}/${fa(t.outcomes.rejected)} | ${t.neverAuto ? '—' : conf} | ${fa(t.knowledgeApproved)} | ${STAGE[t.reachable.stage]} |`);
  }
  lines.push('', '## کارهای پیشنهادی (به ترتیب اولویت)', '');
  readiness.actions.forEach((a, i) => lines.push(`${i + 1}. ${actionText(a, redact)}`));
  if (!readiness.actions.length) lines.push('کار فوری‌ای پیدا نشد.');
  lines.push('', '## چطور خوانده شود', '',
    '- «پوشش» یعنی چند درصد پرسش‌های غیرپرخطر یک پاسخ تأییدشده‌ی مرتبط پیدا می‌کند. «ردشده» یعنی پاسخ دانش با پاسخ واقعی شما فرق داشت (یا عددی داشت که شما نگفته بودید).',
    '- «بالاترین مرحله‌ی قابل‌دسترس» یک **پیش‌بینی** از شواهد بازپخش است، با فرض اینکه اطلاعات لازم تعریف و کلیدها روشن شوند؛ شرط‌های زنده (تأییدبودن اطلاعات مشتری، مهلت پیام، سقف‌ها و…) همچنان لازم‌اند.',
    '- برچسب موضوع‌ها خودکار است و ناقص؛ در برنامه نامشان را اصلاح کنید.',
    '- این گزارش روی خروجی شما محاسبه شده؛ هیچ پیامی نفرستاده و به هیچ سرویسی وصل نشده است.', '');
  return lines.join('\n');
}

// Audit an export file BEFORE it is shared or analysed: anything personal that the SQL export should have masked is reported.
// Returns {ok, findings:[{kind, where}]}; it never prints the offending text itself.
const ALLOWED = new Set(['id', 'customer_id', 'channel', 'direction', 'kind', 'occurred_at', 'body']);
const LEAKS = [['EMAIL', /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/], ['LINK', /(?:https?:\/\/|www\.)\S+/i], ['HANDLE', /(^|[\s(])@[A-Za-z0-9._]{2,}/], ['LONG_DIGITS', RULES[3][0]]];
export function auditExport(data) {
  const findings = [];
  const interactions = Array.isArray(data?.interactions) ? data.interactions : [];
  interactions.forEach((row, i) => {
    for (const key of Object.keys(row || {})) if (!ALLOWED.has(key)) findings.push({kind: 'UNEXPECTED_FIELD', where: `interactions[${i}].${key}`});
    if (!/^[0-9a-f]{32}$/.test(String(row?.id)) || !/^[0-9a-f]{32}$/.test(String(row?.customer_id))) findings.push({kind: 'IDENTIFIER_NOT_HASHED', where: `interactions[${i}]`});
    for (const [kind, pattern] of LEAKS) { pattern.lastIndex = 0; if (pattern.test(String(row?.body ?? ''))) findings.push({kind, where: `interactions[${i}].body`}); }
  });
  // Knowledge is text the owner wrote and approved; a phone number or link there is business information, flagged for a look.
  (Array.isArray(data?.knowledge) ? data.knowledge : []).forEach((k, i) => {
    for (const [kind, pattern] of LEAKS) { pattern.lastIndex = 0; if (pattern.test(`${k?.question ?? ''}\n${k?.answer ?? ''}`)) findings.push({kind: `KNOWLEDGE_${kind}`, where: `knowledge[${i}]`}); }
  });
  return {ok: findings.length === 0, findings};
}

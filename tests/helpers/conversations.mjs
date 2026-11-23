// Synthetic Persian support conversations for CIMA discovery/backtest tests. No real customer data.
export const NOW = Date.parse('2026-11-22T09:00:00Z');
const H = 3600e3;
export const HOURS_REPLY = 'ساعت کاری ما شنبه تا چهارشنبه ۹ تا ۱۷ است';
export const SHIP_REPLY = 'ارسال به همه‌ی شهرستان‌ها با پست پیشتاز انجام می‌شود';
export const HOURS_Q = ['ساعت کاری شما چیه؟', 'ساعت کاری فروشگاه چطوریه؟', 'شما چه ساعتی کار می‌کنید؟', 'ساعت کاری‌تون چنده؟', 'ساعت کاری شما تا چند است؟', 'تا چه ساعتی پاسخگو هستید؟', 'ساعت کار شما کی هست؟', 'ساعت پاسخگویی چیه؟'];
export const SHIP_Q = ['ارسال به شهرستان دارید؟', 'ارسال به شیراز انجام میشه؟', 'آیا به شهرهای دیگه ارسال می‌کنید؟', 'ارسال به شهرستان‌ها چطوره؟', 'برای ارسال به تبریز چطور باید اقدام کنم؟', 'به شهرستان هم می‌فرستید؟', 'ارسال به مشهد امکان داره؟', 'ارسال برای شهرستان‌ها هست؟'];
export const PRICE_Q = ['قیمت این محصول چنده؟', 'قیمت امروز مدل مشکی چقدره؟', 'قیمت این کفش چنده؟', 'قیمت کیف چقدره؟', 'قیمت لباس چنده؟', 'قیمت امروز کت چقدره؟'];

// Builds rows shaped like crm_interactions. `questions` are [text, replyText|null].
export function conversations(spec, {channel = 'instagram', startId = 0} = {}) {
  const rows = []; let n = startId, c = startId;
  const at = hoursAgo => new Date(NOW - hoursAgo * H).toISOString();
  for (const [question, reply, hoursAgo = 50 + c] of spec) {
    const customer = `c${++c}`;
    rows.push({id: `i${++n}`, customer_id: customer, channel, direction: 'inbound', kind: 'message', body: question, occurred_at: at(hoursAgo), created_at: at(hoursAgo)});
    if (reply) rows.push({id: `i${++n}`, customer_id: customer, channel, direction: 'outbound', kind: 'message', body: reply, occurred_at: at(hoursAgo - 0.5), created_at: at(hoursAgo - 0.5)});
  }
  return rows;
}
export const standard = ({hours = HOURS_REPLY, ship = SHIP_REPLY} = {}) => [
  ...conversations(HOURS_Q.map(q => [q, hours])),
  ...conversations(SHIP_Q.map(q => [q, ship]), {startId: 100}),
  ...conversations(PRICE_Q.map((q, i) => [q, `امروز ${1000 + i * 7} هزار تومان است`]), {startId: 200}),
];
export const knowledge = (answer, question = 'ساعت کاری شما چیه') => [{id: 'k1', title: 'ساعت کاری', question, answer, status: 'approved', revision: 1}];

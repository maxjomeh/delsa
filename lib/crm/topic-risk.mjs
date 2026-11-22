// Topic-level risk for CIMA autonomy. Pure and deterministic; message text is DATA, never instructions.
// Extends the grounding risk rules (price, stock, technical fit, financial commitment, sensitive domain,
// private data) with the categories that must never be answered automatically, however high a
// topic's measured confidence is: complaints, negotiation, order changes, data requests, and messages
// too short or vague to understand.
import {assessRisk, tokens} from './cima-grounding.mjs';

const EXTRA_RULES = [
  [/شکایت|شاکی|ناراضی|نارضایتی|افتضاح|بدترین|کلاهبردار|مسخره|رضایت ندارم|پیگیری حقوقی/u, 'COMPLAINT'],
  [/چانه|ارزان‌?تر|ارزون‌?تر|کمتر بدی|تخفیف بیشتر|قیمت نهایی/u, 'NEGOTIATION'],
  [/لغو|کنسل|انصراف از|تغییر سفارش|ویرایش سفارش|آدرس.{0,12}(عوض|تغییر)/u, 'ORDER_CHANGE'],
  [/حذف (اطلاعات|حساب|داده)|پاک (کردن|کنید) (حساب|اطلاعات)|حریم خصوصی/u, 'DATA_REQUEST'],
];

// Locked: the owner cannot switch these to automatic; they are the cases where a wrong answer costs real money or trust.
export const LOCKED_BLOCKS = Object.freeze([
  'LIVE_PRICE_UNVERIFIED', 'LIVE_STOCK_UNVERIFIED', 'TECHNICAL_FIT_UNVERIFIED', 'FINANCIAL_COMMITMENT', 'COMPLAINT',
]);

export function assessTopicRisk(message, {doNotContact = false} = {}) {
  const raw = String(message || '');
  const base = assessRisk(raw, {doNotContact});
  const blocks = new Set(base.blocks);
  for (const [test, label] of EXTRA_RULES) if (test.test(raw)) blocks.add(label);
  // Too little text to know what the customer means: never guess.
  if (raw.trim() && tokens(raw).length < 2 && !/\d/.test(raw)) blocks.add('AMBIGUOUS_OR_TOO_SHORT');
  const list = [...blocks];
  return {riskLevel: list.length ? 'high' : 'low', blocks: list, locked: list.filter(code => LOCKED_BLOCKS.includes(code))};
}

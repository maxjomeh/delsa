// Shadow mode: CIMA drafts silently, a human answers for real, and we compare. Nothing is sent.
// The comparison produces the same outcome labels the confidence engine learns from.
import {tokens} from './cima-grounding.mjs';

const DIGITS = {'۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'};
export const numbersIn = text => (String(text || '').replace(/[۰-۹٠-٩]/g, d => DIGITS[d]).replace(/[,٬،]/g, '').match(/\d+(?:\.\d+)?/g) || []);

export function similarity(a, b) {
  const A = new Set(tokens(a)), B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const token of A) if (B.has(token)) shared += 1;
  return (2 * shared) / (A.size + B.size);   // Dice coefficient
}

// accepted: a human would have sent it as is; edited: close but changed; rejected: a different answer.
// A number (price, hours, quantity, phone) in the draft that the human did not say is always a rejection:
// a fluent answer with an invented figure is the failure we must never learn to trust.
export function compareDraftToHuman(draft, humanReply, {acceptAt = 0.8, editAt = 0.45} = {}) {
  if (!String(draft || '').trim() || !String(humanReply || '').trim()) return {outcome: 'rejected', similarity: 0, reason: 'EMPTY'};
  const human = new Set(numbersIn(humanReply));
  const invented = numbersIn(draft).filter(n => !human.has(n));
  const score = Math.round(similarity(draft, humanReply) * 1000) / 1000;
  if (invented.length) return {outcome: 'rejected', similarity: score, reason: 'NUMBER_NOT_IN_HUMAN_REPLY'};
  if (score >= acceptAt) return {outcome: 'accepted', similarity: score, reason: 'MATCHES_HUMAN_REPLY'};
  if (score >= editAt) return {outcome: 'edited', similarity: score, reason: 'PARTIAL_MATCH'};
  return {outcome: 'rejected', similarity: score, reason: 'DIFFERENT_ANSWER'};
}

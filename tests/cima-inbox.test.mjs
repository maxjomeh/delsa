import assert from 'node:assert/strict';
import test from 'node:test';
import {buildConversations, inboxTotals} from '../lib/crm/inbox.mjs';

const customers = [
  {id: 'a', name: 'فروشگاه آفتاب', instagram: 'aftab', phone: '09123456789', city: 'تهران'},
  {id: 'b', name: 'شرکت بهار', instagram: 'bahar'},
  {id: 'c', name: 'پرونده بدون پیام'}
];
const items = [
  {id: '2', customer_id: 'a', channel: 'instagram', direction: 'outbound', kind: 'offer', body: 'پیشنهاد آماده است', occurred_at: '2026-10-18T09:00:00Z'},
  {id: '1', customer_id: 'a', channel: 'instagram', direction: 'inbound', kind: 'message', body: 'قیمت قطعه چنده؟', occurred_at: '2026-10-18T08:00:00Z'},
  {id: '3', customer_id: 'a', channel: 'instagram', direction: 'inbound', kind: 'message', body: 'موجود است؟', occurred_at: '2026-10-18T10:00:00Z'},
  {id: '4', customer_id: 'b', channel: 'phone', direction: 'outbound', kind: 'call', body: 'تماس ثبت شد', occurred_at: '2026-10-18T11:00:00Z'},
  {id: '5', customer_id: 'unknown', channel: 'instagram', direction: 'inbound', body: 'no owner', occurred_at: '2026-10-18T12:00:00Z'}
];

test('groups messages by customer, orders timelines and excludes orphan records', () => {
  const rows = buildConversations(customers, items);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.find(r => r.id === 'a').messages.map(m => m.id), ['1', '2', '3']);
  assert.equal(rows[0].id, 'b');
  assert.equal(rows.find(r => r.id === 'a').needsResponse, true);
  assert.equal(rows.find(r => r.id === 'b').needsResponse, false);
});
test('filters by inferred response status, source channel and Persian text', () => {
  assert.deepEqual(buildConversations(customers, items, {status: 'needs_response'}).map(r => r.id), ['a']);
  assert.deepEqual(buildConversations(customers, items, {channel: 'phone'}).map(r => r.id), ['b']);
  assert.deepEqual(buildConversations(customers, items, {query: 'موجود'}).map(r => r.id), ['a']);
  assert.deepEqual(buildConversations(customers, items, {query: 'AFTAB'}).map(r => r.id), ['a']);
});
test('never presents unrecorded customers as active threads', () => {
  const totals = inboxTotals(buildConversations(customers, items));
  assert.deepEqual(totals, {conversations: 2, needsResponse: 1, loggedMessages: 4});
});
test('empty and malformed timestamps do not crash rendering', () => {
  const rows = buildConversations([{id: 'a', name: 'الف'}], [{id: 'x', customer_id: 'a', direction: 'inbound', channel: 'manual', body: '', occurred_at: 'invalid'}]);
  assert.equal(rows[0].lastAt, 0);
});

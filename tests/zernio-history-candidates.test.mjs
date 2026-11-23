import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {historyCandidates, candidatesFromEvents} from '../lib/crm/zernio-history.mjs';
import {fakeDb} from './helpers/fake-db.mjs';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const T1 = '11111111-1111-4111-8111-111111111111', T2 = '22222222-2222-4222-8222-222222222222';
const A = 'a'.repeat(24), B = 'b'.repeat(24), C = 'c'.repeat(24);
const ev = (tenant_id, account_id, platform, profile_id = 'p' + account_id.slice(0, 5)) => ({tenant_id, profile_id, account_id, payload: {account: {platform}}});

test('with the database function, only (tenant, profile, account) pairs are fetched — never event payloads', async () => {
  const db = fakeDb({}, {rpc: {crm_zernio_history_candidates: () => ({data: [{tenant_id: T1, profile_id: 'pa', account_id: A}, {tenant_id: T2, profile_id: 'pb', account_id: B}], error: null})}});
  assert.deepEqual(await historyCandidates(db), [{tenant_id: T1, profile_id: 'pa', account_id: A}, {tenant_id: T2, profile_id: 'pb', account_id: B}]);
  assert.deepEqual(db.calls.map(c => c.table), ['rpc:crm_zernio_history_candidates'], 'no select on crm_zernio_events');
});
test('rows the database returns are still validated, and extra fields never pass through', async () => {
  const db = fakeDb({}, {rpc: {crm_zernio_history_candidates: () => ({data: [
    {tenant_id: T1, profile_id: 'pa', account_id: A, payload: {secret: 1}},
    {tenant_id: T1, profile_id: 'pa', account_id: 'not-hex'}, {tenant_id: null, profile_id: 'pa', account_id: B}, {tenant_id: T1, profile_id: '', account_id: C}, null], error: null})}});
  assert.deepEqual(await historyCandidates(db), [{tenant_id: T1, profile_id: 'pa', account_id: A}]);
});
test('before the migration is applied the previous query is used, unchanged (PGRST202 or 42883)', async () => {
  for (const code of ['PGRST202', '42883']) {
    const db = fakeDb({crm_zernio_events: [
      {event_id: '1', event_type: 'message.received', received_at: '2026-11-02', ...ev(T1, A, 'instagram')},
      {event_id: '2', event_type: 'account.connected', received_at: '2026-11-01', ...ev(T1, B, 'facebook')},
    ]}, {rpc: {crm_zernio_history_candidates: () => ({data: null, error: {code, message: 'missing'}})}});
    const out = await historyCandidates(db);
    assert.deepEqual(out.map(r => r.account_id).sort(), [A, B]);
    const select = db.calls.find(c => c.table === 'crm_zernio_events');
    assert.ok(select && select.op === 'select');
  }
});
test('any other database error is not swallowed (a broken function must not silently fall back every 2 minutes)', async () => {
  const db = fakeDb({}, {rpc: {crm_zernio_history_candidates: () => ({data: null, error: {code: '57014', message: 'timeout'}})}});
  await assert.rejects(historyCandidates(db), e => e.code === '57014');
  assert.equal(db.calls.filter(c => c.table === 'crm_zernio_events').length, 0);
});
test('the previous selection rules are preserved: Instagram/Facebook only, valid 24-hex ids, newest event wins, one per tenant+account', () => {
  const rows = [
    {...ev(T1, A, 'instagram', 'newest')}, {...ev(T1, A, 'instagram', 'older')},          // newest first: the first row wins
    ev(T1, B, 'whatsapp'), ev(T1, 'short', 'instagram'), ev(T2, A, 'facebook'), {tenant_id: T1, profile_id: 'x', account_id: C, payload: {}},
  ];
  assert.deepEqual(candidatesFromEvents(rows), [
    {tenant_id: T1, profile_id: 'newest', account_id: A}, {tenant_id: T2, profile_id: 'paaaaa', account_id: A}]);
  assert.deepEqual(candidatesFromEvents(null), []);
});
test('the route and migration: no payload download in the route, database function is read-only and service-role only', () => {
  const route = read('../app/api/crm/zernio/history/cron/route.js');
  assert.match(route, /historyCandidates\(db\)/);
  assert.doesNotMatch(route, /from\('crm_zernio_events'\)\.select/, 'payloads are not downloaded by the route');
  const sql = read('../supabase/migrations/20261125_zernio_history_candidates.sql').split('\n').map(l => l.replace(/--.*$/, '')).join('\n');
  assert.doesNotMatch(sql, /\b(insert|update|delete|drop|alter|truncate)\b/i);
  assert.match(sql, /language sql stable security definer set search_path = ''/);
  assert.match(sql, /limit 3000/);
  assert.match(sql, /revoke all on function public\.crm_zernio_history_candidates\(\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.crm_zernio_history_candidates\(\) to service_role/);
});

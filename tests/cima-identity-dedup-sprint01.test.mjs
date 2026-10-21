import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildConversations,inboxTotals} from '../lib/crm/inbox.mjs';
import {uniqueDisplayMessages} from '../lib/crm/dedupe-display.mjs';
const migration=readFileSync('supabase/migrations/20261021_cima_verified_identity_projection.sql','utf8');
const inbox=readFileSync('lib/crm/inbox.mjs','utf8');
const avatar=readFileSync('components/crm/HumanReviewWorkspace.js','utf8');
const one={tenant_id:'ten',customer_id:'cust',channel:'instagram',direction:'inbound',kind:'message',body:'سلام',occurred_at:'2026-10-21T13:00:00.321Z'};
test('canonical inbox collapses exact same timestamp Zernio replays in visible totals',()=>{
 const a={...one,id:'a',external_event_id:'zernio-msg:111'},b={...one,id:'b',external_event_id:'zernio-msg:222'};
 const rows=buildConversations([{id:'cust',name:'کاربر'}],[a,b]);
 assert.equal(rows.length,1);assert.equal(rows[0].messages.length,1);
 assert.equal(inboxTotals(rows).loggedMessages,1);
});
test('different timestamps do not collapse real messages',()=>{
 const a={...one,id:'a',external_event_id:'zernio-msg:111'},b={...one,id:'b',external_event_id:'zernio-msg:222',occurred_at:'2026-10-21T13:00:00.322Z'};
 assert.equal(buildConversations([{id:'cust',name:'کاربر'}],[a,b])[0].count,2);
});
test('tenant/customer/channel/direction/body separation prevents cross-customer merging',()=>{
 const a={...one,id:'a',external_event_id:'zernio-msg:111'};
 for(const patch of [{tenant_id:'other'},{customer_id:'other'},{channel:'whatsapp'},{direction:'outbound'},{body:'سلام!'}]){
  const b={...one,id:'b',external_event_id:'zernio-msg:222',...patch};
  assert.equal(uniqueDisplayMessages([a,b]).length,2);
 }
});
test('manual records never collapse by provider-only heuristic',()=>{
 const a={...one,id:'a',external_event_id:null},b={...one,id:'b',external_event_id:null};
 assert.equal(uniqueDisplayMessages([a,b]).length,2);
});
test('identity maintains tenant-isolation and human-entered name/phone/fields',()=>{
 assert.match(migration,/c\.id=NEW\.customer_id AND c\.tenant_id=NEW\.tenant_id/);
 assert.match(migration,/COALESCE\(c\.instagram,''\)=''/);
 assert.match(migration,/ELSE c\.name END/);
 assert.doesNotMatch(migration,/DELETE FROM|MERGE INTO|INSERT INTO public\.crm_customers/i);
 assert.match(migration,/CREATE OR REPLACE FUNCTION public\.sima_sync_social_identity/);
 assert.doesNotMatch(migration,/CREATE TRIGGER/);
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.sima_sync_social_identity/);
});
test('backfill changes only generated labels with an account-scoped known handle',()=>{
 assert.match(migration,/FROM public\.crm_zernio_contacts z/);
 assert.match(migration,/c\.id=z\.customer_id AND c\.tenant_id=z\.tenant_id/);
 assert.match(migration,/c\.name ~ '\^مخاطب /);
});
test('human inbox image failure retains readable initials',()=>{
 assert.match(avatar,/onError=\{\(\)=>setFailed\(true\)\}/);
 assert.match(avatar,/customer\?\.name\?\.slice\(0,1\)/);
});
test('duplicate reducer resides in core inbox projection',()=>assert.match(inbox,/for \(const item of uniqueDisplayMessages\(interactions\)\)/));

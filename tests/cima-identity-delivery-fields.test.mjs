import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {uniqueDisplayMessages} from '../lib/crm/dedupe-display.mjs';
import {discoverFields,fieldCandidates} from '../lib/crm/adaptive-fields.mjs';
const file=x=>readFileSync(x,'utf8');
test('identical Zernio render duplicates collapse but do not delete underlying events',()=>{
 const first={id:'a',tenant_id:'t',customer_id:'c',kind:'message',channel:'instagram',direction:'inbound',body:'سلام',occurred_at:'2026-10-20T08:00:00Z',external_event_id:'zernio-msg:abc'};
 const other={...first,id:'b',external_event_id:'zernio-msg:def'};
 const outbound={...first,id:'c',direction:'outbound'};
 const later={...first,id:'d',occurred_at:'2026-10-20T08:00:01Z'};
 assert.deepEqual(uniqueDisplayMessages([first,other,outbound,later]).map(x=>x.id),['a','c','d']);
 assert.equal([first,other,outbound,later].length,4);
});
test('unstructured word salads cannot create new customer fields',()=>{
 const rows=['a','b','c','d','e','f'].map((c,i)=>({id:'msg-'+i,customer_id:c,kind:'message',direction:'outbound',body:'اطلاعات جاده صاف چیست؟'}));
 assert.equal(discoverFields(rows).length,0);
});
test('known cross-customer vehicle inquiry can propose one semantic field',()=>{
 const q=['a','b','c','d','e'].map((c,i)=>({id:'m'+i,customer_id:c,kind:'message',direction:'outbound',body:'اسم مدل کشنده شما چیه؟'}));
 const result=discoverFields(q);
 assert.ok(result.some(x=>x.label==='مدل کشنده'&&x.key==='truck_model'));
});
test('real send can resume only unclaimed pending outbox; unknown remains one-shot',()=>{
 const sql=file('supabase/migrations/20261020_cima_send_pending_resume.sql');
 const ui=file('components/crm/HumanReviewWorkspace.js');
 assert.match(sql,/s\.status='pending' and s\.attempt_count=0/);
 assert.match(sql,/s\.body=btrim\(p_body\)/);
 assert.match(sql,/turn_already_has_send/);
 assert.match(ui,/lastSend\.status==='pending'&&lastSend\.attempt_count===0/);
 assert.match(ui,/window\.confirm/);
});
test('social identity backfill does not overwrite human-entered display names',()=>{
 const sql=file('supabase/migrations/20261020_cima_social_identity_repair.sql');
 assert.match(sql,/c\.name in \('','مخاطب شبکه اجتماعی'\)/);
 assert.match(sql,/sima_sync_social_identity/);
 assert.match(sql,/customer_id/);
});
test('CRM UI consolidates nav and exposes reviewed learning and customer table',()=>{
 const work=file('components/crm/SimaWorkspace.js');
 const ui=file('components/crm/InformationWorkspace.js');
 const adapt=file('components/crm/AdaptiveInformationPanels.js');
 const grouped=[...work.matchAll(/\{id:'\w+',label:'[^']*',icon:\w+,items:\[([^\]]+)\]/g)].flatMap(m=>m[1].match(/'(\w+)'/g).map(x=>x.replace(/'/g,'')));
 const known=[...work.match(/const sections=\{([^}]+)\}/)[1].matchAll(/(\w+):'/g)].map(m=>m[1]);
 assert.equal([...work.matchAll(/\{id:'\w+',label:/g)].length,5,'navigation has five groups');
 assert.deepEqual([...grouped].sort(),[...known].sort(),'every CRM section is reachable from exactly one group');
 assert.match(work,/uniqueDisplayMessages\(all\)/);
 assert.match(ui,/CustomerFieldMatrix/);
 assert.match(ui,/LearningSuggestionPanel/);
 assert.match(adapt,/api\/crm\/learning/);
 assert.match(adapt,/در انتظار تأیید|منتظر تأیید/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {historyEvent,safeJob,nextHistoryPage} from '../lib/crm/zernio-history.mjs';
import {discoverFields,explicitPhone,fieldCandidates} from '../lib/crm/adaptive-fields.mjs';
const job={tenant_id:'11111111-1111-4111-8111-111111111111',profile_id:'1234567890abcdef12345678',account_id:'abcdef123456789012345678',status:'running',conversation_queue:[],queue_index:0,completed_conversations:0,imported_messages:0};
const conv={id:'opaque_thread-id',participantId:'993222',participantName:'کاربر نمونه',participantUsername:'sample_user',participantPicture:'https://example.com/pic.jpg',platform:'instagram',accountId:job.account_id};
const msg={id:'opaque-message',message:'سلام',direction:'incoming',createdAt:'2026-10-19T10:00:00Z'};
test('history normalization uses deterministic event ids and accurate participant/profile',()=>{
 const a=historyEvent(job,conv,msg),b=historyEvent(job,conv,msg);
 assert.deepEqual(a,b);
 assert.equal(a.event_type,'message.received');
 assert.equal(a.payload.conversation.participantPicture,conv.participantPicture);
 assert.equal(a.payload.message.id,msg.id);
 assert.match(a.event_id,/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/);
 assert.equal(historyEvent(job,conv,{...msg,isDeleted:true}),null);
 assert.equal(historyEvent(job,conv,{...msg,direction:'ambiguous'}),null);
});
test('history worker rejects unknown conversations and exposed state excludes cursors',()=>{
 assert.equal(historyEvent(job,{...conv,participantId:''},msg),null);
 assert.equal('conversation_cursor' in safeJob({...job,conversation_cursor:'secret_cursor'}),false);
});
test('contact phone is extracted only from unambiguous self-labeled statements',()=>{
 assert.equal(explicitPhone('شماره تماس من: ۰۹۱۲۳۴۵۶۷۸۹'),'09123456789');
 assert.equal(explicitPhone('09123456789'),null);
 assert.equal(explicitPhone('شماره تماس من 09123456789 یا 09123456788'),null);
});
test('learns tenant-specific recurring question themes from distinct customers',()=>{
 const lines=[
 {id:'q1',customer_id:'u1',direction:'outbound',kind:'message',body:'اسم کشنده شما چیه؟'},
 {id:'q2',customer_id:'u2',direction:'outbound',kind:'message',body:'اسم کشنده تون رو بگید'},
 {id:'q3',customer_id:'u3',direction:'outbound',kind:'message',body:'اسم کشنده مشتری چیه؟'}
 ];
 const results=discoverFields(lines,{minOccurrences:3,minCustomers:2});
 assert.equal(results[0]?.label,'مدل کشنده');
 assert.equal(results[0]?.distinctCustomers,3);
});
test('extracts uncertain replies as review candidates, not confirmed profile values',()=>{
 const rows=[
 {id:'q1',customer_id:'u1',direction:'outbound',kind:'message',body:'اسم کشنده شما چیه؟',occurred_at:'2026-10-19T10:00:00Z'},
 {id:'a1',customer_id:'u1',direction:'inbound',kind:'message',body:'ولوو FH500',occurred_at:'2026-10-19T10:01:00Z'}
 ];
 const hits=fieldCandidates(rows,{question:'اسم کشنده شما چیه؟'});
 assert.equal(hits[0]?.value,'ولوو FH500');
 assert.equal(hits[0]?.confidence,.78);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runAutoAnswers} from '../lib/crm/auto-runner.mjs';
import {dispatchClaimed} from '../lib/crm/outbox-dispatch.mjs';
import {NOW,HOURS_REPLY} from './helpers/conversations.mjs';
import {T1,ACCOUNT,world,handlers,zernio,build,run} from './helpers/auto-fixture.mjs';
import {fakeDb} from './helpers/fake-db.mjs';

const decisions=db=>db.rows('sima_auto_answers');
const rpcNames=db=>db.calls.filter(c=>c.op==='rpc').map(c=>c.table.slice(4));
const minutes=m=>new Date(NOW-m*60000).toISOString();

test('mode OFF does nothing at all: no query, no decision, no call',async()=>{
 const db=build(),z=zernio();
 const r=await runAutoAnswers({...run(db,{mode:'off'}),request:z.request});
 assert.equal(r.skipped,'mode_off');assert.equal(db.calls.length,0);assert.equal(z.calls.length,0);
 assert.equal((await runAutoAnswers({...run(db,{mode:'anything-else'}),request:z.request})).skipped,'mode_off');
});
test('tenant switch off, paused, or no automatic topic: skipped before looking at any conversation',async()=>{
 for(const [label,seed,expected] of [
  ['switch off',{extra:{sima_autonomy_settings:[{tenant_id:T1,auto_enabled:false,paused_at:null}]}},'tenant_off'],
  ['paused',{extra:{sima_autonomy_settings:[{tenant_id:T1,auto_enabled:true,paused_at:minutes(1)}]}},'tenant_off'],
  ['no settings',{extra:{sima_autonomy_settings:[]}},'tenant_off']]){
  const db=build(seed),z=zernio();
  const r=await runAutoAnswers({...run(db),request:z.request});
  assert.equal(r.skipped,expected,label);assert.equal(decisions(db).length,0,label);assert.equal(z.calls.length,0,label);
 }
 const db=build();db.rows('sima_topics')[0].stage='suggest';const z=zernio();
 assert.equal((await runAutoAnswers({...run(db),request:z.request})).skipped,'no_automatic_topics');
 const never=build();never.rows('sima_topics')[0].never_auto=true;
 assert.equal((await runAutoAnswers({...run(never),request:z.request})).skipped,'no_automatic_topics');
 assert.equal(z.calls.length,0);
});
test('DRY RUN decides and records the answer it WOULD send, and sends nothing',async()=>{
 const db=build(),z=zernio();
 const r=await runAutoAnswers({...run(db,{mode:'dry_run'}),request:z.request});
 assert.equal(r.dryRun,1);assert.equal(r.sent,0);assert.equal(z.calls.length,0);assert.deepEqual(rpcNames(db),[]);
 const [d]=decisions(db);
 assert.deepEqual([d.status,d.mode,d.answer_text,d.knowledge_entry_id,d.knowledge_revision],['dry_run','dry_run',HOURS_REPLY,'k1',3]);
 assert.equal(d.review_id,'r1');assert.equal(d.conversation_version,1);assert.ok(d.confidence_lower_bound>=0.9);
 assert.equal(db.rows('sima_message_outbox').length,0);
});
test('LIVE: the decision is recorded BEFORE any external call, then prepare -> claim -> exactly one dispatch -> finalize -> sent',async()=>{
 const db=build(),z=zernio();
 const r=await runAutoAnswers({...run(db),request:z.request});
 assert.equal(r.sent,1);assert.equal(r.examined,1);
 const order=db.calls.filter(c=>(c.table==='sima_auto_answers'&&c.op==='insert')||c.op==='rpc').map(c=>c.table==='sima_auto_answers'?'decision':c.table.slice(4));
 assert.deepEqual(order,['decision','sima_prepare_auto_send','sima_claim_auto_send','sima_finalize_human_send']);
 assert.equal(z.calls.length,1,'one single provider attempt');
 const [call]=z.calls;
 assert.equal(call.method,'POST');assert.equal(call.path,'/v1/inbox/conversations/conv1/messages');
 assert.deepEqual(call.options.body,{accountId:ACCOUNT,message:HOURS_REPLY});assert.equal(call.options.idempotencyKey,'ob1');
 assert.equal(decisions(db)[0].status,'sent');assert.equal(decisions(db)[0].mode,'live');
});
test('exactly once: running again never sends the same turn twice, even if the first run was cut short',async()=>{
 const db=build(),z=zernio();
 await runAutoAnswers({...run(db),request:z.request});
 const second=await runAutoAnswers({...run(db),request:z.request});
 assert.equal(second.examined,0);assert.equal(z.calls.length,1);assert.equal(decisions(db).length,1);
 // a crashed run left a decision row behind (no outbox yet): the unique key still stops a second decision
 const crashed=build();
 crashed.rows('sima_auto_answers').push({id:'x',tenant_id:T1,review_id:'r1',customer_id:'c1',topic_id:'topic-hours',conversation_version:1,mode:'live',status:'queued',created_at:minutes(1)});
 const z2=zernio();
 const r=await runAutoAnswers({...run(crashed),request:z2.request});
 assert.equal(r.examined,0);assert.equal(z2.calls.length,0);
 // and a lost race on insert is skipped silently
 const race=build(),z3=zernio();
 const insert=race.from;let first=true;
 race.from=table=>{const b=insert(table);if(table==='sima_auto_answers'){const original=b.insert;b.insert=payload=>{if(first){first=false;race.rows('sima_auto_answers').push({id:'other',tenant_id:T1,review_id:'r1',customer_id:'c1',topic_id:'topic-hours',conversation_version:1,mode:'live',status:'queued',created_at:minutes(1)});}return original(payload);};}return b;};
 const lost=await runAutoAnswers({...run(race),request:z3.request});
 assert.equal(lost.sent,0);assert.equal(z3.calls.length,0);
});
test('blocked conversations leave an audited decision with reasons, and never reach the database send path or Zernio',async()=>{
 const scenarios=[
  ['a price question in the turn',db=>db.rows('crm_interactions').unshift({id:'m0',tenant_id:T1,customer_id:'c1',channel:'instagram',direction:'inbound',kind:'message',body:'قیمت این چنده؟',occurred_at:minutes(12)}),'RISK:LIVE_PRICE_UNVERIFIED'],
  ['an opted-out customer',db=>{db.rows('crm_customers')[0].do_not_contact=true;},'RISK:CONTACT_OPTED_OUT'],
  ['required information not confirmed',db=>{db.rows('crm_information_states')[0].status='asked';},'MISSING_FIELD:opening_hours'],
  ['required information absent',db=>{db.tables.set('crm_information_states',[]);},'MISSING_FIELD:opening_hours'],
  ['confidence below the threshold',db=>{for(const o of db.rows('sima_topic_outcomes'))o.outcome='rejected';},'CONFIDENCE_BELOW_THRESHOLD'],
  ['too little evidence',db=>{db.tables.set('sima_topic_outcomes',db.rows('sima_topic_outcomes').slice(0,5));},'CONFIDENCE_BELOW_THRESHOLD'],
  ['no approved answer',db=>{db.rows('sima_knowledge_entries')[0].status='revoked';},'NO_APPROVED_ANSWER'],
  ['a send already pending for this turn',db=>db.rows('sima_message_outbox').push({id:'o',tenant_id:T1,review_id:'r1',conversation_version:1}),'ALREADY_HANDLED'],
 ];
 for(const [label,mutate,reason] of scenarios){
  const db=build(),z=zernio();mutate(db);
  const r=await runAutoAnswers({...run(db),request:z.request});
  assert.equal(r.blocked,1,label);assert.equal(r.sent,0,label);
  const [d]=decisions(db);
  assert.equal(d.status,'blocked',label);assert.ok(d.reasons.includes(reason),`${label}: ${d.reasons}`);assert.equal(d.answer_text,undefined,label);
  assert.equal(z.calls.length,0,label);assert.deepEqual(rpcNames(db),[],label);
 }
});
test('conversations that are not candidates are skipped silently: answered, expired window, not about an automatic topic',async()=>{
 const answered=build();answered.rows('crm_interactions').push({id:'out',tenant_id:T1,customer_id:'c1',channel:'instagram',direction:'outbound',kind:'message',body:'سلام',occurred_at:minutes(5)});
 const old=build();old.rows('sima_human_review_cases')[0].last_occurred_at=minutes(24*60);
 const future=build();future.rows('sima_human_review_cases')[0].last_occurred_at=new Date(NOW+10*60000).toISOString();
 const offTopic=build();offTopic.rows('crm_interactions')[0].body='هوا امروز خیلی خوبه؟';
 const resolved=build();resolved.rows('sima_human_review_cases')[0].state='resolved';
 const other=build();other.rows('sima_human_review_cases')[0].channel='telegram';
 for(const [label,db] of [['answered',answered],['expired window',old],['future timestamp',future],['off topic',offTopic],['already resolved',resolved],['other channel',other]]){
  const z=zernio();const r=await runAutoAnswers({...run(db),request:z.request});
  assert.equal(r.examined,0,label);assert.equal(decisions(db).length,0,label);assert.equal(z.calls.length,0,label);
 }
});
test('caps: the hourly and the per-customer limits turn into blocked decisions',async()=>{
 const hourly=build();
 for(let i=0;i<20;i++)hourly.rows('sima_auto_answers').push({id:'h'+i,tenant_id:T1,review_id:'old'+i,customer_id:'z'+i,topic_id:'topic-hours',conversation_version:1,mode:'live',status:'sent',created_at:minutes(10)});
 const z=zernio();await runAutoAnswers({...run(hourly),request:z.request});
 assert.ok(hourly.rows('sima_auto_answers').at(-1).reasons.includes('HOURLY_CAP'));assert.equal(z.calls.length,0);
 const perCustomer=build();
 for(let i=0;i<3;i++)perCustomer.rows('sima_auto_answers').push({id:'p'+i,tenant_id:T1,review_id:'prev'+i,customer_id:'c1',topic_id:'topic-hours',conversation_version:1,mode:'live',status:'sent',created_at:minutes(600)});
 await runAutoAnswers({...run(perCustomer),request:zernio().request});
 assert.ok(perCustomer.rows('sima_auto_answers').at(-1).reasons.includes('CUSTOMER_DAILY_CAP'));
 const dry=build();   // dry-run decisions do not count toward live caps
 for(let i=0;i<30;i++)dry.rows('sima_auto_answers').push({id:'d'+i,tenant_id:T1,review_id:'dr'+i,customer_id:'c1',topic_id:'topic-hours',conversation_version:1,mode:'dry_run',status:'dry_run',created_at:minutes(10)});
 const r=await runAutoAnswers({...run(dry),request:zernio().request});
 assert.equal(r.sent,1);
 const limited=build({customers:3}),zl=zernio();
 const rl=await runAutoAnswers({...run(limited),limit:2,request:zl.request});
 assert.equal(rl.examined,2);assert.equal(zl.calls.length,2);
});
test('the sender must be connected; a database refusal or a refused claim stops the send with a coded reason and no provider call',async()=>{
 const z=zernio();
 const db=build();
 let r=await runAutoAnswers({...run(db,{verifySender:async()=>false}),request:z.request});
 assert.equal(r.failed,1);assert.deepEqual(decisions(db)[0].reasons,['SENDER_NOT_CONNECTED']);assert.deepEqual(rpcNames(db),[]);
 const refused=build({}, {rpc:{sima_prepare_auto_send:()=>({data:null,error:{message:'tenant_automatic_replies_disabled'}})}});
 r=await runAutoAnswers({...run(refused),request:z.request});
 assert.equal(r.failed,1);assert.deepEqual(decisions(refused)[0].reasons,['TENANT_AUTOMATIC_REPLIES_DISABLED']);
 const unknownError=build({}, {rpc:{sima_prepare_auto_send:()=>({data:null,error:{message:'something unexpected with secrets'}})}});
 await runAutoAnswers({...run(unknownError),request:z.request});
 assert.deepEqual(decisions(unknownError)[0].reasons,['PREPARE_FAILED'],'raw database messages are never stored');
 const noClaim=build({}, {rpc:{sima_claim_auto_send:()=>({data:null,error:null})}});
 r=await runAutoAnswers({...run(noClaim),request:z.request});
 assert.equal(r.failed,1);assert.deepEqual(decisions(noClaim)[0].reasons,['CLAIM_REFUSED']);
 assert.equal(z.calls.length,0,'no provider call in any of these');
});
test('provider outcomes: accepted is sent; definite refusals are rejected; anything ambiguous is UNKNOWN and is never retried',async()=>{
 const cases=[
  ['accepted',()=>({success:true,data:{messageId:'m1'}}),'sent'],
  ['400 refusal',()=>{throw Object.assign(new Error('x'),{status:400,code:'bad_request'});},'rejected'],
  ['429 refusal',()=>{throw Object.assign(new Error('x'),{status:429});},'rejected'],
  ['503',()=>{throw Object.assign(new Error('x'),{status:503});},'unknown'],
  ['timeout',()=>{throw Object.assign(new Error('x'),{code:'ETIMEDOUT'});},'unknown'],
  ['409 in flight',()=>{throw Object.assign(new Error('x'),{status:409});},'unknown'],
  ['success without a receipt',()=>({success:true,data:{}}),'unknown'],
  ['partial failure',()=>({success:true,data:{messageId:'m',partialFailure:true}}),'unknown'],
  ['two receipts',()=>({success:true,data:{messageIds:['a','b']}}),'unknown'],
 ];
 for(const [label,script,expected] of cases){
  const db=build(),z=zernio(script);
  const r=await runAutoAnswers({...run(db),request:z.request});
  assert.equal(decisions(db)[0].status,expected,label);assert.equal(r[expected],1,label);assert.equal(z.calls.length,1,`${label}: never retried`);
 }
 const brokenFinalize=build({}, {rpc:{sima_finalize_human_send:()=>({data:null,error:{message:'db down'}})}}),z=zernio();
 await runAutoAnswers({...run(brokenFinalize),request:z.request});
 assert.equal(decisions(brokenFinalize)[0].status,'unknown','if we cannot record the outcome it is unknown, not sent');
});
test('circuit breaker: three provider failures in a row pause the tenant and stop the run',async()=>{
 const db=build({customers:4});
 const failing=()=>{throw Object.assign(new Error('x'),{status:503});};
 const z=zernio(failing);
 const r=await runAutoAnswers({...run(db),request:z.request});
 assert.equal(r.paused,true);assert.equal(z.calls.length,3,'the 4th conversation was never attempted');
 assert.ok(db.rows('sima_autonomy_settings')[0].paused_at,'the tenant is now paused');
 const next=await runAutoAnswers({...run(db),request:zernio().request});
 assert.equal(next.skipped,'tenant_off');
 // a success in between keeps it closed
 const mixed=build({customers:4});let n=0;
 const z2=zernio(()=>{n+=1;if(n===2)return {success:true,data:{messageId:'ok'}};throw Object.assign(new Error('x'),{status:503});});
 const m=await runAutoAnswers({...run(mixed),request:z2.request});
 assert.equal(m.paused,false);assert.equal(z2.calls.length,4);
});
test('every query of a run is scoped to the tenant; another tenant’s data is never read or written',async()=>{
 const seed=world({customers:2});
 seed.crm_interactions.push({id:'x1',tenant_id:'tenant-2',customer_id:'cx',channel:'instagram',direction:'inbound',kind:'message',body:'ساعت کاری شما چیه؟',occurred_at:minutes(10)});
 seed.sima_human_review_cases.push({id:'rx',tenant_id:'tenant-2',customer_id:'cx',account_id:ACCOUNT,channel:'instagram',last_occurred_at:minutes(10),state:'awaiting_human',conversation_version:1});
 const db=fakeDb(seed,{rpc:handlers()}),z=zernio();
 await runAutoAnswers({...run(db),request:z.request});
 assert.ok(db.calls.length>20);
 for(const c of db.calls){
  if(c.op==='rpc')continue;
  if(['select','update','delete'].includes(c.op))assert.ok(c.filters.some(f=>f.startsWith('eq:tenant_id=')&&f.includes(T1)),`${c.table} ${c.op} ${c.filters}`);
  else for(const row of [].concat(c.payload))assert.equal(row.tenant_id,T1,`${c.table} ${c.op}`);
 }
 assert.ok(decisions(db).every(d=>d.tenant_id===T1));
});
test('dispatch classification is the same as the human send route’s and never retries',()=>{
 const dispatch=readFileSync(new URL('../lib/crm/outbox-dispatch.mjs',import.meta.url),'utf8');
 const human=readFileSync(new URL('../app/api/crm/reviews/send/route.js',import.meta.url),'utf8');
 for(const src of [dispatch,human]){
  assert.match(src,/\[400,\s*401,\s*403,\s*422,\s*429\]/);assert.match(src,/unverified_provider_acknowledgment/);
  assert.match(src,/partialFailure/);assert.match(src,/idempotencyKey/);assert.match(src,/receipt\.length\s*<=\s*255/);
 }
 for(const file of ['outbox-dispatch','auto-runner'])assert.doesNotMatch(readFileSync(new URL(`../lib/crm/${file}.mjs`,import.meta.url),'utf8').split('\n').filter(l=>!l.trim().startsWith('//')).join('\n'),/setTimeout|setInterval|retry\s*\(|while\s*\(true\)/);
 return dispatchClaimed(async()=>({success:true,data:{messageId:'m'}}),{conversation_id:'c',account_id:'a',body:'b'},'o').then(r=>assert.deepEqual(r,{status:'accepted',providerMessageId:'m',errorCode:null}));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {discover,listTopics,describeTopics,updateTopic,setRequiredFields,replay,evaluateTopic,loadAutonomy,loadKnowledge,toEngine,loadInteractions} from '../lib/crm/topic-store.mjs';
import {fakeDb} from './helpers/fake-db.mjs';
import {NOW,HOURS_Q,HOURS_REPLY,conversations,standard,knowledge} from './helpers/conversations.mjs';

const T1='tenant-1',T2='tenant-2';
const own=(rows,tenant)=>rows.map(r=>({...r,tenant_id:tenant}));
const kb=(tenant=T1)=>own(knowledge(HOURS_REPLY),tenant);
const fields=[{tenant_id:T1,key:'opening_hours',label:'ساعت کاری',enabled:true},{tenant_id:T1,key:'city',label:'شهر',enabled:true},{tenant_id:T1,key:'legacy',label:'قدیمی',enabled:false},{tenant_id:T2,key:'secret',label:'محرمانه',enabled:true}];
const seed=(extra={})=>({
 crm_interactions:[...own(standard(),T1),...own(conversations(HOURS_Q.map(q=>['منحصر به کسب‌وکار دیگر '+q,'بله'])),T2)],
 sima_knowledge_entries:kb(),crm_field_definitions:fields,sima_topics:[],sima_topic_fields:[],sima_topic_outcomes:[],sima_topic_transitions:[],...extra,
});
const hoursTopic=db=>db.rows('sima_topics').find(t=>/ساعت/.test(t.label)||t.examples.some(e=>/ساعت/.test(e)));
const priceTopic=db=>db.rows('sima_topics').find(t=>t.never_auto);

test('every query is scoped to the caller: reads, updates, deletes carry tenant_id and writes carry only that tenant',async()=>{
 const db=fakeDb(seed());
 await discover(db,T1);
 const topic=hoursTopic(db);
 await updateTopic(db,T1,topic.id,'rename','ساعت کاری فروشگاه');
 await updateTopic(db,T1,topic.id,'activate');
 await setRequiredFields(db,T1,topic.id,['opening_hours']);
 await replay(db,T1,{now:NOW});
 await listTopics(db,T1);
 assert.ok(db.calls.length>20);
 for(const c of db.calls){
  if(['select','update','delete'].includes(c.op))assert.ok(c.filters.includes(`eq:tenant_id=${JSON.stringify(T1)}`),`${c.table} ${c.op} ${c.filters}`);
  else for(const row of [].concat(c.payload))assert.equal(row.tenant_id,T1,`${c.table} ${c.op} payload`);
 }
});

test('discover proposes topics from this tenant only; re-discovery never overwrites what the owner edited',async()=>{
 const db=fakeDb(seed());
 const first=await discover(db,T1);
 assert.deepEqual([first.ok,first.inserted,first.skipped,first.found],[true,3,0,3]);
 for(const t of db.rows('sima_topics')){assert.equal(t.tenant_id,T1);assert.equal(t.status,'proposed');assert.equal(t.stage,'learning');assert.equal(t.origin,'discovered');assert.ok(t.profile.length>0);assert.equal(t.confidence_floor,0.9);}
 assert.equal(priceTopic(db).risk_class,'high');
 const hours=hoursTopic(db);
 await updateTopic(db,T1,hours.id,'rename','ساعت کاری');
 const second=await discover(db,T1);
 assert.deepEqual([second.inserted,second.skipped],[0,3]);
 assert.equal(db.rows('sima_topics').find(t=>t.id===hours.id).label,'ساعت کاری','owner rename survives');
 assert.equal(db.rows('sima_topics').length,3);
});

test('the tenant default floor seeds new proposals',async()=>{
 const db=fakeDb(seed({sima_autonomy_settings:[{tenant_id:T1,auto_enabled:false,default_floor:0.95,paused_at:null}]}));
 await discover(db,T1);
 for(const t of db.rows('sima_topics')){assert.equal(t.confidence_floor,0.95);assert.equal(t.confidence_threshold,0.95);}
});

test('rename, activate, retire and floor changes are validated; nothing can touch another tenant’s topic',async()=>{
 const db=fakeDb(seed());
 await discover(db,T1);
 const t=hoursTopic(db);
 assert.equal((await updateTopic(db,T1,t.id,'rename','x')).error,'invalid_label');
 assert.equal((await updateTopic(db,T1,t.id,'rename','x'.repeat(121))).error,'invalid_label');
 assert.equal((await updateTopic(db,T1,t.id,'rename','  ساعت کاری  ')).topic.label,'ساعت کاری');
 assert.equal((await updateTopic(db,T1,t.id,'nonsense')).error,'invalid_action');
 assert.equal((await updateTopic(db,T2,t.id,'retire')).error,'not_found','another tenant cannot touch it');
 assert.equal((await updateTopic(db,T1,'missing','activate')).error,'not_found');
 const active=await updateTopic(db,T1,t.id,'activate');
 assert.equal(active.topic.status,'active');assert.ok(active.topic.activated_at);
 assert.equal((await updateTopic(db,T1,t.id,'activate')).error,'invalid_transition');
 for(const bad of [0.4,1,'abc',null,NaN])assert.equal((await updateTopic(db,T1,t.id,'set_floor',bad)).error,'invalid_floor',String(bad));
 const raised=await updateTopic(db,T1,t.id,'set_floor',0.95);
 assert.equal(raised.topic.confidence_floor,0.95);assert.equal(raised.topic.confidence_threshold,0.95,'threshold lifted to the floor');
 const lowered=await updateTopic(db,T1,t.id,'set_floor',0.8);
 assert.equal(lowered.topic.confidence_floor,0.8);assert.equal(lowered.topic.confidence_threshold,0.95,'a lower floor never lowers the threshold by itself');
 const retired=await updateTopic(db,T1,t.id,'retire');
 assert.equal(retired.topic.status,'retired');assert.equal(retired.topic.stage,'learning');
});

test('retiring an advanced topic demotes it and leaves an audit row',async()=>{
 const db=fakeDb(seed());
 await discover(db,T1);
 const t=hoursTopic(db);t.status='active';t.stage='suggest';
 await updateTopic(db,T1,t.id,'retire');
 const audit=db.rows('sima_topic_transitions');
 assert.equal(audit.length,1);assert.deepEqual([audit[0].from_stage,audit[0].to_stage,audit[0].reason],['suggest','learning','TOPIC_RETIRED']);
});

test('required fields: only this tenant’s enabled fields, replaced as a set, bounded',async()=>{
 const db=fakeDb(seed());
 await discover(db,T1);
 const t=hoursTopic(db);
 const ok=await setRequiredFields(db,T1,t.id,['opening_hours','city','city']);
 assert.deepEqual(ok.fields,['opening_hours','city']);
 assert.deepEqual((await listTopics(db,T1)).topics.find(x=>x.id===t.id).requiredFields,['city','opening_hours']);
 assert.equal((await setRequiredFields(db,T1,t.id,['secret'])).error,'unknown_field','another tenant’s field');
 assert.equal((await setRequiredFields(db,T1,t.id,['legacy'])).error,'unknown_field','disabled field');
 assert.equal((await setRequiredFields(db,T1,t.id,['nope'])).field,'nope');
 assert.equal((await setRequiredFields(db,T1,t.id,Array.from({length:21},(_,i)=>'k'+i))).error,'invalid_fields');
 assert.equal((await setRequiredFields(db,T1,t.id,'city')).error,'invalid_fields');
 assert.equal((await setRequiredFields(db,T2,t.id,['secret'])).error,'not_found');
 assert.deepEqual((await listTopics(db,T1)).topics.find(x=>x.id===t.id).requiredFields,['city','opening_hours'],'a refused change leaves the set intact');
 await setRequiredFields(db,T1,t.id,[]);
 assert.deepEqual((await listTopics(db,T1)).topics.find(x=>x.id===t.id).requiredFields,[]);
});

test('replay only collects evidence for ACTIVE topics, never for proposed ones; re-running is idempotent',async()=>{
 const db=fakeDb(seed());
 await discover(db,T1);
 let r=await replay(db,T1,{now:NOW});
 assert.equal(r.persisted,0);assert.equal(db.rows('sima_topic_outcomes').length,0);
 assert.ok(r.report.topics.length>0,'the report still shows proposed topics');
 const t=hoursTopic(db);
 await updateTopic(db,T1,t.id,'activate');
 r=await replay(db,T1,{now:NOW});
 assert.ok(r.persisted>=1);
 const count=db.rows('sima_topic_outcomes').length;
 for(const o of db.rows('sima_topic_outcomes')){assert.equal(o.topic_id,t.id);assert.equal(o.source,'backtest','replies before activation are historical');assert.ok(['accepted','edited','rejected'].includes(o.outcome));}
 r=await replay(db,T1,{now:NOW});
 assert.equal(r.persisted,0,'second run records nothing new');assert.equal(db.rows('sima_topic_outcomes').length,count);
});

test('after activation, new replies count as real-time shadow evidence',async()=>{
 const db=fakeDb(seed());
 await discover(db,T1);
 const t=hoursTopic(db);
 t.status='active';t.activated_at=new Date(NOW-55*3600e3).toISOString();   // activated 55 h before NOW
 await replay(db,T1,{now:NOW});
 const sources=new Set(db.rows('sima_topic_outcomes').map(o=>o.source));
 assert.ok(sources.has('shadow')&&sources.has('backtest'),[...sources].join());
 for(const o of db.rows('sima_topic_outcomes'))assert.equal(o.source,Date.parse(o.created_at)<Date.parse(t.activated_at)?'backtest':'shadow');
});

test('evaluation walks a topic learning -> shadow -> suggest only with knowledge, required fields and measured evidence; auto needs the tenant switch',async()=>{
 const rows=own(conversations(Array.from({length:40},()=>['ساعت کاری شما چیه؟',HOURS_REPLY])),T1);
 const db=fakeDb(seed({crm_interactions:rows}));
 await discover(db,T1);
 const t=db.rows('sima_topics')[0];
 await updateTopic(db,T1,t.id,'activate');
 // no required fields yet: the topic stays in learning however much evidence exists
 let r=await replay(db,T1,{now:NOW});
 assert.equal(r.evaluations[0].stage,'learning');assert.equal(r.evaluations[0].steps[0].reason,'NEEDS_KNOWLEDGE_AND_FIELDS');
 await setRequiredFields(db,T1,t.id,['opening_hours']);
 r=await replay(db,T1,{now:NOW});
 const ev=r.evaluations[0];
 assert.equal(ev.confidence.status,'measured');assert.ok(ev.confidence.confidence>=0.9);
 assert.equal(ev.stage,'suggest','autonomy switch is off: it can go no further');
 assert.deepEqual(db.rows('sima_topic_transitions').map(x=>[x.from_stage,x.to_stage,x.reason]),[['learning','shadow','READY_FOR_SHADOW'],['shadow','suggest','SHADOW_EVIDENCE_SUFFICIENT']]);
 // the tenant switches automatic replies on: the same evidence now reaches `auto`
 db.rows('sima_autonomy_settings').push({tenant_id:T1,auto_enabled:true,default_floor:0.9,paused_at:null});
 r=await replay(db,T1,{now:NOW});
 assert.equal(r.evaluations[0].stage,'auto');
 assert.equal(db.rows('sima_topic_transitions').at(-1).reason,'CONFIDENCE_AT_THRESHOLD');
 // pausing demotes on the next evaluation too (the database trigger does it instantly; this covers the app path)
 db.rows('sima_autonomy_settings')[0].paused_at=new Date().toISOString();
 r=await replay(db,T1,{now:NOW});
 assert.equal(r.evaluations[0].stage,'suggest');assert.equal(db.rows('sima_topic_transitions').at(-1).reason,'AUTO_REPLY_DISABLED');
});

test('a never-auto topic never goes past suggest, whatever the evidence',()=>{
 const row={id:'p1',tenant_id:T1,topic_key:'t_price',label:'قیمت',risk_class:'high',status:'active',stage:'suggest',never_auto:true,confidence_floor:0.9,confidence_threshold:0.9,keywords:[],examples:[],profile:[['قیم',1]],requiredFields:['opening_hours']};
 const outcomes=Array.from({length:60},(_,i)=>({id:i,tenant_id:T1,topic_id:'p1',source:'shadow',outcome:'accepted',created_at:new Date(NOW).toISOString()}));
 const db=fakeDb({sima_topics:[row],sima_topic_outcomes:outcomes,sima_topic_transitions:[]});
 return evaluateTopic(db,T1,row,{knowledge:[],autonomy:{autoEnabled:true},now:NOW}).then(r=>{assert.equal(r.stage,'suggest');assert.equal(r.steps.at(-1).reason,'NEVER_AUTO_TOPIC');});
});

test('when the database refuses a stage change, the stage is kept and nothing is audited as a transition',async()=>{
 const rows=own(conversations(Array.from({length:40},()=>['ساعت کاری شما چیه؟',HOURS_REPLY])),T1);
 const db=fakeDb(seed({crm_interactions:rows}),{refuse:{}});
 await discover(db,T1);
 const t=db.rows('sima_topics')[0];
 await updateTopic(db,T1,t.id,'activate');await setRequiredFields(db,T1,t.id,['opening_hours']);
 const refusing=fakeDb({...Object.fromEntries(db.tables)},{refuse:{'sima_topics.update':'tenant_automatic_replies_disabled'}});
 const row={...(await listTopics(refusing,T1)).topics[0]};
 const r=await evaluateTopic(refusing,T1,row,{knowledge:kb(),autonomy:{autoEnabled:true},now:NOW});
 assert.equal(r.stage,'learning');assert.equal(r.steps[0].reason,'REFUSED_BY_DATABASE');assert.equal(refusing.rows('sima_topic_transitions').length,0);
});

test('autonomy settings: off by default, paused means off, floor falls back to 0.90',async()=>{
 assert.deepEqual(await loadAutonomy(fakeDb({}),T1),{autoEnabled:false,floor:0.9});
 const on=fakeDb({sima_autonomy_settings:[{tenant_id:T1,auto_enabled:true,default_floor:0.93,paused_at:null}]});
 assert.deepEqual(await loadAutonomy(on,T1),{autoEnabled:true,floor:0.93});
 const paused=fakeDb({sima_autonomy_settings:[{tenant_id:T1,auto_enabled:true,default_floor:0.93,paused_at:'2026-11-22T00:00:00Z'}]});
 assert.equal((await loadAutonomy(paused,T1)).autoEnabled,false);
});

test('interaction loading is paged and reports truncation instead of silently dropping data',async()=>{
 const many=Array.from({length:4100},(_,i)=>({id:'r'+i,tenant_id:T1,customer_id:'c',channel:'instagram',direction:'inbound',kind:'message',body:'x',created_at:new Date(NOW-i*1000).toISOString()}));
 const r=await loadInteractions(fakeDb({crm_interactions:many}),T1);
 assert.equal(r.rows.length,4000);assert.equal(r.truncated,true);
 const small=await loadInteractions(fakeDb({crm_interactions:many.slice(0,10)}),T1);
 assert.equal(small.rows.length,10);assert.equal(small.truncated,false);
 assert.equal(toEngine({id:'1',topic_key:'k',confidence_floor:'0.900',confidence_threshold:'0.920',never_auto:null}).threshold,0.92);
});

test('describeTopics gives the UI each topic with its measured confidence, required fields and no heavy profile, for this tenant only',async()=>{
 const rows=own(conversations(Array.from({length:40},()=>['ساعت کاری شما چیه؟',HOURS_REPLY])),T1);
 const db=fakeDb(seed({crm_interactions:rows}));
 await discover(db,T1);
 const t=db.rows('sima_topics')[0];
 await updateTopic(db,T1,t.id,'activate');await setRequiredFields(db,T1,t.id,['opening_hours']);await replay(db,T1,{now:NOW});
 // another tenant's evidence must never leak into this view
 db.rows('sima_topic_outcomes').push({id:'x',tenant_id:T2,topic_id:t.id,source:'shadow',outcome:'wrong',created_at:new Date(NOW).toISOString()});
 const view=await describeTopics(db,T1,{now:NOW});
 const topic=view.topics.find(x=>x.id===t.id);
 assert.equal(topic.confidence.status,'measured');assert.ok(topic.confidence.confidence>=0.9);
 assert.deepEqual(topic.requiredFields,['opening_hours']);
 assert.equal(topic.profile,undefined);
 assert.ok(db.calls.filter(c=>c.table==='sima_topic_outcomes'&&c.op==='select').every(c=>c.filters.includes(`eq:tenant_id=${JSON.stringify(T1)}`)));
 const empty=await describeTopics(fakeDb({}),T1);
 assert.deepEqual(empty.topics,[]);
});

test('readiness says WHY a topic has not advanced, in the order a person can fix it, without writing anything',async()=>{
 const rows=own(conversations(Array.from({length:40},()=>['ساعت کاری شما چیه؟',HOURS_REPLY])),T1);
 const db=fakeDb(seed({crm_interactions:rows}));
 const read=async(autonomy={autoEnabled:false})=>{const knowledge=(await loadKnowledge(db,T1)).rows;return (await describeTopics(db,T1,{now:NOW,knowledge,autonomy})).topics[0];};
 await discover(db,T1);
 const id=db.rows('sima_topics')[0].id;
 assert.equal((await read()).readiness.reason,'NOT_ACTIVE');
 await updateTopic(db,T1,id,'activate');
 let t=await read();
 assert.equal(t.readiness.reason,'NEEDS_KNOWLEDGE_AND_FIELDS');assert.equal(t.knowledgeApproved,1);assert.deepEqual(t.requiredFields,[]);
 db.tables.set('sima_knowledge_entries',[]);
 t=await read();assert.equal(t.knowledgeApproved,0,'no related approved knowledge');
 db.tables.set('sima_knowledge_entries',kb());
 await setRequiredFields(db,T1,id,['opening_hours']);
 t=await read();assert.equal(t.readiness.reason,'READY_FOR_SHADOW');assert.equal(t.readiness.nextStage,'shadow');
 const before=JSON.stringify(db.rows('sima_topics'));
 await replay(db,T1,{now:NOW});                       // moves it learning -> shadow -> suggest
 t=await read();assert.equal(t.stage,'suggest');assert.equal(t.readiness.reason,'AUTO_REPLY_DISABLED');
 t=await read({autoEnabled:true});assert.equal(t.readiness.reason,'CONFIDENCE_AT_THRESHOLD');assert.equal(t.readiness.nextStage,'auto');
 const mid=JSON.stringify(db.rows('sima_topics'));
 await read({autoEnabled:true});await read();
 assert.equal(JSON.stringify(db.rows('sima_topics')),mid,'describing never writes');
 assert.notEqual(before,mid);
 // a never-auto topic is always explained as such
 db.rows('sima_topics')[0].never_auto=true;
 assert.equal((await read({autoEnabled:true})).readiness.reason,'NEVER_AUTO_TOPIC');
});

test('the owner can reset a raised threshold to the floor; nothing else lowers it; another tenant cannot',async()=>{
 const db=fakeDb(seed());
 await discover(db,T1);
 const t=db.rows('sima_topics')[0];
 assert.equal((await updateTopic(db,T1,t.id,'reset_threshold')).error,'invalid_transition','already at the floor');
 t.confidence_threshold='0.960';t.confidence_floor='0.900';
 assert.equal((await updateTopic(db,T2,t.id,'reset_threshold')).error,'not_found');
 assert.equal(Number(db.rows('sima_topics')[0].confidence_threshold),0.96,'untouched by another tenant');
 const r=await updateTopic(db,T1,t.id,'reset_threshold');
 assert.equal(r.ok,true);assert.equal(Number(r.topic.confidence_threshold),0.9);assert.equal(Number(r.topic.confidence_floor),0.9);
 assert.equal((await updateTopic(db,T1,t.id,'reset_threshold')).error,'invalid_transition','and only once: nothing left to reset');
 // evaluation never lowers it on its own
 t.confidence_threshold='0.960';
 const row=(await listTopics(db,T1)).topics[0];
 await evaluateTopic(db,T1,row,{knowledge:[],autonomy:{autoEnabled:true},now:NOW});
 assert.equal(Number(db.rows('sima_topics')[0].confidence_threshold),0.96);
});

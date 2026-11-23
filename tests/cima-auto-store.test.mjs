import test from 'node:test';
import assert from 'node:assert/strict';
import {autoOverview,enableAuto,disableAuto,pauseAuto,resumeAuto,setCaps,markWrong} from '../lib/crm/auto-store.mjs';
import {evaluateTopic,listTopics,loadRecentAuto} from '../lib/crm/topic-store.mjs';
import {NOW,HOURS_REPLY} from './helpers/conversations.mjs';
import {T1,world,build} from './helpers/auto-fixture.mjs';
import {fakeDb} from './helpers/fake-db.mjs';

const minutes=m=>new Date(NOW-m*60000).toISOString();
const settings=db=>db.rows('sima_autonomy_settings')[0];
const sent=(i,extra={})=>({id:'s'+i,tenant_id:T1,review_id:'r'+i,customer_id:'c'+i,topic_id:'topic-hours',conversation_version:1,mode:'live',status:'sent',answer_text:HOURS_REPLY,created_at:minutes(100+i),wrong_marked_at:null,...extra});
const withSent=(n,seedOptions)=>{const seed=world(seedOptions);for(let i=1;i<=n;i++){seed.sima_auto_answers.push(sent(i));if(!seed.sima_human_review_cases.some(c=>c.id==='r'+i))seed.sima_human_review_cases.push({id:'r'+i,tenant_id:T1,customer_id:'c'+i,account_id:'a',channel:'instagram',last_message_id:'lm'+i,last_occurred_at:minutes(300),state:'resolved',conversation_version:1});}return fakeDb(seed);};

test('turning automatic replies ON or resuming needs an explicit acknowledgement; stopping never does',async()=>{
 const db=fakeDb({sima_autonomy_settings:[{tenant_id:T1,auto_enabled:false,paused_at:null}]});
 for(const bad of [undefined,false,'true',1,null])assert.equal((await enableAuto(db,T1,{acknowledged:bad})).error,'acknowledgement_required',String(bad));
 assert.equal(settings(db).auto_enabled,false,'nothing was written without acknowledgement');
 assert.equal((await enableAuto(db,T1,{acknowledged:true})).ok,true);
 assert.deepEqual([settings(db).auto_enabled,settings(db).paused_at],[true,null]);
 assert.equal((await pauseAuto(db,T1,{now:NOW})).ok,true);assert.equal(settings(db).paused_at,new Date(NOW).toISOString());
 assert.equal((await resumeAuto(db,T1,{})).error,'acknowledgement_required');assert.ok(settings(db).paused_at,'still paused');
 assert.equal((await resumeAuto(db,T1,{acknowledged:true})).ok,true);assert.equal(settings(db).paused_at,null);
 assert.equal((await disableAuto(db,T1)).ok,true);assert.equal(settings(db).auto_enabled,false);
 // a tenant with no settings row yet can still be paused (the safe action) and the row is created
 const empty=fakeDb({});await pauseAuto(empty,T1,{now:NOW});assert.equal(empty.rows('sima_autonomy_settings')[0].tenant_id,T1);
});
test('caps are bounded integers',async()=>{
 const db=fakeDb({sima_autonomy_settings:[{tenant_id:T1,auto_enabled:true}]});
 for(const bad of [[0,3],[201,3],[20,0],[20,21],[1.5,3],['5',3],[null,3],[20,undefined]])assert.equal((await setCaps(db,T1,{hourly:bad[0],customerDaily:bad[1]})).error,'invalid_caps',JSON.stringify(bad));
 assert.equal((await setCaps(db,T1,{hourly:10,customerDaily:2})).ok,true);
 assert.deepEqual([settings(db).auto_hourly_cap,settings(db).auto_customer_daily_cap],[10,2]);
});
test('overview: state, caps, 24 h counts and the decision log with topic labels, newest first, for this tenant only',async()=>{
 const seed=world();
 seed.sima_auto_answers.push(sent(1,{created_at:minutes(60)}),sent(2,{created_at:minutes(30),status:'blocked',reasons:['HOURLY_CAP']}),sent(3,{created_at:minutes(3000)}),
  {...sent(9),tenant_id:'tenant-2',id:'other'});
 const db=fakeDb(seed);
 const o=await autoOverview(db,T1,{now:NOW});
 assert.deepEqual([o.enabled,o.paused,o.caps],[true,false,{hourly:20,customerDaily:3}]);
 assert.deepEqual(o.counts,{sent:1,blocked:1},'only the last 24 h are counted');
 assert.equal(o.log.length,3);assert.equal(o.log[0].id,'s2');assert.equal(o.log[0].topicLabel,'ساعت کاری');assert.ok(o.log.every(r=>r.id!=='other'));
 const none=await autoOverview(fakeDb({}),T1);
 assert.deepEqual([none.enabled,none.paused,none.log],[false,false,[]]);
});
test('mark wrong: only a SENT answer, once; it becomes a heavy failure, raises the threshold, and is idempotent',async()=>{
 const db=withSent(1);
 assert.equal((await markWrong(db,T1,'missing',{now:NOW})).error,'not_found');
 assert.equal((await markWrong(db,'tenant-2','s1',{now:NOW})).error,'not_found','another tenant cannot mark it');
 db.rows('sima_auto_answers').push(sent(2,{status:'blocked'}));
 assert.equal((await markWrong(db,T1,'s2',{now:NOW})).error,'not_sent');
 const r=await markWrong(db,T1,'s1',{now:NOW});
 assert.equal(r.ok,true);assert.equal(db.rows('sima_auto_answers').find(a=>a.id==='s1').wrong_marked_at,new Date(NOW).toISOString());
 const wrong=db.rows('sima_topic_outcomes').filter(o=>o.outcome==='wrong');
 assert.equal(wrong.length,1);assert.deepEqual([wrong[0].source,wrong[0].topic_id,wrong[0].interaction_id],['auto','topic-hours','m1']);
 assert.equal(r.threshold,0.92,'one wrong answer raises the threshold by 0.02');
 assert.equal(Number(db.rows('sima_topics')[0].confidence_threshold),0.92);
 assert.equal((await markWrong(db,T1,'s1',{now:NOW})).error,'already_marked');
 assert.equal(db.rows('sima_topic_outcomes').filter(o=>o.outcome==='wrong').length,1);
});
test('with thin evidence ONE wrong automatic answer is enough to take the topic out of automatic mode, at once',async()=>{
 const db=withSent(1);
 const r=await markWrong(db,T1,'s1',{now:NOW});
 assert.equal(r.stage,'suggest');assert.equal(db.rows('sima_topics')[0].stage,'suggest');
 assert.deepEqual(db.rows('sima_topic_transitions').map(t=>[t.from_stage,t.to_stage,t.reason]),[['auto','suggest','CONFIDENCE_BELOW_THRESHOLD']]);
});
test('with strong evidence, three wrong automatic answers still send the topic back to shadow (the repeated-error rule), with an audit row',async()=>{
 const db=withSent(3,{evidence:600});
 const stages=[];
 for(const id of ['s1','s2','s3'])stages.push((await markWrong(db,T1,id,{now:NOW})).stage);
 assert.deepEqual(stages,['auto','auto','shadow'],'two wrong answers do not move a topic with this much evidence; the third does');
 assert.deepEqual(db.rows('sima_topic_transitions').map(t=>[t.from_stage,t.to_stage,t.reason]),[['auto','shadow','REPEATED_WRONG_AUTOMATIC_ANSWERS']],'one demotion, not undone by the same evaluation');
 assert.equal(db.rows('sima_topics')[0].stage,'shadow');
 assert.equal(Number(db.rows('sima_topics')[0].confidence_threshold),0.96,'0.90 + 0.02 per wrong mark, exactly three marks');
 const heavy=withSent(12,{evidence:600});heavy.rows('sima_topics')[0].confidence_threshold='0.990';
 for(let i=1;i<=12;i++)await markWrong(heavy,T1,'s'+i,{now:NOW});
 assert.ok(Number(heavy.rows('sima_topics')[0].confidence_threshold)<=0.995,'never past the cap');
});
test('evaluating NEVER moves the threshold: it only changes when an answer is marked wrong, one step each, however often topics are re-evaluated',async()=>{
 const seed=world({evidence:600});seed.sima_topics[0].confidence_threshold='0.930';
 for(let i=1;i<=60;i++)seed.sima_auto_answers.push(sent(i,{wrong_marked_at:i<=2?minutes(10):null}));
 const db=fakeDb(seed);
 for(let k=0;k<5;k++){
  const row=(await listTopics(db,T1)).topics[0];
  const r=await evaluateTopic(db,T1,row,{knowledge:seed.sima_knowledge_entries,autonomy:{autoEnabled:true},now:NOW});
  assert.equal(r.threshold,0.93,`evaluation ${k}`);
 }
 assert.equal(Number(db.rows('sima_topics')[0].confidence_threshold),0.93);
});
test('recent automatic history only looks at the last 30 days and this topic',async()=>{
 const seed=world();
 seed.sima_auto_answers.push(sent(1),sent(2,{wrong_marked_at:minutes(10)}),sent(3,{created_at:minutes(60*24*40)}),sent(4,{topic_id:'other-topic'}),sent(5,{status:'blocked'}));
 assert.deepEqual(await loadRecentAuto(fakeDb(seed),T1,'topic-hours',NOW),{sent:2,wrong:1});
});
test('every query of the owner controls is tenant-scoped',async()=>{
 const db=withSent(1);
 await autoOverview(db,T1,{now:NOW});await enableAuto(db,T1,{acknowledged:true});await setCaps(db,T1,{hourly:5,customerDaily:2});await markWrong(db,T1,'s1',{now:NOW});await pauseAuto(db,T1,{now:NOW});
 for(const c of db.calls){
  if(c.op==='rpc')continue;
  if(['select','update','delete'].includes(c.op))assert.ok(c.filters.some(f=>f.startsWith('eq:tenant_id=')&&f.includes(T1)),`${c.table} ${c.op} ${c.filters}`);
  else for(const row of [].concat(c.payload))assert.equal(row.tenant_id,T1,`${c.table} ${c.op}`);
 }
});

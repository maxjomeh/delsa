import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessTopicRisk,LOCKED_BLOCKS} from '../lib/crm/topic-risk.mjs';
import {wilsonLowerBound,topicConfidence,nextThreshold,decideStage,canAutoAnswer,DEFAULTS} from '../lib/crm/topic-confidence.mjs';
import {compareDraftToHuman,numbersIn,similarity} from '../lib/crm/shadow-eval.mjs';

const NOW=Date.parse('2026-11-22T09:00:00Z');
const outs=(n,outcome,source='shadow',daysAgo=0)=>Array.from({length:n},()=>({outcome,source,at:NOW-daysAgo*86400000}));
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');

// ---------- risk ----------
test('locked categories are never auto-answerable: price, stock, technical fit, financial, complaint',()=>{
 for(const [msg,code] of [['قیمت این چنده؟','LIVE_PRICE_UNVERIFIED'],['موجود هست؟','LIVE_STOCK_UNVERIFIED'],['این لنت به ترمز میخوره؟','TECHNICAL_FIT_UNVERIFIED'],['بازگشت وجه میخوام','FINANCIAL_COMMITMENT'],['خیلی ناراضی هستم از خدمات شما','COMPLAINT']]){
  const r=assessTopicRisk(msg);assert.ok(r.blocks.includes(code),`${msg} -> ${code}`);assert.ok(r.locked.includes(code),`${code} is locked`);assert.equal(r.riskLevel,'high');
 }
 assert.deepEqual([...LOCKED_BLOCKS].sort(),['COMPLAINT','FINANCIAL_COMMITMENT','LIVE_PRICE_UNVERIFIED','LIVE_STOCK_UNVERIFIED','TECHNICAL_FIT_UNVERIFIED']);
});
test('order changes, data requests and vague messages block automation but are not locked',()=>{
 assert.ok(assessTopicRisk('میخوام سفارشمو لغو کنم').blocks.includes('ORDER_CHANGE'));
 assert.ok(assessTopicRisk('لطفا اطلاعات حسابم را حذف اطلاعات کنید').blocks.includes('DATA_REQUEST'));
 assert.ok(assessTopicRisk('سلام').blocks.includes('AMBIGUOUS_OR_TOO_SHORT'));
 assert.deepEqual(assessTopicRisk('میخوام سفارشمو لغو کنم').locked,[]);
});
test('opt-out blocks; an ordinary FAQ question is low risk',()=>{
 assert.ok(assessTopicRisk('ساعات کاری شما چه زمانی است؟',{doNotContact:true}).blocks.includes('CONTACT_OPTED_OUT'));
 const ok=assessTopicRisk('ساعات کاری شما چه زمانی است؟');assert.equal(ok.riskLevel,'low');assert.deepEqual(ok.blocks,[]);
});

// ---------- confidence ----------
test('Wilson lower bound is conservative and grows with evidence',()=>{
 assert.equal(wilsonLowerBound(0,0),0);
 assert.ok(wilsonLowerBound(30,30)<1);
 assert.ok(wilsonLowerBound(30,30)<wilsonLowerBound(40,40),'more evidence -> higher bound');
 assert.ok(wilsonLowerBound(9,10)<wilsonLowerBound(90,100),'same rate, less evidence -> lower bound');
});
test('confidence is null (not low) until enough samples; 30 perfect samples are not yet 0.90',()=>{
 const few=topicConfidence(outs(10,'accepted'),{now:NOW});
 assert.equal(few.status,'insufficient_data');assert.equal(few.confidence,null);
 const thirty=topicConfidence(outs(30,'accepted'),{now:NOW});
 assert.equal(thirty.status,'measured');assert.ok(thirty.confidence<0.9,String(thirty.confidence));
 const forty=topicConfidence(outs(40,'accepted'),{now:NOW});
 assert.ok(forty.confidence>=0.9,String(forty.confidence));
});
test('recent failures weigh more than old ones; a wrong automatic answer weighs heavily',()=>{
 const oldFails=topicConfidence([...outs(40,'accepted','shadow',1),...outs(10,'rejected','shadow',400)],{now:NOW});
 const newFails=topicConfidence([...outs(40,'accepted','shadow',1),...outs(10,'rejected','shadow',1)],{now:NOW});
 assert.ok(oldFails.lowerBound>newFails.lowerBound);
 const clean=topicConfidence(outs(40,'accepted'),{now:NOW});
 const withWrong=topicConfidence([...outs(38,'accepted'),...outs(2,'wrong','auto')],{now:NOW});
 assert.ok(withWrong.lowerBound<clean.lowerBound-0.1);
 assert.ok(withWrong.lowerBound<0.9,'two wrong automatic answers push a topic below 0.90');
});
test('edited answers count half; unknown outcomes and null items are ignored',()=>{
 const c=topicConfidence([...outs(40,'edited'),null,{outcome:'mystery'}],{now:NOW});
 assert.equal(c.count,40);assert.ok(Math.abs(c.rate-0.5)<0.001);
});

// ---------- threshold ----------
test('threshold never goes below the owner floor; wrong answers raise it; only clean volume relaxes it',()=>{
 assert.equal(nextThreshold({threshold:0.9,floor:0.9,recentAuto:{sent:500,wrong:0}}),0.9,'cannot relax below the floor');
 assert.equal(nextThreshold({threshold:0.93,floor:0.9,recentAuto:{sent:60,wrong:0}}),0.92);
 assert.equal(nextThreshold({threshold:0.93,floor:0.9,recentAuto:{sent:10,wrong:0}}),0.93);
 assert.equal(nextThreshold({threshold:0.93,floor:0.9,recentAuto:{sent:10,wrong:2}}),0.97);
 assert.equal(nextThreshold({threshold:0.99,floor:0.9,recentAuto:{sent:10,wrong:5}}),0.995,'capped');
 assert.equal(nextThreshold({threshold:0.5,floor:0.9}),0.9,'a threshold under the floor is lifted to it');
});

// ---------- stage machine ----------
const topic=(extra={})=>({stage:'learning',neverAuto:false,threshold:0.9,floor:0.9,status:'active',...extra});
const measured=(lb,shadowSamples=25)=>({status:'measured',lowerBound:lb,confidence:lb,shadowSamples});
test('learning -> shadow only with approved knowledge and defined required fields',()=>{
 assert.equal(decideStage({topic:topic(),knowledgeApproved:0,requiredFieldsDefined:true}).stage,'learning');
 assert.equal(decideStage({topic:topic(),knowledgeApproved:2,requiredFieldsDefined:false}).stage,'learning');
 const r=decideStage({topic:topic(),knowledgeApproved:2,requiredFieldsDefined:true});assert.equal(r.stage,'shadow');assert.equal(r.changed,true);
});
test('shadow -> suggest needs measured confidence AND enough shadow samples',()=>{
 assert.equal(decideStage({topic:topic({stage:'shadow'}),confidence:measured(0.85,25)}).stage,'suggest');
 assert.equal(decideStage({topic:topic({stage:'shadow'}),confidence:measured(0.85,5)}).stage,'shadow');
 assert.equal(decideStage({topic:topic({stage:'shadow'}),confidence:{status:'insufficient_data',lowerBound:0.9,shadowSamples:25}}).stage,'shadow');
});
test('suggest -> auto requires the tenant switch, shadow evidence and lb >= threshold',()=>{
 const t=topic({stage:'suggest'});
 assert.equal(decideStage({topic:t,confidence:measured(0.93),autoEnabled:true}).stage,'auto');
 assert.equal(decideStage({topic:t,confidence:measured(0.93),autoEnabled:false}).stage,'suggest','tenant switch off');
 assert.equal(decideStage({topic:t,confidence:measured(0.93,3),autoEnabled:true}).stage,'suggest','no shadow evidence');
 assert.equal(decideStage({topic:t,confidence:measured(0.89),autoEnabled:true}).stage,'suggest','below threshold');
});
test('never-auto topics can reach suggest but never auto, and are demoted if somehow automatic',()=>{
 assert.equal(decideStage({topic:topic({stage:'suggest',neverAuto:true}),confidence:measured(0.999),autoEnabled:true}).stage,'suggest');
 const r=decideStage({topic:topic({stage:'auto',neverAuto:true}),confidence:measured(0.999),autoEnabled:true});
 assert.equal(r.stage,'suggest');assert.equal(r.reason,'NEVER_AUTO_TOPIC');
});
test('automatic topics are demoted by the kill switch, repeated wrong answers, or a clear confidence drop (with hysteresis)',()=>{
 const t=topic({stage:'auto'});
 assert.equal(decideStage({topic:t,confidence:measured(0.93),autoEnabled:true}).stage,'auto');
 assert.equal(decideStage({topic:t,confidence:measured(0.93),autoEnabled:false}).reason,'AUTO_REPLY_DISABLED');
 assert.equal(decideStage({topic:t,confidence:measured(0.93),autoEnabled:true,recentAuto:{sent:20,wrong:3}}).stage,'shadow');
 assert.equal(decideStage({topic:t,confidence:measured(0.88),autoEnabled:true}).stage,'auto','within hysteresis: no flapping');
 assert.equal(decideStage({topic:t,confidence:measured(0.85),autoEnabled:true}).stage,'suggest');
 assert.equal(decideStage({topic:t,confidence:{status:'insufficient_data',lowerBound:0,shadowSamples:0},autoEnabled:true}).stage,'suggest');
});
test('a collapsed suggest topic goes back to shadow',()=>{
 assert.equal(decideStage({topic:topic({stage:'suggest'}),confidence:measured(0.6),autoEnabled:true}).stage,'shadow');
});

// ---------- final gate ----------
const ready=()=>({tenant:{autoEnabled:true,paused:false},topic:{status:'active',stage:'auto',neverAuto:false,threshold:0.9,floor:0.9,requiredFields:['hours_text']},
 confidence:measured(0.93),fields:{hours_text:{verified:true}},message:'ساعات کاری شما چه زمانی است؟',customer:{doNotContact:false},window:{open:true},thread:{}});
test('canAutoAnswer allows only when every condition holds and lists every reason otherwise',()=>{
 assert.deepEqual(canAutoAnswer(ready()),{allow:true,reasons:[]});
 const cases=[
  [x=>{x.tenant.autoEnabled=false},'AUTO_REPLY_DISABLED'],[x=>{x.tenant.paused=true},'TENANT_PAUSED'],
  [x=>{x.topic.stage='suggest'},'TOPIC_NOT_AUTOMATIC'],[x=>{x.topic.neverAuto=true},'NEVER_AUTO_TOPIC'],[x=>{x.topic.status='proposed'},'TOPIC_NOT_ACTIVE'],
  [x=>{x.topic.threshold=0.8},'THRESHOLD_BELOW_OWNER_FLOOR'],[x=>{x.confidence=measured(0.85)},'CONFIDENCE_BELOW_THRESHOLD'],
  [x=>{x.confidence={status:'insufficient_data',lowerBound:0.99,confidence:null}},'CONFIDENCE_BELOW_THRESHOLD'],
  [x=>{x.fields={}},'MISSING_FIELD:hours_text'],[x=>{x.fields={hours_text:{verified:false}}},'MISSING_FIELD:hours_text'],
  [x=>{x.message='قیمت چنده؟'},'RISK:LIVE_PRICE_UNVERIFIED'],[x=>{x.customer.doNotContact=true},'RISK:CONTACT_OPTED_OUT'],
  [x=>{x.window.open=false},'MESSAGING_WINDOW_CLOSED'],[x=>{x.window={}},'MESSAGING_WINDOW_CLOSED'],
  [x=>{x.thread.alreadyReplied=true},'ALREADY_HANDLED'],[x=>{x.thread.pendingSend=true},'ALREADY_HANDLED'],
 ];
 for(const [mutate,reason] of cases){const x=ready();mutate(x);const r=canAutoAnswer(x);assert.equal(r.allow,false,reason);assert.ok(r.reasons.includes(reason),`${reason} in ${r.reasons}`);}
 assert.equal(canAutoAnswer({}).allow,false);
});

// ---------- shadow comparison ----------
test('shadow comparison: identical accepted, partial edited, different rejected',()=>{
 const human='ساعات پاسخگویی پشتیبانی شنبه تا چهارشنبه ۹ تا ۱۷ است';
 assert.equal(compareDraftToHuman(human,human).outcome,'accepted');
 assert.equal(compareDraftToHuman('پشتیبانی شنبه تا چهارشنبه ۹ تا ۱۷ پاسخگو است و روزهای دیگر تعطیل',human).outcome,'edited');
 assert.equal(compareDraftToHuman('سفارش شما ارسال شد',human).outcome,'rejected');
 assert.equal(compareDraftToHuman('',human).outcome,'rejected');
});
test('a number the human did not say is always a rejection; digit scripts are equivalent',()=>{
 const human='ساعات پاسخگویی پشتیبانی شنبه تا چهارشنبه ۹ تا ۱۷ است';
 const r=compareDraftToHuman('ساعات پاسخگویی پشتیبانی شنبه تا چهارشنبه ۹ تا ۲۰ است',human);
 assert.equal(r.outcome,'rejected');assert.equal(r.reason,'NUMBER_NOT_IN_HUMAN_REPLY');
 assert.equal(compareDraftToHuman('ساعات پاسخگویی پشتیبانی شنبه تا چهارشنبه 9 تا 17 است',human).outcome,'accepted');
 assert.deepEqual(numbersIn('۱٬۲۰۰ تومان و ٣ عدد'),['1200','3']);
 assert.ok(similarity('ساعت کاری','ساعت کاری')>0.99);
});

// ---------- schema and containment (static) ----------
test('migration: RLS on, no browser roles, append-only evidence, DB-level guards present',()=>{
 const sql=read('../supabase/migrations/20261122_cima_topic_autonomy.sql');
 for(const table of ['sima_autonomy_settings','sima_topics','sima_topic_fields','sima_topic_outcomes','sima_topic_transitions'])assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`));
 assert.match(sql,/revoke all on [^;]*from public,anon,authenticated/);
 assert.doesNotMatch(sql,/grant[^;]*\bto\b[^;]*\b(anon|authenticated)\b/i);
 assert.match(sql,/grant select,insert on public\.sima_topic_outcomes,public\.sima_topic_transitions to service_role/);
 assert.doesNotMatch(sql,/grant[^;]*(update|delete)[^;]*sima_topic_outcomes/);
 assert.match(sql,/check\(stage <> 'auto' or \(status = 'active' and not never_auto\)\)/);
 assert.match(sql,/check\(risk_class <> 'high' or never_auto\)/);
 assert.match(sql,/check\(confidence_threshold >= confidence_floor\)/);
 assert.match(sql,/tenant_automatic_replies_disabled/);
 assert.match(sql,/sima_autonomy_kill_switch/);
 assert.match(sql,/auto_enabled boolean not null default false/);
 assert.match(sql,/foreign key\(tenant_id,topic_id\) references public\.sima_topics\(tenant_id,id\)/);
});
test('these modules are pure: no network, no sending, no database access',()=>{
 for(const file of ['topic-risk','topic-confidence','shadow-eval']){
  const src=read(`../lib/crm/${file}.mjs`);
  assert.doesNotMatch(src,/\bfetch\(|zernio|supabase|createClient|process\.env|outbox|sendMessage/i,file);
 }
 assert.equal(DEFAULTS.minSamples,30);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {autoMode,decideAutoAnswer,AUTO_MODES} from '../lib/crm/auto-answer.mjs';
import {topicConfidence} from '../lib/crm/topic-confidence.mjs';
import {HOURS_REPLY,NOW} from './helpers/conversations.mjs';
import {topicProfile} from './helpers/auto-fixture.mjs';

const t=topicProfile();
const topic=(extra={})=>({id:'topic-hours',key:t.key,label:'ساعت کاری',status:'active',stage:'auto',neverAuto:false,floor:0.9,threshold:0.9,profile:t.profile,requiredFields:['opening_hours'],...extra});
const measured=lb=>({status:'measured',lowerBound:lb,confidence:lb,shadowSamples:40,effectiveN:40});
const entry=(extra={})=>({id:'k1',title:'ساعت کاری',question:'ساعت کاری شما چیه',answer:HOURS_REPLY,status:'approved',revision:3,...extra});
const ready=(over={})=>({mode:'live',tenant:{autoEnabled:true,paused:false,hourlyCap:20,customerDailyCap:3},topic:topic(),confidence:measured(0.93),
 fields:{opening_hours:{verified:true}},turnText:'ساعت کاری شما چیه؟',customer:{doNotContact:false},window:{open:true},thread:{},knowledge:[entry()],counts:{tenantLastHour:0,customerLast24h:0},...over});

test('the server mode defaults to OFF and anything unrecognised means OFF',()=>{
 assert.deepEqual([...AUTO_MODES],['off','dry_run','live']);
 assert.equal(autoMode({}),'off');assert.equal(autoMode(undefined),'off');
 for(const bad of ['yes','true','1','LIVE!','enabled','livee',''])assert.equal(autoMode({CIMA_AUTO_MODE:bad}),'off',bad);
 assert.equal(autoMode({CIMA_AUTO_MODE:' Live '}),'live');assert.equal(autoMode({CIMA_AUTO_MODE:'DRY_RUN'}),'dry_run');
});
test('with every condition met: live sends, dry_run only records, off does nothing; the answer is the approved text word for word',()=>{
 const live=decideAutoAnswer(ready());
 assert.deepEqual([live.action,live.reasons],['send',[]]);assert.equal(live.answer,HOURS_REPLY);assert.deepEqual(live.entry,{id:'k1',revision:3});
 assert.equal(decideAutoAnswer(ready({mode:'dry_run'})).action,'dry_run');
 assert.deepEqual(decideAutoAnswer(ready({mode:'off'})),{action:'skip',reasons:['MODE_OFF']});
 assert.equal(decideAutoAnswer(ready({knowledge:[entry({answer:'  '+HOURS_REPLY+'  '})]})).answer,HOURS_REPLY,'only whitespace is trimmed');
});
test('every missing condition blocks, and says why',()=>{
 const cases=[
  [{tenant:{autoEnabled:false,hourlyCap:20,customerDailyCap:3}},'AUTO_REPLY_DISABLED'],[{tenant:{autoEnabled:true,paused:true,hourlyCap:20,customerDailyCap:3}},'TENANT_PAUSED'],
  [{topic:topic({stage:'suggest'})},'TOPIC_NOT_AUTOMATIC'],[{topic:topic({neverAuto:true})},'NEVER_AUTO_TOPIC'],[{topic:topic({status:'proposed'})},'TOPIC_NOT_ACTIVE'],
  [{confidence:measured(0.85)},'CONFIDENCE_BELOW_THRESHOLD'],[{confidence:topicConfidence([],{now:NOW})},'CONFIDENCE_BELOW_THRESHOLD'],
  [{fields:{}},'MISSING_FIELD:opening_hours'],[{fields:{opening_hours:{verified:false}}},'MISSING_FIELD:opening_hours'],
  [{turnText:'قیمت امروز چنده؟'},'RISK:LIVE_PRICE_UNVERIFIED'],[{turnText:'ناراضی هستم ساعت کاری شما چیه؟'},'RISK:COMPLAINT'],
  [{customer:{doNotContact:true}},'RISK:CONTACT_OPTED_OUT'],[{window:{open:false}},'MESSAGING_WINDOW_CLOSED'],
  [{thread:{alreadyReplied:true}},'ALREADY_HANDLED'],[{thread:{pendingSend:true}},'ALREADY_HANDLED'],
  [{knowledge:[]},'NO_APPROVED_ANSWER'],[{knowledge:[entry({status:'draft'})]},'NO_APPROVED_ANSWER'],[{knowledge:[entry({status:'revoked'})]},'NO_APPROVED_ANSWER'],
  [{knowledge:[entry({expires_at:new Date(NOW-1000).toISOString()})]},'NO_APPROVED_ANSWER'],
  [{counts:{tenantLastHour:20,customerLast24h:0}},'HOURLY_CAP'],[{counts:{tenantLastHour:0,customerLast24h:3}},'CUSTOMER_DAILY_CAP'],
 ];
 for(const [change,reason] of cases){
  const r=decideAutoAnswer(ready(change));
  assert.equal(r.action,'blocked',reason);assert.ok(r.reasons.includes(reason),`${reason} in ${r.reasons}`);assert.equal(r.answer,undefined,'a blocked decision carries no answer');
 }
});
test('the approved answer must belong to the matched topic and must not itself talk about price, stock or commitments',()=>{
 const other=topic({profile:[['ارس',1],['رسا',1],['سال',1]]});
 assert.ok(decideAutoAnswer(ready({topic:other})).reasons.includes('KNOWLEDGE_NOT_IN_TOPIC'));
 const priced=decideAutoAnswer(ready({knowledge:[entry({answer:'ساعت کاری ما ۹ تا ۱۷ است و قیمت امروز ۵۰۰ هزار تومان است'})]}));
 assert.equal(priced.action,'blocked');assert.ok(priced.reasons.includes('ANSWER_CONTAINS_LOCKED_TOPIC'));
 assert.ok(decideAutoAnswer(ready({knowledge:[entry({answer:'x'.repeat(4001)})]})).reasons.includes('ANSWER_TOO_LONG'));
});
test('blocked decisions list each reason once, even when several apply',()=>{
 const r=decideAutoAnswer(ready({tenant:{autoEnabled:false,hourlyCap:20,customerDailyCap:3},topic:topic({stage:'learning'}),knowledge:[],fields:{}}));
 assert.equal(new Set(r.reasons).size,r.reasons.length);assert.ok(r.reasons.length>=4);
});
test('the decision module is pure: no network, database, sending or timers',()=>{
 const src=readFileSync(new URL('../lib/crm/auto-answer.mjs',import.meta.url),'utf8').split('\n').filter(l=>!l.trim().startsWith('//')).join('\n');
 assert.doesNotMatch(src,/\bfetch\(|zernio|supabase|createClient|rpc\(|outbox|sendMessage|setTimeout|setInterval/i);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {matchAnswer,MATCH_DEFAULTS} from '../lib/crm/knowledge-match.mjs';
import {rankKnowledge} from '../lib/crm/cima-grounding.mjs';
import {discoverTopics} from '../lib/crm/topic-discovery.mjs';
import {runBacktest} from '../lib/crm/backtest.mjs';
import {NOW,HOURS_Q,SHIP_Q,HOURS_REPLY,SHIP_REPLY,standard} from './helpers/conversations.mjs';

const topics=discoverTopics(standard());
const hours=topics.find(t=>t.examples.some(e=>/ساعت/.test(e)));
const ship=topics.find(t=>t.examples.some(e=>/ارسال/.test(e)));
const entry=(id,question,answer,extra={})=>({id,title:question,question,answer,status:'approved',revision:1,expires_at:null,...extra});
const hoursEntry=entry('k-hours','ساعت کاری شما چیه',HOURS_REPLY);
const shipEntry=entry('k-ship','ارسال به شهرستان دارید',SHIP_REPLY);
const run=(message,topic,knowledge,extra={})=>matchAnswer({message,topic,knowledge,now:NOW,...extra});

test('paraphrases are covered far better than by the current token matcher, with no cross-topic confusion',()=>{
 const covered=(questions,topic,e)=>questions.filter(q=>run(q,topic,[e]).status==='matched').length;
 const old=(questions,e)=>questions.filter(q=>rankKnowledge(q,[e]).length>0).length;
 const h=covered(HOURS_Q,hours,hoursEntry),s=covered(SHIP_Q,ship,shipEntry);
 assert.ok(h>=7,`hours covered ${h}/8`);assert.ok(s>=7,`shipping covered ${s}/8`);
 assert.ok(h+s>(old(HOURS_Q,hoursEntry)+old(SHIP_Q,shipEntry))*3,`new ${h+s}/16 vs old ${old(HOURS_Q,hoursEntry)+old(SHIP_Q,shipEntry)}/16`);
 // every matched message maps to the right entry
 for(const q of HOURS_Q){const m=run(q,hours,[hoursEntry,shipEntry]);if(m.status==='matched')assert.equal(m.entry.id,'k-hours',q);}
 for(const q of SHIP_Q){const m=run(q,ship,[hoursEntry,shipEntry]);if(m.status==='matched')assert.equal(m.entry.id,'k-ship',q);}
});
test('only knowledge that belongs to the matched topic is a candidate',()=>{
 assert.equal(run(SHIP_Q[0],ship,[hoursEntry]).reason,'KNOWLEDGE_NOT_IN_TOPIC');
 assert.equal(run(HOURS_Q[0],hours,[shipEntry]).reason,'KNOWLEDGE_NOT_IN_TOPIC');
 assert.equal(run(HOURS_Q[0],hours,[shipEntry,hoursEntry]).entry.id,'k-hours');
});
test('an unrelated message is "no close answer", never the nearest entry by force',()=>{
 for(const m of ['هوا امروز خیلی خوبه','سلام وقت بخیر','آدرس فروشگاه کجاست']){
  const r=run(m,hours,[hoursEntry]);assert.equal(r.status,'none',m);assert.equal(r.reason,'NO_CLOSE_ANSWER',m);
 }
});
test('unusable entries never match: draft, revoked, expired, empty question or answer; and none at all',()=>{
 assert.equal(run(HOURS_Q[0],hours,[]).reason,'NO_APPROVED_ANSWER');
 for(const bad of [{status:'draft'},{status:'revoked'},{expires_at:new Date(NOW-1000).toISOString()},{answer:'  '},{question:''}])assert.equal(run(HOURS_Q[0],hours,[{...hoursEntry,...bad}]).reason,'NO_APPROVED_ANSWER',JSON.stringify(bad));
 assert.equal(run(HOURS_Q[0],hours,[{...hoursEntry,expires_at:new Date(NOW+86400000).toISOString()}]).status,'matched','not yet expired');
 assert.equal(matchAnswer({message:HOURS_Q[0],topic:hours,knowledge:[{...hoursEntry,expires_at:new Date(NOW+5000).toISOString()}],now:NOW+10000}).reason,'NO_APPROVED_ANSWER','expiry follows the supplied clock');
});
test('two DIFFERENT answers about equally close are ambiguous (nothing is sent); the same answer twice is not a conflict',()=>{
 // 'شما' carries no topic meaning, so these two entries are equally close to 'ساعت کاری' yet give different answers
 const a=entry('k1','ساعت کاری شما','پاسخ الف'),b=entry('k2','ساعت کاری','پاسخ ب');
 const r=run('ساعت کاری',hours,[a,b]);
 assert.equal(r.status,'ambiguous');assert.deepEqual(r.candidates.map(c=>c.id).sort(),['k1','k2']);
 assert.equal(run('ساعت کاری',hours,[a,{...b,answer:'پاسخ الف'}]).status,'matched');
 // an entry with an extra meaningful word is measurably further away, so the closer one simply wins
 assert.equal(run('ساعت کاری',hours,[a,entry('k5','ساعت کاری ما','پاسخ ب')]).entry.id,'k1');
 assert.equal(run('ساعت کاری',hours,[a,b],{minMargin:0}).status,'matched','the margin is a parameter');
 // a clearly closer entry wins
 const close=entry('k3','ساعت کاری شما چیه','پاسخ نزدیک'),far=entry('k4','ساعت کاری فروشگاه شهرستان','پاسخ دور');
 assert.equal(run('ساعت کاری شما چیه',hours,[far,close]).entry.id,'k3');
});
test('the floor and margin are conservative by default and the result is deterministic',()=>{
 assert.deepEqual({...MATCH_DEFAULTS},{minScore:0.3,minMargin:0.08});
 const k=[entry('b','ساعت کاری شما چیه','پاسخ'),entry('a','ساعت کاری شما چیه','پاسخ')];
 assert.equal(run(HOURS_Q[0],hours,k).status,'matched');
 assert.equal(run(HOURS_Q[0],hours,[...k].reverse()).entry.id,run(HOURS_Q[0],hours,k).entry.id,'ties break by id, not input order');
 assert.equal(run(HOURS_Q[1],hours,[hoursEntry],{minScore:0.99}).status,'none','a paraphrase fails an extreme floor');
 assert.equal(run(HOURS_Q[1],hours,[hoursEntry]).status,'matched','and passes the default one');
});
test('replay uses the same matcher: far more scored evidence, ambiguity counted, wrong figures still rejected',()=>{
 const good=runBacktest({interactions:standard(),knowledge:[hoursEntry,shipEntry],now:NOW});
 const h=good.topics.find(t=>t.topic.key===hours.key),s=good.topics.find(t=>t.topic.key===ship.key);
 assert.ok(h.scored>=7&&s.scored>=7,`scored ${h.scored}/${s.scored}`);
 for(const o of [...h.outcomes,...s.outcomes])assert.equal(o.outcome,'accepted');
 assert.ok(h.outcomes.every(o=>o.matchScore>=0.3&&o.knowledgeId==='k-hours'));
 const wrong=runBacktest({interactions:standard(),knowledge:[entry('k-hours','ساعت کاری شما چیه','ساعت کاری ما شنبه تا چهارشنبه ۱۰ تا ۲۰ است')],now:NOW});
 for(const o of wrong.topics.find(t=>t.topic.key===hours.key).outcomes)assert.equal(o.outcome,'rejected');
 const ambiguous=runBacktest({interactions:standard(),knowledge:[entry('k1','ساعت کاری شما','پاسخ الف'),entry('k2','ساعت کاری','پاسخ ب')],now:NOW});
 const t=ambiguous.topics.find(x=>x.topic.key===hours.key);
 assert.ok(t.ambiguous>0);assert.equal(t.scored+t.uncovered+t.ambiguous,t.pairs);
 const price=good.topics.find(t=>t.topic.neverAuto);assert.equal(price.scored,0);assert.equal(price.blocked,price.pairs,'risky topics are still never scored');
});
test('the module is pure and the human-review matcher is untouched',()=>{
 const src=readFileSync(new URL('../lib/crm/knowledge-match.mjs',import.meta.url),'utf8').split('\n').filter(l=>!l.trim().startsWith('//')).join('\n');
 assert.doesNotMatch(src,/\bfetch\(|zernio|supabase|createClient|process\.env|outbox|sendMessage|Date\.now\(\)\s*[^,)]/i);
 assert.doesNotMatch(readFileSync(new URL('../lib/crm/cima-grounding.mjs',import.meta.url),'utf8'),/knowledge-match/);
 assert.doesNotMatch(readFileSync(new URL('../app/api/crm/copilot/route.js',import.meta.url),'utf8'),/knowledge-match/);
});

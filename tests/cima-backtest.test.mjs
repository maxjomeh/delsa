import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {questionsFrom,discoverTopics,assignTopic,isQuestion} from '../lib/crm/topic-discovery.mjs';
import {pairQuestionsWithReplies,suggestKnowledge,runBacktest,summarizeBacktest} from '../lib/crm/backtest.mjs';
import {NOW,HOURS_REPLY,HOURS_Q,SHIP_Q,PRICE_Q,conversations,standard,knowledge} from './helpers/conversations.mjs';

const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const bySize=t=>[...t].sort((a,b)=>b.count-a.count);

// ---------- discovery ----------
test('only inbound customer questions become topic evidence',()=>{
 const rows=[
  ...conversations([['ساعت کاری شما چیه؟',null],['سلام',null],['ممنون از شما',null]]),
  {id:'o1',customer_id:'z',direction:'outbound',kind:'message',body:'ساعت کاری ما ۹ تا ۱۷ است؟'},
  {id:'n1',customer_id:'z',direction:'inbound',kind:'note',body:'ساعت کاری چیه؟'},
 ];
 const q=questionsFrom(rows);
 assert.equal(q.length,1);assert.equal(q[0].text,'ساعت کاری شما چیه؟');
 assert.equal(isQuestion('ممنون'),false);
});
test('discovers the three real topics from varied Persian wording, and flags price as high risk / never automatic',()=>{
 const topics=bySize(discoverTopics(standard()));
 assert.equal(topics.length,3);
 assert.deepEqual(topics.map(t=>t.count).sort(),[6,8,8]);
 const price=topics.find(t=>t.blocks.some(b=>b.code==='LIVE_PRICE_UNVERIFIED'));
 assert.ok(price);assert.equal(price.riskClass,'high');assert.equal(price.neverAuto,true);assert.equal(price.count,6);
 for(const t of topics.filter(x=>x!==price)){assert.equal(t.riskClass,'low');assert.equal(t.neverAuto,false);}
 for(const t of topics){assert.equal(t.status,'proposed');assert.equal(t.origin,'discovered');assert.equal(t.labelIsAuto,true);assert.deepEqual(t.requiredFields,[]);assert.ok(t.examples.length<=5);}
});
test('discovery is deterministic regardless of input order',()=>{
 const rows=standard();
 const forward=discoverTopics(rows).map(t=>[t.key,t.count]).sort();
 const reversed=discoverTopics([...rows].reverse()).map(t=>[t.key,t.count]).sort();
 assert.deepEqual(forward.map(x=>x[1]),reversed.map(x=>x[1]));
});
test('a few repeated questions are not a topic: minimum occurrences and distinct customers are enforced',()=>{
 assert.equal(discoverTopics(conversations(HOURS_Q.slice(0,3).map(q=>[q,null]))).length,0,'too few questions');
 const oneCustomer=HOURS_Q.map((q,i)=>({id:'x'+i,customer_id:'same',direction:'inbound',kind:'message',body:q,occurred_at:new Date(NOW-i*3600e3).toISOString()}));
 assert.equal(discoverTopics(oneCustomer).length,0,'one customer asking many times is not a topic');
});
test('a new question is assigned to the matching topic or to none',()=>{
 const topics=discoverTopics(standard());
 const hours=assignTopic('ساعت کاری شما چیه',topics);
 assert.ok(hours);assert.ok(/ساعت/.test(hours.topic.label)||hours.topic.examples.some(e=>/ساعت/.test(e)));
 assert.equal(assignTopic('هوا امروز عالیه',topics),null);
 assert.equal(assignTopic('سلام',topics),null);
});

// ---------- pairing ----------
test('pairs a question turn with the next human reply; stale, unanswered and non-question turns are dropped',()=>{
 const t=h=>new Date(NOW-h*3600e3).toISOString();
 const row=(id,customer,direction,body,h,channel='instagram')=>({id,customer_id:customer,channel,direction,kind:'message',body,occurred_at:t(h),created_at:t(h)});
 const rows=[
  row('1','a','inbound','ساعت کاری شما',30),row('2','a','inbound','چیه؟',29.9),row('3','a','outbound','۹ تا ۱۷',29),   // two inbound messages = one turn
  row('4','b','inbound','ساعت کاری شما چیه؟',100),row('5','b','outbound','۹ تا ۱۷',50),                              // reply after 50h: stale
  row('6','c','inbound','ممنون از شما',20),row('7','c','outbound','خواهش می‌کنم',19),                               // not a question
  row('8','d','inbound','ارسال دارید؟',10),                                                                          // unanswered
  row('9','e','inbound','ارسال دارید؟',10,'telegram'),row('10','e','outbound','بله',9,'instagram'),                  // reply on another channel
  {id:'bad',customer_id:'f',direction:'inbound',kind:'message',body:'چیه؟',occurred_at:'not-a-date'},
 ];
 const pairs=pairQuestionsWithReplies(rows.reverse());   // order must not matter
 assert.equal(pairs.length,1);
 assert.equal(pairs[0].customerId,'a');assert.equal(pairs[0].question,'ساعت کاری شما چیه؟');assert.equal(pairs[0].reply,'۹ تا ۱۷');
});

// ---------- knowledge suggestion ----------
test('knowledge is suggested only from consistent, non-risky replies; always a draft',()=>{
 const pair=(reply,question='ساعت کاری شما چیه؟')=>({question,reply,customerId:'x',replyAt:NOW,questionAt:NOW,interactionId:'i'});
 const same=Array.from({length:6},()=>pair(HOURS_REPLY));
 const s=suggestKnowledge(same);
 assert.equal(s.answer,HOURS_REPLY);assert.equal(s.status,'draft');assert.equal(s.support,6);assert.equal(s.containsNumbers,true);
 assert.equal(suggestKnowledge(same.slice(0,4)),null,'too few replies');
 const different=['شنبه باز هستیم','فردا تعطیلیم','با پشتیبانی تماس بگیرید','امروز زود می‌بندیم','نمی‌دونم','بستگی داره'].map(r=>pair(r));
 assert.equal(suggestKnowledge(different),null,'the owner answers differently every time');
 assert.equal(suggestKnowledge(Array.from({length:6},()=>pair('قیمت امروز ۵۰۰ هزار تومان است'))),null,'never bootstrap price knowledge');
 assert.equal(suggestKnowledge(Array.from({length:6},()=>pair('ارسال با پست پیشتاز انجام می‌شود'))).containsNumbers,false);
});

// ---------- backtest ----------
test('without approved knowledge nothing is scored: a coverage gap, not a failure; price is blocked, not scored',()=>{
 const r=runBacktest({interactions:standard(),knowledge:[],now:NOW});
 assert.equal(r.totals.pairs,22);assert.equal(r.totals.unassigned,0);
 const price=r.topics.find(t=>t.topic.neverAuto);
 assert.equal(price.blocked,6);assert.equal(price.scored,0);assert.equal(price.knowledgeSuggestion,null);
 for(const t of r.topics){assert.equal(t.scored,0);assert.equal(t.confidence.status,'insufficient_data');assert.equal(t.confidence.confidence,null);}
 const open=r.topics.filter(t=>!t.topic.neverAuto);
 assert.equal(open.length,2);
 for(const t of open){assert.equal(t.uncovered,t.pairs);assert.equal(t.knowledgeSuggestion.status,'draft');}
});
test('matching approved knowledge yields accepted outcomes; a wrong figure in knowledge yields rejections',()=>{
 const good=runBacktest({interactions:standard(),knowledge:knowledge(HOURS_REPLY),now:NOW});
 const hours=good.topics.find(t=>t.scored>0);
 assert.ok(hours.scored>=1);
 for(const o of hours.outcomes){assert.equal(o.outcome,'accepted');assert.equal(o.source,'backtest');assert.ok(o.similarity>=0.8);}
 const bad=runBacktest({interactions:standard(),knowledge:knowledge('ساعت کاری ما شنبه تا چهارشنبه ۱۰ تا ۲۰ است'),now:NOW});
 const wrong=bad.topics.find(t=>t.scored>0);
 for(const o of wrong.outcomes)assert.equal(o.outcome,'rejected');
});
test('enough consistent history reaches a measured confidence; one wrong knowledge figure cannot',()=>{
 const rows=conversations(Array.from({length:40},()=>['ساعت کاری شما چیه؟',HOURS_REPLY]));
 const ok=runBacktest({interactions:rows,knowledge:knowledge(HOURS_REPLY),now:NOW,discovery:{minCustomers:3}});
 const t=ok.topics[0];
 assert.equal(t.scored,40);assert.equal(t.confidence.status,'measured');assert.ok(t.confidence.confidence>=0.9);
 assert.equal(t.confidence.shadowSamples,40,'backtest outcomes count as shadow evidence');
 const wrong=runBacktest({interactions:rows,knowledge:knowledge('ساعت کاری ما ۱۰ تا ۲۰ است'),now:NOW});
 assert.ok(wrong.topics[0].confidence.confidence===null||wrong.topics[0].confidence.confidence<0.2);
});
test('backtest is deterministic and does not mutate its input',()=>{
 const rows=standard(),snapshot=JSON.stringify(rows);
 const a=runBacktest({interactions:rows,knowledge:knowledge(HOURS_REPLY),now:NOW});
 const b=runBacktest({interactions:[...rows].reverse(),knowledge:knowledge(HOURS_REPLY),now:NOW});
 assert.equal(JSON.stringify(rows),snapshot);
 assert.deepEqual(a.topics.map(t=>[t.topic.key,t.pairs,t.scored]).sort(),b.topics.map(t=>[t.topic.key,t.pairs,t.scored]).sort());
 assert.deepEqual(runBacktest({now:NOW}).totals,{interactions:0,pairs:0,unassigned:0,topics:0});
});
test('summary drops per-message outcomes and term profiles but keeps the decision data',()=>{
 const s=summarizeBacktest(runBacktest({interactions:standard(),knowledge:knowledge(HOURS_REPLY),now:NOW}));
 for(const t of s.topics){assert.equal(t.outcomes,undefined);assert.equal(typeof t.samples,'number');assert.ok(t.confidence);}
 for(const t of s.discovered)assert.equal(t.profile,undefined);
});

// ---------- CLI ----------
test('CLI prints a report for an export file and rejects bad input with exit code 2',()=>{
 const dir=mkdtempSync(join(tmpdir(),'cima-bt-'));
 try{
  const file=join(dir,'export.json');
  writeFileSync(file,JSON.stringify({interactions:standard(),knowledge:knowledge(HOURS_REPLY)}));
  const out=execFileSync('node',['scripts/cima-backtest.mjs','--input',file,'--now','2026-11-22T09:00:00Z'],{cwd:new URL('..',import.meta.url).pathname,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  const report=JSON.parse(out);
  assert.equal(report.totals.topics,3);assert.equal(report.totals.pairs,22);
  assert.equal(spawnSync('node',['scripts/cima-backtest.mjs'],{cwd:new URL('..',import.meta.url).pathname}).status,2);
  writeFileSync(join(dir,'bad.json'),'{"nope":1}');
  assert.equal(spawnSync('node',['scripts/cima-backtest.mjs','--input',join(dir,'bad.json')],{cwd:new URL('..',import.meta.url).pathname}).status,2);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

// ---------- containment (static) ----------
test('API route is authenticated, entitlement-gated, tenant-scoped and strictly read-only',()=>{
 // Judge the code, not its comments (a comment may legitimately say "never sends").
 const route=read('../app/api/crm/topics/backtest/route.js').split('\n').filter(line=>!line.trim().startsWith('//')).join('\n');
 assert.match(route,/auth\.auth\.getUser\(\)/);assert.match(route,/has_active_crm/);
 assert.match(route,/status:\s*401|,401\)/);assert.match(route,/,403\)/);
 assert.match(route,/loadInteractions\(db,user\.id\)/);assert.match(route,/loadKnowledge\(db,user\.id\)/);   // both loaders are tenant-scoped (see topic-store tests)
 assert.doesNotMatch(route,/\.(insert|update|delete|upsert|rpc\('(?!has_active_crm))/);
 assert.doesNotMatch(route,/zernio|outbox|send/i);
 assert.match(route,/export async function GET/);assert.doesNotMatch(route,/export async function (POST|PUT|PATCH|DELETE)/);
});
test('discovery and backtest modules are pure: no network, sending or database access',()=>{
 for(const file of ['topic-discovery','backtest']){
  const src=read(`../lib/crm/${file}.mjs`);
  assert.doesNotMatch(src,/\bfetch\(|zernio|supabase|createClient|process\.env|outbox|sendMessage|writeFile/i,file);
 }
});

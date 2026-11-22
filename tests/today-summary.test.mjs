import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarizeToday,tehranDay} from '../lib/crm/today.mjs';

const NOW=Date.parse('2026-11-22T09:00:00Z'); // 12:30 in Tehran, 2026-11-22
const iso=(h)=>new Date(NOW+h*3600e3).toISOString();
const customers=[{id:'a',name:'علی'},{id:'b',name:'مریم'},{id:'c',name:'سارا'}];
const msg=(id,customer_id,direction,h,extra={})=>({id,customer_id,direction,kind:'message',channel:'instagram',body:'متن',occurred_at:iso(h),created_at:iso(h),...extra});

test('waiting = customers whose latest recorded interaction is inbound, newest first',()=>{
 const s=summarizeToday({customers,interactions:[
  msg('1','a','inbound',-5),msg('2','a','outbound',-4),msg('3','a','inbound',-1), // a waits
  msg('4','b','inbound',-6),msg('5','b','outbound',-2),                          // b answered
  msg('6','c','inbound',-3,{kind:'note'})                                         // note is not a waiting message
 ]},NOW);
 assert.deepEqual(s.waiting.map(x=>x.id),['a']);
});

test('follow-ups: due today or overdue only, scheduled only, Tehran calendar day',()=>{
 const s=summarizeToday({customers,tasks:[
  {id:'t1',status:'scheduled',due_at:iso(-30)},      // yesterday: overdue
  {id:'t2',status:'scheduled',due_at:iso(2)},        // later today
  {id:'t3',status:'scheduled',due_at:iso(30)},       // tomorrow: not due
  {id:'t4',status:'completed',due_at:iso(-30)},      // done
  {id:'t5',status:'scheduled',due_at:'not-a-date'},  // malformed must not crash or count
  {id:'t6',status:'cancelled',due_at:iso(-1)}
 ]},NOW);
 assert.deepEqual(s.due.map(t=>t.id).sort(),['t1','t2']);
 assert.deepEqual(s.overdue.map(t=>t.id),['t1']);
});

test('Tehran midnight boundary: 20:45Z is already the next day in Iran',()=>{
 assert.equal(tehranDay('2026-11-22T20:45:00Z'),'2026-11-23');
 assert.equal(tehranDay('2026-11-22T20:15:00Z'),'2026-11-22');
});

test('sales: only orders paid today count; pending list is separate; bad amounts are ignored',()=>{
 const s=summarizeToday({customers,orders:[
  {id:'o1',status:'paid',amount:'1000',created_at:iso(-1)},
  {id:'o2',status:'paid',amount:500,created_at:iso(-2)},
  {id:'o3',status:'paid',amount:9999,created_at:iso(-48)},   // old
  {id:'o4',status:'pending',amount:700,created_at:iso(-1)},
  {id:'o5',status:'paid',amount:'abc',created_at:iso(-1)},
  {id:'o6',status:'cancelled',amount:5,created_at:iso(-1)}
 ]},NOW);
 assert.equal(s.paidSum,1500);
 assert.deepEqual(s.pending.map(o=>o.id),['o4']);
});

test('open leads exclude won and lost; empty input is safe',()=>{
 const s=summarizeToday({leads:[{stage:'new'},{stage:'offered'},{stage:'won'},{stage:'lost'},null]},NOW);
 assert.equal(s.openLeads.length,2);
 const empty=summarizeToday(undefined,NOW);
 assert.equal(empty.waiting.length+empty.due.length+empty.pending.length,0);
});

test('Today board is read-only except completing a follow-up and never sends messages',()=>{
 const src=readFileSync(new URL('../components/TodayBoard.js',import.meta.url),'utf8');
 assert.doesNotMatch(src,/zernio|\/api\/crm\/reviews\/send|sima_prepare_human_send|sima_message_outbox|crm_interactions'\)\.(insert|update|delete)/i);
 const writes=[...src.matchAll(/\.(insert|update|delete|upsert)\(/g)].map(m=>m[1]);
 assert.deepEqual(writes,['update'],'only the follow-up completion writes');
 assert.match(src,/from\('crm_tasks'\)\.update\(\{status:'completed'/);
 assert.match(src,/\.eq\('tenant_id',userId\)/);
});

test('dashboard shows Today only for CRM subscribers and routes work into Sima sections',()=>{
 const dash=readFileSync(new URL('../components/CustomerDashboard.js',import.meta.url),'utf8');
 assert.match(dash,/tab==='overview'&&crmAccess&&<TodayBoard/);
 assert.match(dash,/tab==='overview'&&!crmAccess/);
 assert.match(dash,/request=\{crmRequest\}/);
 const sima=readFileSync(new URL('../components/crm/SimaWorkspace.js',import.meta.url),'utf8');
 assert.match(sima,/request\?\.section&&sections\[request\.section\]/);
});

test('overdue is an array: the UI must use its length (an empty array is truthy)',()=>{
 const src=readFileSync(new URL('../components/TodayBoard.js',import.meta.url),'utf8');
 assert.match(src,/overdue\.length\?styles\.hot/);
 assert.match(src,/overdue\.length\?`/);
 assert.doesNotMatch(src,/\boverdue\?/);
});

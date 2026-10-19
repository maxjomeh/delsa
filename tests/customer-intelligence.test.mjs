import test from 'node:test';
import assert from 'node:assert/strict';
import {customerIntelligence,rankCustomers} from '../lib/crm/customer-intelligence.mjs';
const NOW=Date.parse('2026-10-19T08:00:00Z');
const client={id:'c1',tenant_id:'t1',name:'مشتری نمونه',phone:'09123456789',status:'active',tags:'دوستدار محصول'};
const other={id:'c2',tenant_id:'t1',name:'مشتری دوم',status:'new'};
const item=(x)=>({customer_id:'c1',...x});
test('Empty customer has no fabricated score or AI recommendation',()=>{
 const profiles=customerIntelligence([client],[],[],[],[],[],NOW);
 assert.equal(profiles[0].score,null);
 assert.equal(profiles[0].hasSignal,false);
 assert.equal(profiles[0].next.kind,'none');
 assert.deepEqual(profiles[0].timeline,[]);
});
test('Inbound response and overdue task are surfaced; messages never auto send',()=>{
 const interactions=[item({id:'i1',direction:'outbound',kind:'message',channel:'instagram',body:'سلام',occurred_at:'2026-10-17T08:00:00Z'}),item({id:'i2',direction:'inbound',kind:'message',channel:'instagram',body:'قیمت؟',occurred_at:'2026-10-18T08:00:00Z'})];
 const tasks=[item({id:'t1',status:'scheduled',title:'پیگیری سفارش',due_at:'2026-10-18T10:00:00Z',created_at:'2026-10-17T08:00:00Z'})];
 const profiles=customerIntelligence([client,other],interactions,[],[],tasks,[],NOW);
 assert.equal(profiles[0].needsReply,true);
 assert.equal(profiles[0].overdue,true);
 assert.equal(profiles[0].next.kind,'reply');
 assert.equal(profiles[1].score,null);
 assert.ok(profiles[0].score>profiles[1].score??0);
 assert.ok(profiles[0].timeline.some(x=>x.id==='i:i2'));
 assert.ok(profiles[0].timeline.some(x=>x.id==='t:t1'));
});
test('Opt-out suppresses communication recommendation and score',()=>{
 const profiles=customerIntelligence([{...client,do_not_contact:true}],[],[{id:'o1',customer_id:'c1',status:'paid',amount:10000}],[],[],[],NOW);
 assert.equal(profiles[0].next.kind,'blocked');
 assert.equal(profiles[0].score,null);
 assert.equal(profiles[0].spend,10000);
});
test('Only paid orders contribute to spend and repeat purchase evidence',()=>{
 const orders=[item({id:'o1',status:'paid',amount:500}),item({id:'o2',status:'pending',amount:1200}),item({id:'o3',status:'paid',amount:1500})];
 const p=customerIntelligence([client],[],orders,[],[],[],NOW)[0];
 assert.equal(p.spend,2000);
 assert.equal(p.orderCount,2);
 assert.ok(p.reasons.some(x=>x.text==='خرید تکراری'));
 assert.equal(p.timeline.length,0); // no dates: untrustworthy event timestamps are not invented
});
test('Filters and ranking exclude irrelevant people and sort by explainable score',()=>{
 const ps=customerIntelligence([client,other],[item({id:'i1',kind:'message',direction:'inbound',occurred_at:'2026-10-19T07:00:00Z',body:'سلام'})],[],[],[],[],NOW);
 assert.deepEqual(rankCustomers(ps,'needs_reply').map(x=>x.customer.id),['c1']);
 assert.deepEqual(rankCustomers(ps,'all','دوم').map(x=>x.customer.id),['c2']);
 assert.equal(rankCustomers(ps,'quiet').length,1);
 assert.equal(rankCustomers(ps,'all')[0].customer.id,'c1');
});

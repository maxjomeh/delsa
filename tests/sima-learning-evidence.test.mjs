import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverFieldPatterns,extractEvidence,calibrateConfidence} from '../lib/crm/learning-evidence.mjs';
test('self-disclosed Persian phone candidate has high confidence, only from inbound',()=>{
 const p=extractEvidence([{id:'m1',customer_id:'c1',kind:'message',direction:'inbound',body:'شماره تماس من ۰۹۱۲۳۴۵۶۷۸۹ هست'}]);
 assert.equal(p[0].value,'09123456789');
 assert.equal(p[0].confidence,.96);
 assert.equal(p[0].interaction_id,'m1');
 assert.deepEqual(extractEvidence([{id:'m2',customer_id:'c1',kind:'message',direction:'outbound',body:'شماره 09123456789'}]),[]);
});
test('repeated truck questions must involve at least three distinct customers',()=>{
 const rows=['a','b','c'].map((id,i)=>({id:'i'+i,customer_id:id,kind:'message',direction:'outbound',body:'مدل کشنده شما چیه؟'}));
 assert.equal(discoverFieldPatterns(rows.slice(0,2)).length,0);
 const suggestions=discoverFieldPatterns(rows);
 assert.equal(suggestions.length,1);
 assert.equal(suggestions[0].key,'truck_model');
 assert.equal(suggestions[0].support_count,3);
 assert.ok(suggestions[0].confidence<1);
});
test('trucks are candidate evidence, not invented facts',()=>{
 const p=extractEvidence([{id:'m3',customer_id:'c1',kind:'message',direction:'inbound',body:'من کشنده ولوو FH500 دارم'}]);
 assert.equal(p.length,1);
 assert.equal(p[0].kind,'truck_model');
 assert.match(p[0].value,/ولوو/);
 assert.ok(p[0].confidence<.9);
});

test('tenant-review feedback updates scores without treating probabilities as facts',()=>{
 assert.equal(calibrateConfidence(.78,0,0),.78);
 assert.ok(calibrateConfidence(.78,10,0)>.78);
 assert.ok(calibrateConfidence(.78,0,10)<.78);
 assert.ok(calibrateConfidence(.96,0,100)<.5);
 assert.ok(calibrateConfidence(.8,1000,0)<1);
});

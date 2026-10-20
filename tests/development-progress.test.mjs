import test from 'node:test';
import assert from 'node:assert/strict';
import {PHASES,BASELINE_SHA,score,phaseSummary,productSummary,applyVerifiedRelease} from '../lib/development/progress.mjs';

test('CIMA blueprint has seven phases and exactly 72 reviewed subfeatures',()=>{
 assert.deepEqual(PHASES.map(x=>x.number),[0,1,2,3,4,5,6]);
 assert.equal(PHASES.reduce((s,p)=>s+p.features.length,0),72);
 assert.equal(PHASES.reduce((s,p)=>s+p.weight,0),100);
 for(const p of PHASES){
  assert.equal(p.features.reduce((s,f)=>s+f.weight,0),100);
  assert.ok(p.features.every(f=>f.implementation>=0&&f.implementation<=100&&f.readiness>=0&&f.readiness<=100));
  assert.equal(phaseSummary(p).score,score(phaseSummary(p)));
 }
});
test('baseline shows independently audited implementation and production readiness',()=>{
 const x=productSummary(PHASES);
 assert.equal(x.implementation,59.5);
 assert.equal(x.readiness,34.7);
 assert.equal(x.score,45.9);
});
test('unrelated commit or passing deployment never automatically raises a feature score',()=>{
 const sha='f'.repeat(40);
 const baseline=productSummary(PHASES).score;
 for(const evidence of [
  {productionSha:BASELINE_SHA,ciPassed:true,changedFiles:[],treeFiles:[],completeComparison:true},
  {productionSha:sha,ciPassed:true,changedFiles:[],treeFiles:[],completeComparison:true},
  {productionSha:sha,ciPassed:false,changedFiles:['app/api/crm/reviews/send/route.js'],treeFiles:['app/api/crm/reviews/send/route.js','tests/cima-human-send.test.mjs'],completeComparison:true},
  {productionSha:sha,ciPassed:true,changedFiles:['app/api/crm/reviews/send/route.js'],treeFiles:['app/api/crm/reviews/send/route.js'],completeComparison:true}
 ]){
  const v=applyVerifiedRelease(PHASES,evidence);
  assert.equal(v.promotions,0);
  assert.equal(productSummary(v.phases).score,baseline);
 }
});
test('a new verified source change on active production grants only bounded technical credit',()=>{
 const sha='e'.repeat(40),p='app/api/crm/reviews/send/route.js',t='tests/cima-human-send.test.mjs';
 const input={productionSha:sha,ciPassed:true,changedFiles:[p],treeFiles:[p,t],completeComparison:true};
 const result=applyVerifiedRelease(PHASES,input);
 assert.ok(result.promotions>=1);
 const feature=PHASES[2].features.find(f=>f.label.includes('ارسال واقعی'));
 const changed=result.phases[2].features.find(f=>f.id===feature.id);
 assert.equal(changed.implementation,Math.min(95,feature.implementation+5));
 assert.equal(changed.readiness,Math.min(80,feature.readiness+3));
 assert.equal(changed.autoVerified,true);
 const again=applyVerifiedRelease(PHASES,input);
 assert.deepEqual(result,again,'reloading the same commit must not stack boosts');
});

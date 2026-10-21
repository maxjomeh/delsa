import test from 'node:test';
import assert from 'node:assert/strict';
import {productionEvidenceForTasks} from '../lib/devos/release-evidence.mjs';
const sha='a0fb05feeef2671b4b6f51c7f63858b3fe414629';
const t=[{id:'a',status:'released'},{id:'b',status:'preview'},{id:'c',status:'verified'}];
test('production proof matches released task and exact active SHA',()=>{
 const r=productionEvidenceForTasks(t,[{task_id:'a',kind:'production_deployed',verdict:'passed',commit_sha:sha}],sha);
 assert.equal(r.size,1);assert.ok(r.has('a'));
});
test('CI success, Preview READY, stale SHA, and incomplete tasks never assert active production',()=>{
 const e=[
  {task_id:'a',kind:'ci',verdict:'passed',commit_sha:sha},
  {task_id:'a',kind:'preview',verdict:'passed',commit_sha:sha},
  {task_id:'a',kind:'production_deployed',verdict:'passed',commit_sha:'28d4e6dc93c06c891965de8afe3dbeafe73a09a2'},
  {task_id:'b',kind:'production_deployed',verdict:'passed',commit_sha:sha}
 ];
 assert.equal(productionEvidenceForTasks(t,e,sha).size,0);
});
test('missing or malformed SHA cannot give false production status',()=>{
 const e=[{task_id:'c',kind:'production_deployed',verdict:'passed',commit_sha:sha}];
 assert.equal(productionEvidenceForTasks(t,e,'').size,0);
 assert.equal(productionEvidenceForTasks(t,e,'a0fb05fe').size,0);
});
test('a failed production receipt cannot qualify',()=>{
 const e=[{task_id:'a',kind:'production_deployed',verdict:'failed',commit_sha:sha}];
 assert.equal(productionEvidenceForTasks(t,e,sha).size,0);
});

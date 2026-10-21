import test from 'node:test';
import assert from 'node:assert/strict';
import {progressByTask,executionSummary,auditMetrics,validProgress} from '../lib/devos/progress.mjs';
const tasks=[
 {id:'a',progress_percent:null,product_codes:['cima']},
 {id:'b',parent_task_id:'a',progress_percent:40,product_codes:['cima']},
 {id:'c',parent_task_id:'a',progress_percent:80,product_codes:['cima']},
 {id:'d',progress_percent:null,product_codes:['apu']}
];
test('documented progress is human-entered, not status-derived',()=>{
 assert.equal(progressByTask([{id:'z',status:'verified',progress_percent:null}]).get('z').value,null);
 assert.equal(progressByTask([{id:'z',status:'ready',progress_percent:35}]).get('z').value,35);
});
test('parents derive dynamic percentages from child leaves',()=>{
 assert.equal(progressByTask(tasks).get('a').value,60);
 assert.equal(progressByTask(tasks).get('b').value,40);
 assert.equal(progressByTask(tasks).get('c').value,80);
});
test('unassessed leaves do not inflate overall progress',()=>{
 assert.deepEqual(executionSummary(tasks),{value:40,assessed:2,total:3});
 assert.deepEqual(executionSummary(tasks,'cima'),{value:60,assessed:2,total:2});
 assert.deepEqual(executionSummary(tasks,'apu'),{value:0,assessed:0,total:1});
});
test('unassessed parent displays unknown rather than an invented zero-percent score',()=>{
 const p=progressByTask([{id:'x',progress_percent:null},{id:'y',parent_task_id:'x',progress_percent:null}]).get('x');
 assert.equal(p.value,null);assert.equal(p.assessed,0);
});
test('audited measures remain separate from task completion',()=>{
 assert.deepEqual(auditMetrics([{totals:{score:42,implementation:70,readiness:20}}]),{score:42,implementation:70,readiness:20,audited:1});
});
test('progress field accepts only integer 0 to 100 or blank',()=>{
 assert.equal(validProgress(0),true);assert.equal(validProgress(100),true);
 assert.equal(validProgress(null),true);assert.equal(validProgress(101),false);
 assert.equal(validProgress(40.5),false);
});
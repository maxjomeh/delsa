import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDevelopmentHierarchy,filterDevelopmentHierarchy,hierarchyCounts,findTreeNode} from '../lib/devos/hierarchy.mjs';
const products=[
 {code:'cima',name:'سیما',totals:{score:40},phases:[{number:0,name:'ایمنی',score:60,features:[{id:'p0f4',label:'ارسال انسانی امن',score:45,implementation:80,readiness:20}]}]},
 {code:'apu',name:'APU',phases:[]}
];
const tasks=[
 {id:'a',task_key:'CIMA-004',title:'ارسال انسانی',scope:'product',product_codes:['cima'],feature_ref:'p0f4',priority:'P0',status:'ready',sprint_id:'s01'},
 {id:'b',task_key:'DEV-000010',title:'تست ارسال',scope:'product',product_codes:['cima'],parent_task_id:'a',feature_ref:'p0f4',priority:'P0',status:'testing',sprint_id:'s01'},
 {id:'c',task_key:'DEV-000011',title:'بررسی رسید واقعی',scope:'product',product_codes:['cima'],parent_task_id:'b',feature_ref:'p0f4',priority:'P1',status:'ready',sprint_id:'s01'},
 {id:'d',task_key:'DEV-000012',title:'استاندارد امنیت سراسری',scope:'platform',product_codes:[],priority:'P1',status:'ready',sprint_id:null},
 {id:'e',task_key:'DEV-000013',title:'موتور اشتراکی',scope:'cross_product',product_codes:['apu','cima'],priority:'P2',status:'ready',sprint_id:null}
];
test('unified tree nests roadmap, tasks, and arbitrarily deep subtasks without duplication',()=>{
 const tree=buildDevelopmentHierarchy(products,tasks);
 const feature=findTreeNode(tree,'cima:feature:p0f4');
 assert.equal(feature.children[0].data.task.task_key,'CIMA-004');
 assert.equal(feature.children[0].children[0].children[0].data.task.title,'بررسی رسید واقعی');
 assert.equal(hierarchyCounts(tree).tasks,5);
 assert.equal(hierarchyCounts(tree).features,1);
});
test('global and cross-product tasks are visible independently of product roadmap',()=>{
 const tree=buildDevelopmentHierarchy(products,tasks);
 assert.ok(findTreeNode(tree,'area:platform').children.some(n=>n.data.task.id==='d'));
 assert.ok(findTreeNode(tree,'area:cross_product').children.some(n=>n.data.task.id==='e'));
});
test('Sprint filters are annotations, never parallel trees',()=>{
 const tree=filterDevelopmentHierarchy(buildDevelopmentHierarchy(products,tasks),{sprintId:'s01'});
 assert.equal(hierarchyCounts(tree).tasks,3);
 assert.equal(findTreeNode(tree,'area:platform'),null);
 assert.equal(findTreeNode(tree,'cima:feature:p0f4').children[0].children.length,1);
});
test('status filters preserve ancestors while removing unrelated tasks',()=>{
 const tree=filterDevelopmentHierarchy(buildDevelopmentHierarchy(products,tasks),{status:'testing'});
 assert.equal(hierarchyCounts(tree).tasks,2); // parent retained to reveal matching child
 assert.equal(findTreeNode(tree,'area:platform'),null);
});
test('search matches deep tasks without losing contextual parent path',()=>{
 const tree=filterDevelopmentHierarchy(buildDevelopmentHierarchy(products,tasks),{search:'رسید واقعی'});
 assert.equal(hierarchyCounts(tree).tasks,3);
 assert.equal(tree.children.length,1);
});
test('bad or cyclic legacy parent link never results in recursion or hidden tasks',()=>{
 const tasksWithCycle=[{...tasks[0],parent_task_id:'b'},{...tasks[1],parent_task_id:'a'},...tasks.slice(2)];
 const tree=buildDevelopmentHierarchy(products,tasksWithCycle);
 assert.equal(hierarchyCounts(tree).tasks,5);
});
test('score on roadmap comes from existing audit data, not task completion',()=>{
 const data=buildDevelopmentHierarchy(products,tasks);
 const feat=findTreeNode(data,'cima:feature:p0f4');
 assert.equal(feat.data.feature.score,45);
 assert.equal(feat.children[0].data.task.status,'ready');
});

test('task created at phase level stays under that phase, not the product root',()=>{
 const phaseTask={id:'phase-task',task_key:'DEV-000099',title:'ممیزی عمومی فاز',scope:'product',product_codes:['cima'],feature_ref:'p0',priority:'P1',status:'ready'};
 const tree=buildDevelopmentHierarchy(products,[phaseTask]);
 const phase=findTreeNode(tree,'cima:phase:p0'),product=findTreeNode(tree,'product:cima');
 assert.ok(phase.children.some(n=>n.kind==='task'&&n.data.task.id==='phase-task'));
 assert.ok(!product.children.some(n=>n.kind==='task'&&n.data.task.id==='phase-task'));
});

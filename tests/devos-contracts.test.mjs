import test from 'node:test';
import assert from 'node:assert/strict';
import {STATUSES,SCOPES,TYPES,WORKSTREAMS,PRIORITIES,EVIDENCE_KINDS,isUuid,validTaskInput,validCriteria,validSHA,validURL} from '../lib/devos/contracts.mjs';
const template={title:'پیاده سازی تست واقعی سیما',scope:'product',productCodes:['cima'],workstream:'engineering',taskType:'bug',priority:'P0',status:'ready',acceptanceCriteria:['تست واقعی موفق باشد'],sprintId:null};
test('Every allowed state and evidence kind is unique',()=>{
 for(const arr of [STATUSES,SCOPES,TYPES,WORKSTREAMS,EVIDENCE_KINDS])assert.equal(new Set(arr.map(x=>x[0])).size,arr.length);
 assert.deepEqual(PRIORITIES,['P0','P1','P2','P3']);
});
test('CIMA task passes required schema',()=>assert.equal(validTaskInput(template),true));
test('platform and multi product areas supported',()=>{
 assert.equal(validTaskInput({...template,scope:'platform',productCodes:[]}),true);
 assert.equal(validTaskInput({...template,scope:'cross_product',productCodes:['apu','cima']}),true);
 assert.equal(validTaskInput({...template,scope:'product',productCodes:['apu','cima']}),false);
});
test('bad status and missing acceptance rejected',()=>{
 assert.equal(validTaskInput({...template,status:'verified_by_build'}),false);
 assert.equal(validTaskInput({...template,acceptanceCriteria:['']}),false);
});
test('uuid, SHA and https proof validators',()=>{
 assert.equal(isUuid('00000000-0000-0000-0000-000000000001'),true);
 assert.equal(isUuid('bad'),false);
 assert.equal(validSHA('f'.repeat(40)),true);
 assert.equal(validSHA('abc'),false);
 assert.equal(validURL('https://github.com/maxjomeh/delsa/pull/1'),true);
 assert.equal(validURL('javascript:alert(1)'),false);
});
test('criteria length bounded',()=>assert.equal(validCriteria(Array(25).fill('شاهد')),false));

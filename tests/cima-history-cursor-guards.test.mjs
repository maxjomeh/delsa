import test from 'node:test';
import assert from 'node:assert/strict';
import {validHistoryConversation,historyNextCursor} from '../lib/crm/zernio-history-guard.mjs';

const job={account_id:'abcdef123456789012345678'};
const conversation={id:'thread-01',participantId:'participant-01',accountId:job.account_id};

test('accepts valid account-scoped conversations and rejects cross-account data',()=>{
 assert.equal(validHistoryConversation(job,conversation),true);
 assert.equal(validHistoryConversation(job,{...conversation,accountId:'000000000000000000000000'}),false);
 assert.equal(validHistoryConversation(job,{...conversation,id:' '}),false);
 assert.equal(validHistoryConversation(job,{...conversation,id:'x'.repeat(181)}),false);
 assert.equal(validHistoryConversation(job,{...conversation,participantId:' '}),false);
 assert.equal(validHistoryConversation(job,{...conversation,participantId:'x'.repeat(201)}),false);
});

test('ends pagination without further pages',()=>{
 assert.equal(historyNextCursor({hasMore:false,nextCursor:'unused'},'previous','MESSAGE_CURSOR'),null);
 assert.equal(historyNextCursor(null,'previous','MESSAGE_CURSOR'),null);
});

test('advances a valid cursor without modifying provider response',()=>{
 const page={hasMore:true,nextCursor:'next'};
 assert.equal(historyNextCursor(page,'previous','MESSAGE_CURSOR'),'next');
 assert.equal(page.nextCursor,'next');
});

test('rejects missing, malformed and oversized cursors',()=>{
 for(const value of [undefined,'','x'.repeat(1025),42]){
  assert.throws(()=>historyNextCursor({hasMore:true,nextCursor:value},'previous','UPSTREAM_CURSOR'),{code:'UPSTREAM_CURSOR_MISSING'});
 }
});

test('fails closed when conversation or message pagination repeats a cursor',()=>{
 for(const kind of ['UPSTREAM_CURSOR','MESSAGE_CURSOR']){
  assert.throws(()=>historyNextCursor({hasMore:true,nextCursor:'repeat'},'repeat',kind),{code:kind+'_STALLED'});
 }
});

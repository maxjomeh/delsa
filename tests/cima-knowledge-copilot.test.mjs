import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessRisk,rankKnowledge,decideGroundedDraft,tokens} from '../lib/crm/cima-grounding.mjs';
const source=(id,question,answer,extra={})=>({id,question,title:question,answer,revision:1,status:'approved',...extra});
const fa=source('k-1','ساعات پاسخگویی پشتیبانی چه زمانی است','پشتیبانی شنبه تا چهارشنبه ۹ تا ۱۷ است.');
test('approved matched FAQ produces an exact source-quoted draft but never calibrated confidence',()=>{
 const c=decideGroundedDraft('ساعات پاسخگویی پشتیبانی چه زمانی است',[fa]);
 assert.equal(c.kind,'approved_faq');assert.equal(c.suggestion,fa.answer);
 assert.equal(c.citations[0].id,'k-1');assert.equal(c.citations[0].revision,1);
 assert.equal(c.confidence,null);assert.equal(c.confidenceStatus,'uncalibrated');
 assert.ok(c.reasonCodes.includes('HUMAN_APPROVAL_REQUIRED'));
});
test('price, stock, parts compatibility and commitments are gated regardless of FAQ relevance',()=>{
 for(const msg of ['قیمت دلار این قطعه چقدره؟','موجودی این کالا چقدره؟','این لنت به ترمز کشنده میخوره؟','تخفیف و پرداخت اقساطی دارید؟']){
  const result=decideGroundedDraft(msg,[source('k-2',msg,'بله همه چیز قطعی است')]);
  assert.equal(result.kind,'blocked');assert.equal(result.suggestion,null);
  assert.equal(result.riskLevel,'high');assert.ok(result.reasonCodes.length);
 }
});
test('unapproved, revoked, expired or unrelated knowledge never becomes a suggested answer',()=>{
 assert.equal(decideGroundedDraft('ساعات پاسخگویی پشتیبانی چه زمانی است',[]).kind,'no_knowledge');
 assert.equal(decideGroundedDraft('ساعات پاسخگویی پشتیبانی چه زمانی است',[{...fa,status:'draft'}]).kind,'no_knowledge');
 assert.equal(rankKnowledge('ساعات پاسخگویی پشتیبانی چه زمانی است',[{...fa,status:'revoked'}]).length,0);
 assert.equal(rankKnowledge('ساعات پاسخگویی پشتیبانی چه زمانی است',[{...fa,expires_at:'2020-01-01T00:00:00Z'}]).length,0);
 assert.equal(decideGroundedDraft('آدرس فروشگاه کجاست',[fa]).kind,'no_knowledge');
});
test('Persian normalization is deterministic and opt-out blocks all suggestions',()=>{
 assert.deepEqual(tokens('ساعت كالا'),tokens('ساعت کالا'));
 const c=decideGroundedDraft('ساعات پاسخگویی پشتیبانی چه زمانی است',[fa],{doNotContact:true});
 assert.equal(c.kind,'blocked');assert.ok(c.reasonCodes.includes('CONTACT_OPTED_OUT'));
});
test('endpoints gate access and NEVER dispatch AI suggestions',()=>{
 const copilot=readFileSync('app/api/crm/copilot/route.js','utf8');
 const knowledge=readFileSync('app/api/crm/knowledge/route.js','utf8');
 const sql=readFileSync('supabase/migrations/20261020_cima_knowledge_copilot.sql','utf8');
 assert.match(copilot,/has_active_crm/);assert.match(copilot,/\.eq\('tenant_id',ctx\.id\)/);
 assert.match(copilot,/conversation_version!==body\.version/);assert.match(copilot,/autoSend:false/);
 assert.doesNotMatch(copilot,/sima_prepare_human_send|sima_claim_human_send|zernioRequest\(/);
 assert.match(copilot,/store:false/);assert.match(copilot,/OPENAI_API_KEY/);
 assert.match(knowledge,/has_active_crm/);assert.match(knowledge,/revision:current\.revision\+1/);
 assert.match(sql,/row level security/);assert.match(sql,/check\(confidence is null\)/);
 assert.match(sql,/sima_knowledge_revisions/);
});

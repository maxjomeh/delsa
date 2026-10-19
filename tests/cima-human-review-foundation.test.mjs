import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const load=path=>readFileSync(path,'utf8');
const intelligence=load('app/api/crm/intelligence/route.js');
const reviewApi=load('app/api/crm/reviews/route.js');
const reviewUI=load('components/crm/HumanReviewWorkspace.js');
const workspace=load('components/crm/SimaWorkspace.js');
const sql=load('supabase/migrations/20261019_cima_review_canonical_zernio_messages.sql');
const sqlBase=load('supabase/migrations/20261019_cima_human_review_foundation.sql');

test('CIMA never auto-updates phones or creates new unapproved CRM columns from discovery',()=>{
 assert.doesNotMatch(intelligence,/\.from\('crm_customers'\)\.update\(/);
 assert.doesNotMatch(intelligence,/\.from\('crm_field_definitions'\)\.insert\(/);
 assert.match(intelligence,/\.from\('crm_learning_suggestions'\)\.insert\(/);
 assert.match(intelligence,/phoneUpdates:0/);
 assert.match(intelligence,/reviewRequired:true/);
});

test('Human Inbox API enforces owner subscription, tenant scoping, and stale version guard',()=>{
 assert.match(reviewApi,/auth\.auth\.getUser\(\)/);
 assert.match(reviewApi,/auth\.rpc\('has_active_crm'\)/);
 assert.match(reviewApi,/\.eq\('tenant_id',owner\.id\)/);
 assert.match(reviewApi,/\.eq\('conversation_version',body\.version\)/);
 assert.match(reviewApi,/stale_conversation_refresh_required/);
 assert.match(reviewApi,/dispatched:false/);
 assert.doesNotMatch(reviewApi,/zernioRequest|\/sendMessage|\/messages\/send/);
});

test('Review UI distinguishes drafts from actual dispatch and displays real history',()=>{
 assert.match(workspace,/reviews:'نیازمند پاسخ شما'/);
 assert.match(workspace,/section==='reviews'&&<HumanReviewWorkspace/);
 assert.match(reviewUI,/هیچ پیامی به مشتری ارسال نشده است/);
 assert.match(reviewUI,/سابقه|تاریخچه/);
 assert.match(reviewUI,/stale|conversation_version/);
});

test('Database review queue is tenant isolated, always human initially, and uses source message fingerprints',()=>{
 assert.match(sqlBase,/row level security/i);
 assert.match(sqlBase,/create policy sima_review_read_own/);
 assert.match(sqlBase,/MODEL_NOT_VALIDATED/);
 assert.match(sqlBase,/AFTER INSERT ON public\.crm_interactions/i);
 assert.match(sql,/zernio-msg:/);
 assert.match(sql,/md5\(e\.account_id/);
 assert.match(sql,/where rn=1 and direction='inbound'/);
 assert.doesNotMatch(sql,/\binsert into public\.crm_interactions\b/i);
});

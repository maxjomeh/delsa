import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {outboxStatusText} from '../lib/crm/cima-outbox-status.mjs';
const sql=readFileSync('supabase/migrations/20261021_cima_pending_outbox_reconciliation.sql','utf8');
const ui=readFileSync('components/crm/HumanReviewWorkspace.js','utf8');
const api=readFileSync('app/api/crm/reviews/send/route.js','utf8');
test('reconciler only closes strictly unattempted pending rows with explicit reason',()=>{
 assert.match(sql,/o.status='pending' and o.attempt_count=0/g);
 assert.match(sql,/r.last_occurred_at<now\(\)-interval '23 hours'/);
 assert.match(sql,/review_closed_before_send/);
 assert.match(sql,/reply_window_closed_before_send/);
 assert.match(sql,/for update of o skip locked/i);
 assert.match(sql,/l.reason is not null/);
});
test('reconciliation contains no dispatch or unsafe replay',()=>{
 assert.doesNotMatch(sql,/zernioRequest|http_post|net\.http|insert into public\.sima_message_outbox/i);
 assert.doesNotMatch(sql,/where o.status='sending'|where o.status='unknown'/);
 assert.match(sql,/revoke all on function public\.sima_reconcile_unattempted_outbox\(integer\) from public,anon,authenticated/);
 assert.match(sql,/grant execute on function public\.sima_reconcile_unattempted_outbox\(integer\) to service_role/);
});
test('human UI distinguishes local cancellation, provider receipt and ambiguous delivery',()=>{
 assert.match(ui,/outboxStatusText/);
 assert.match(api,/sima_claim_human_send/);
 assert.match(api,/delivered:false/);
 assert.equal(outboxStatusText({status:'rejected',attempt_count:0,provider_error_code:'reply_window_closed_before_send'}),
 'بازهٔ مجاز پاسخ به اینستاگرام تمام شده است؛ پیام اصلاً ارسال نشد.');
 assert.match(outboxStatusText({status:'rejected',attempt_count:1}),/ارائه‌دهنده/);
 assert.match(outboxStatusText({status:'unknown',attempt_count:1}),/نامشخص/);
});

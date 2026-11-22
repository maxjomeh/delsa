import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const code=src=>src.split('\n').filter(l=>!l.trim().startsWith('//')).join('\n');
const owner=code(read('../app/api/crm/auto/route.js'));
const cron=code(read('../app/api/crm/auto/run/route.js'));
const sql=read('../supabase/migrations/20261124_cima_auto_send.sql');

test('owner route: authenticated, CRM-entitled, same-origin, bounded; ON and RESUME need acknowledgement, STOP never does',()=>{
 assert.match(owner,/auth\.auth\.getUser\(\)/);assert.match(owner,/has_active_crm/);
 assert.match(owner,/status:401/);assert.match(owner,/status:403/);
 assert.match(owner,/request\.headers\.get\('origin'\)!==new URL\(request\.url\)\.origin/);
 assert.match(owner,/content-length[^;]*>5000/);
 for(const action of ['enable','disable','pause','resume','set_caps','mark_wrong'])assert.match(owner,new RegExp(`'${action}'`),action);
 assert.match(owner,/enableAuto\(db,ctx\.id,\{acknowledged:body\.acknowledged\}\)/);
 assert.match(owner,/resumeAuto\(db,ctx\.id,\{acknowledged:body\.acknowledged\}\)/);
 assert.match(owner,/pauseAuto\(db,ctx\.id\)/);assert.match(owner,/disableAuto\(db,ctx\.id\)/);
 assert.match(owner,/error:'invalid_action'/);assert.match(owner,/uuid\(body\.id\)/);
 assert.doesNotMatch(owner,/export async function (PUT|PATCH|DELETE)/);
});
test('owner route never sends, never touches tables itself, and exposes the server mode but nothing secret',()=>{
 assert.doesNotMatch(owner,/zernio|dispatch|outbox|sendMessage|rpc\('sima_/i);
 assert.doesNotMatch(owner,/db\.from\(/,'all access goes through the tenant-scoped store');
 assert.match(owner,/serverMode:autoMode\(\)/);
 assert.doesNotMatch(owner,/process\.env/);
 for(const call of owner.matchAll(/(?:autoOverview|enableAuto|disableAuto|pauseAuto|resumeAuto|setCaps|markWrong)\(db,([^,)]+)/g))assert.equal(call[1],'ctx.id');
});
test('cron route: bearer secret with a minimum length and constant-time comparison; OFF short-circuits before any database access',()=>{
 assert.match(cron,/CIMA_AUTO_CRON_SECRET/);assert.match(cron,/secret\.length<32/);assert.match(cron,/timingSafeEqual/);
 assert.match(cron,/status:401|,401\)/);
 const permittedAt=cron.indexOf('permitted(request)'),offAt=cron.indexOf("mode==='off'"),dbAt=cron.indexOf('serverDatabase()');
 assert.ok(permittedAt>-1&&permittedAt<offAt&&offAt<dbAt,'auth first, then OFF, then (only then) the database');
 assert.match(cron,/mode==='live'&&\(process\.env\.ZERNIO_CONNECT_ENABLED!=='true'\|\|!process\.env\.ZERNIO_API_KEY\)/);
 assert.match(cron,/export const GET=handle/);assert.match(cron,/export const POST=handle/);
});
test('cron route: no message text in the response, bounded work, failures contained per tenant, not scheduled by the repository',()=>{
 assert.doesNotMatch(cron.split('\n').filter(l=>!l.startsWith('import ')).join('\n'),/answer_text|\banswer\b|body:\s*claimed|message:/);   // (the import of auto-answer.mjs is a file name, not a response field)
 assert.match(cron,/limit\(50\)/);assert.match(cron,/limit:5/);assert.match(cron,/45000/);assert.match(cron,/catch\{results\.push/);
 assert.doesNotMatch(cron,/setTimeout|setInterval|retry\s*\(/);
 if(existsSync(new URL('../vercel.json',import.meta.url)))assert.doesNotMatch(read('../vercel.json'),/auto\/run/,'the repository does not schedule automatic replies');
 assert.match(cron,/senderConnected/);assert.match(cron,/item\.platform==='instagram'&&item\.connected/);
});
test('the human send route and its migrations are untouched by automatic replies',()=>{
 const human=read('../app/api/crm/reviews/send/route.js');
 assert.doesNotMatch(human,/auto|cima_auto/i);
 const outbox=read('../supabase/migrations/20261019_cima_human_send_outbox.sql');
 assert.doesNotMatch(outbox,/cima_auto|sima_auto_answers/);
});
test('migration: DB-level guards for automatic sends are present and service-only',()=>{
 for(const needle of ['tenant_automatic_replies_disabled','topic_not_automatic','answer_not_approved_verbatim','hourly_cap_reached','customer_daily_cap_reached','crm_access_denied',
  'contact_forbidden','reply_window_closed','newer_business_reply_exists','turn_already_has_send','channel_identity_not_verified','trusted_conversation_missing','auto_paused'])assert.match(sql,new RegExp(needle),needle);
 assert.match(sql,/btrim\(k\.answer\)<>btrim\(a\.answer_text\)/);
 assert.match(sql,/unique\(tenant_id,review_id,conversation_version\)/);
 assert.match(sql,/revoke all on function public\.sima_prepare_auto_send\(uuid\) from public,anon,authenticated/);
 assert.match(sql,/grant execute on function public\.sima_prepare_auto_send\(uuid\) to service_role/);
 assert.match(sql,/revoke all on function public\.sima_claim_auto_send\(uuid\) from public,anon,authenticated/);
 assert.match(sql,/revoke all on public\.sima_auto_answers from public,anon,authenticated/);
 assert.doesNotMatch(sql,/grant[^;]*\bto\b[^;]*\b(anon|authenticated)\b/i);
 assert.match(sql,/auto_enabled boolean|alter table public\.sima_autonomy_settings add column/);
 assert.doesNotMatch(sql,/grant[^;]*delete[^;]*sima_auto_answers/);
});

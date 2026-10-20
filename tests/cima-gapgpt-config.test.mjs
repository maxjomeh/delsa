import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GAPGPT_BASE_URL,GAPGPT_DEFAULT_MODEL,GAPGPT_MODELS,gapgptChat} from '../lib/crm/cima-gapgpt.mjs';
const read=path=>readFileSync(path,'utf8');

test('GapGPT uses fixed HTTPS host and affordable gpt-4o-mini default only',()=>{
 assert.equal(GAPGPT_BASE_URL,'https://api.gapgpt.app/v1');
 assert.equal(GAPGPT_DEFAULT_MODEL,'gpt-4o-mini');
 assert.deepEqual(GAPGPT_MODELS,['gpt-4o-mini']);
});

test('GapGPT adapter uses OpenAI-compatible chat completions and server-side Authorization',async()=>{
 const previous=globalThis.fetch;
 let calls=0;
 globalThis.fetch=async(url,options)=>{
  calls++;
  assert.equal(url,'https://api.gapgpt.app/v1/chat/completions');
  assert.equal(options.headers.Authorization,'Bearer test-private-key-do-not-send');
  const body=JSON.parse(options.body);
  assert.equal(body.model,'gpt-4o-mini');
  assert.equal(body.stream,false);
  assert.ok(body.max_tokens<=450);
  return {ok:true,json:async()=>({choices:[{message:{content:'پاسخ آزمایشی'}}]})};
 };
 try{
  const result=await gapgptChat({apiKey:'test-private-key-do-not-send',messages:[{role:'user',content:'سلام'}]});
  assert.equal(result.text,'پاسخ آزمایشی');assert.equal(calls,1);
 }finally{globalThis.fetch=previous;}
});

test('API settings require admin role and do not expose ciphertext or API keys',()=>{
 const route=read('app/api/admin/cima-model/route.js');
 assert.match(route,/auth\.getUser\(\)/);
 assert.match(route,/profile\?\.role!=='admin'/);
 assert.match(route,/request\.headers\.get\('origin'\)/);
 assert.match(route,/seal\(token\.trim\(\)\)/);
 assert.match(route,/metadata\(await read\(ctx\.db\)\)/);
 assert.match(route,/maskedKey:'••••••••'/);
 assert.match(route,/last_test_status:'untested'/);
 assert.match(route,/enabled:false/);
 assert.match(route,/test_required_first/);
 assert.doesNotMatch(route,/NextResponse\.json\(\{.*credential_ciphertext/);
});

test('secure database settings are service role only and not tenant readable',()=>{
 const schema=read('supabase/migrations/20261020_cima_gapgpt_settings.sql');
 assert.match(schema,/revoke all on table public\.sima_ai_provider_settings from public,anon,authenticated/);
 assert.match(schema,/grant select,insert,update on table public\.sima_ai_provider_settings to service_role/);
 assert.match(schema,/row level security/);
 assert.match(schema,/model='gpt-4o-mini'/);
 assert.match(schema,/sima_ai_provider_audit/);
});

test('CIMA only invokes model after approved KB match and never dispatches it',()=>{
 const copilot=read('app/api/crm/copilot/route.js');
 assert.match(copilot,/loadGapGPT\(db\)/);
 assert.match(copilot,/gapgptChat\(/);
 assert.match(copilot,/decision\.kind==='approved_faq'/);
 assert.match(copilot,/autoSend:false/);
 assert.doesNotMatch(copilot,/sima_prepare_human_send|sima_claim_human_send|zernioRequest\(/);
});

test('admin UI exposes rotate, test and enable, never displays full saved key',()=>{
 const ui=read('components/CimaModelAdmin.js');
 const admin=read('components/AdminDashboardClient.js');
 assert.match(ui,/name==='save'/);assert.match(ui,/name==='test'/);
 assert.match(ui,/action\('enable'\)/);assert.match(ui,/name==='disable'/);
 assert.match(ui,/setApiKey\(''\)/);
 assert.match(admin,/ai:<CimaModelAdmin\/>/);
 assert.match(admin,/مدل و کلیدهای API سیما/);
});

test('paid-model quota defaults to 20 per tenant and blocks unbounded retries',()=>{
 const sql=read('supabase/migrations/20261020_cima_gapgpt_usage_limit.sql');
 const copilot=read('app/api/crm/copilot/route.js');
 assert.match(sql,/request_count<20/);
 assert.match(sql,/on conflict\(tenant_id,usage_day\) do update/);
 assert.match(sql,/grant execute on function public\.sima_claim_model_quota\(uuid\) to service_role/);
 assert.match(copilot,/sima_claim_model_quota/);
 assert.match(copilot,/prior\?\.kind==='llm_grounded'/);
});

test('explicit admin disable takes priority over legacy OpenAI environment fallback',()=>{
 const copilot=read('app/api/crm/copilot/route.js');
 assert.match(copilot,/includeDisabled:true/);
 assert.match(copilot,/gapgptSettings&&!gapgptSettings.enabled\)return null/);
 assert.match(copilot,/modelEnabled:configuredGapGPT\?configuredGapGPT.enabled/);
});

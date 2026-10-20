import {NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {serverDatabase,seal,unseal} from '../../../../lib/crm/instagram.js';
import {GAPGPT_BASE_URL,GAPGPT_DEFAULT_MODEL,GAPGPT_MODELS,verifyGapGPT} from '../../../../lib/crm/cima-gapgpt.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=20;
const response=(data,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
async function admin(){
 const session=await createClient();
 const {data:{user},error}=await session.auth.getUser();
 if(error||!user)return {error:response({error:'unauthenticated'},401)};
 const {data:profile,error:pError}=await session.from('profiles').select('role').eq('id',user.id).maybeSingle();
 if(pError||profile?.role!=='admin')return {error:response({error:'admin_access_required'},403)};
 return {user,db:serverDatabase()};
}
const metadata=record=>record?({
 provider:'gapgpt',configured:true,enabled:record.enabled===true,
 model:record.model,lastTestStatus:record.last_test_status,
 lastTestedAt:record.last_tested_at,updatedAt:record.updated_at,
 revision:record.revision,maskedKey:'••••••••'
}):({provider:'gapgpt',configured:false,enabled:false,model:GAPGPT_DEFAULT_MODEL,
 lastTestStatus:'untested',maskedKey:null,revision:0});
async function read(db){
 const {data,error}=await db.from('sima_ai_provider_settings')
  .select('provider,credential_ciphertext,model,enabled,last_test_status,last_tested_at,updated_at,revision')
  .eq('provider','gapgpt').maybeSingle();
 if(error)throw Error('SETTINGS_UNAVAILABLE');
 return data;
}
async function audit(db,actor,action,revision){
 // A failed audit insert is surfaced, not logged with sensitive data.
 const {error}=await db.from('sima_ai_provider_audit').insert({provider:'gapgpt',actor_id:actor,action,revision});
 if(error)throw Error('AUDIT_FAILED');
}
export async function GET(){
 const ctx=await admin();if(ctx.error)return ctx.error;
 try{return response({settings:metadata(await read(ctx.db)),baseUrl:GAPGPT_BASE_URL,models:GAPGPT_MODELS});}
 catch{return response({error:'provider_settings_unavailable'},503);}
}
export async function POST(request){
 const ctx=await admin();if(ctx.error)return ctx.error;
 if(request.headers.get('origin')!==new URL(request.url).origin)return response({error:'invalid_origin'},403);
 let body;try{body=await request.json();}catch{return response({error:'invalid_request'},400);}
 if(!['save','test','enable','disable'].includes(body?.action))return response({error:'invalid_action'},400);
 try{
  const db=ctx.db,existing=await read(db);
  if(body.action==='save'){
   const token=body.apiKey;
   if(typeof token!=='string'||token.length<20||token.length>1000||/[\r\n\u0000-\u001f]/.test(token))return response({error:'invalid_key'},400);
   const model=body.model||GAPGPT_DEFAULT_MODEL;
   if(!GAPGPT_MODELS.includes(model))return response({error:'invalid_model'},400);
   const cipher=seal(token.trim());
   let record,error;
   if(existing){
    ({data:record,error}=await db.from('sima_ai_provider_settings').update({
     credential_ciphertext:cipher,model,enabled:false,last_test_status:'untested',
     last_tested_at:null,updated_by:ctx.user.id,updated_at:new Date().toISOString(),revision:existing.revision+1
    }).eq('provider','gapgpt').eq('revision',existing.revision)
      .select('provider,model,enabled,last_test_status,last_tested_at,updated_at,revision').maybeSingle());
   }else{
    ({data:record,error}=await db.from('sima_ai_provider_settings').insert({
     provider:'gapgpt',credential_ciphertext:cipher,model,enabled:false,
     updated_by:ctx.user.id,last_test_status:'untested'
    }).select('provider,model,enabled,last_test_status,last_tested_at,updated_at,revision').maybeSingle());
   }
   if(error||!record)return response({error:'settings_concurrent_change'},409);
   await audit(db,ctx.user.id,existing?'rotate':'create',record.revision);
   return response({settings:metadata(record),message:'کلید رمزگذاری و ثبت شد. ابتدا اتصال را آزمایش، سپس فعال کنید.'});
  }
  if(!existing)return response({error:'key_not_configured'},409);
  if(body.action==='test'){
   let passed=false;
   try{await verifyGapGPT(unseal(existing.credential_ciphertext),existing.model);passed=true;}catch{}
   const {data:updated,error}=await db.from('sima_ai_provider_settings').update({
    last_test_status:passed?'passed':'failed',last_tested_at:new Date().toISOString(),
    enabled:passed?existing.enabled:false,updated_at:new Date().toISOString()
   }).eq('provider','gapgpt').eq('revision',existing.revision)
     .select('provider,model,enabled,last_test_status,last_tested_at,updated_at,revision').maybeSingle();
   if(error||!updated)return response({error:'settings_changed_during_test'},409);
   await audit(db,ctx.user.id,passed?'test_pass':'test_fail',updated.revision);
   return response({settings:metadata(updated),tested:passed,message:passed?'GapGPT پاسخ داد؛ کلید قابل استفاده است.':'آزمایش ناموفق بود. کلید، اعتبار و سقف مصرف را بررسی کنید.'},passed?200:422);
  }
  if(body.action==='enable'&&existing.last_test_status!=='passed')return response({error:'test_required_first'},409);
  const enabled=body.action==='enable';
  const {data:updated,error}=await db.from('sima_ai_provider_settings').update({
    enabled,updated_by:ctx.user.id,updated_at:new Date().toISOString(),revision:existing.revision+1
   }).eq('provider','gapgpt').eq('revision',existing.revision)
    .select('provider,model,enabled,last_test_status,last_tested_at,updated_at,revision').maybeSingle();
  if(error||!updated)return response({error:'settings_concurrent_change'},409);
  await audit(db,ctx.user.id,enabled?'enable':'disable',updated.revision);
  return response({settings:metadata(updated),message:enabled?'GapGPT برای پیش‌نویس‌های تحت نظارت سیما فعال شد.':'GapGPT غیرفعال شد؛ هیچ درخواست مدلی ارسال نمی‌شود.'});
 }catch{return response({error:'provider_settings_failed'},503);}
}

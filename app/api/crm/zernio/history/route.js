import {NextResponse} from 'next/server';
import {createClient} from '../../../../../lib/supabase/server';
import {serverDatabase} from '../../../../../lib/crm/instagram';
import {zernioRequest,profileIdValid} from '../../../../../lib/crm/zernio.mjs';
import {nextHistoryPage,safeJob} from '../../../../../lib/crm/zernio-history.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const json=(data,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
async function context(){
 const auth=await createClient(),{data:{user}}=await auth.auth.getUser();
 if(!user)return {tenant:null,status:401};
 const sub=await auth.rpc('has_active_crm');
 if(sub.error||sub.data!==true)return {tenant:null,status:403};
 return {tenant:user.id,status:200};
}
async function owned(tenant){
 const db=serverDatabase();
 const {data,error}=await db.from('crm_zernio_profiles').select('profile_id').eq('tenant_id',tenant).maybeSingle();
 if(error)throw error;
 return data?.profile_id||null;
}
async function statuses(tenant){
 const {data,error}=await serverDatabase().from('crm_zernio_history_jobs').select('status,account_id,completed_conversations,imported_messages,errors,last_error_code,started_at,completed_at').eq('tenant_id',tenant);
 if(error)throw error;
 return data.map(safeJob);
}
export async function GET(){
 const ctx=await context();if(!ctx.tenant)return json({error:'login_or_subscription_required'},ctx.status);
 try{return json({jobs:await statuses(ctx.tenant)});}catch{return json({error:'history_status_unavailable'},503);}
}
export async function POST(request){
 const ctx=await context();if(!ctx.tenant)return json({error:'login_or_subscription_required'},ctx.status);
 // Same-origin browsers only. No third-party requests may initiate imports.
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'invalid_origin'},403);
 let body;try{body=await request.json();}catch{return json({error:'invalid_json'},400);}
 if(!['start','step'].includes(body?.action))return json({error:'invalid_action'},400);
 if(process.env.ZERNIO_CONNECT_ENABLED!=='true')return json({error:'history_not_enabled'},503);
 const db=serverDatabase();
 try{
  const profileId=await owned(ctx.tenant);
  if(!profileId||!profileIdValid(profileId))return json({error:'connect_social_account_first'},409);
  if(body.action==='start'){
   const api=await zernioRequest('GET','/v1/accounts',{query:{profileId}});
   const accounts=(Array.isArray(api.accounts)?api.accounts:[])
    .filter(a=>a.platform==='instagram'||a.platform==='facebook')
    .filter(a=>(a.profileId?._id||a.profileId)===profileId)
    .map(a=>a._id||a.accountId).filter(v=>typeof v==='string'&&/^[a-f0-9]{24}$/i.test(v));
   if(!accounts.length)return json({error:'no_social_accounts_in_profile'},409);
   for(const accountId of [...new Set(accounts)]){
    const {data:existing}=await db.from('crm_zernio_history_jobs').select('status').eq('tenant_id',ctx.tenant).eq('account_id',accountId).maybeSingle();
    if(!existing){
     const {error}=await db.from('crm_zernio_history_jobs').insert({tenant_id:ctx.tenant,profile_id:profileId,account_id:accountId});
     if(error&&error.code!=='23505')throw error;
    }else if(existing.status==='complete'||existing.status==='error'){
     // Re-sweep: pre-connect replay may complete after the first scan.
     const {error}=await db.from('crm_zernio_history_jobs').update({status:'queued',conversation_cursor:null,conversation_queue:[],queue_index:0,current_conversation:null,current_participant:{},message_cursor:null,next_conversation_cursor:null,completed_conversations:0,imported_messages:0,errors:0,last_error_code:null,completed_at:null,lease_until:null}).eq('tenant_id',ctx.tenant).eq('account_id',accountId);
     if(error)throw error;
    }
   }
   return json({jobs:await statuses(ctx.tenant)});
  }
  const {data:job,error:claimError}=await db.rpc('crm_zernio_claim_history_job',{p_tenant:ctx.tenant});
  if(claimError)throw claimError;
  if(!job)return json({jobs:await statuses(ctx.tenant),idle:true});
  try{
   const result=await nextHistoryPage(job);
   if(result.events?.length){
    const {error}=await db.from('crm_zernio_events').upsert(result.events,{onConflict:'event_id',ignoreDuplicates:true});
    if(error)throw error;
   }
   const {error}=await db.from('crm_zernio_history_jobs').update({...result.patch,...(!result.patch?result:{}),lease_until:null,lease_token:null,last_error_code:null}).eq('tenant_id',ctx.tenant).eq('account_id',job.account_id).eq('lease_token',job.lease_token);
   if(error)throw error;
   if(result.events?.length){const {error:projectErr}=await db.rpc('crm_zernio_process_batch',{p_limit:100});if(projectErr)console.error('SIMA background projection pending',{code:projectErr.code});}
   return json({jobs:await statuses(ctx.tenant),step:true});
  }catch(e){
   const code=typeof e?.code==='string'&&e.code.length<70?e.code:e?.status===429?'UPSTREAM_RATE_LIMIT':'HISTORY_STEP_FAILED';
   await db.from('crm_zernio_history_jobs').update({status:'error',last_error_code:code,errors:job.errors+1,lease_until:null,lease_token:null}).eq('tenant_id',ctx.tenant).eq('account_id',job.account_id).eq('lease_token',job.lease_token);
   return json({error:code,jobs:await statuses(ctx.tenant)},503);
  }
 }catch(e){return json({error:e?.code==='insufficient_permissions'?'zernio_messages_permission_required':'history_unavailable'},503);}
}

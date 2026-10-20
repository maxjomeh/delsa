import {NextResponse} from 'next/server';
import {createClient} from '../../../../../lib/supabase/server';
import {serverDatabase} from '../../../../../lib/crm/instagram';
import {publicAccount,profileIdValid,zernioRequest} from '../../../../../lib/crm/zernio.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=25;
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const json=(value,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
async function session(){
 const auth=await createClient();
 const {data:{user},error}=await auth.auth.getUser();
 if(error||!user)return {status:401};
 const {data,error:entitlement}=await auth.rpc('has_active_crm');
 return data===true&&!entitlement?{id:user.id,auth,status:200}:{status:403};
}
export async function GET(request){
 const ctx=await session();if(!ctx.id)return json({error:'crm_access_required'},ctx.status);
 const caseId=new URL(request.url).searchParams.get('caseId');
 if(!uuid(caseId))return json({error:'invalid_case_id'},400);
 const db=serverDatabase();
 const {data:caseRow,error:caseError}=await db.from('sima_human_review_cases')
  .select('id,customer_id,channel,state,last_occurred_at,conversation_version')
  .eq('tenant_id',ctx.id).eq('id',caseId).maybeSingle();
 if(caseError)return json({error:'outbox_unavailable'},503);
 if(!caseRow)return json({error:'review_not_found'},404);
 const {data,error}=await db.from('sima_message_outbox')
  .select('id,conversation_version,status,attempt_count,provider_message_id,provider_error_code,requested_at,sent_at')
  .eq('tenant_id',ctx.id).eq('review_id',caseId).order('requested_at',{ascending:false}).limit(5);
 if(error)return json({error:'outbox_unavailable'},503);
 const {data:customer,error:customerError}=await db.from('crm_customers').select('do_not_contact')
  .eq('tenant_id',ctx.id).eq('id',caseRow.customer_id).maybeSingle();
 if(customerError)return json({error:'outbox_unavailable'},503);
 const reasons=[];
 const occurred=Date.parse(caseRow.last_occurred_at||'');
 const age=Date.now()-occurred;
 if(!Number.isFinite(occurred)||age<0||age>=23*3600000)reasons.push('reply_window_closed');
 if(caseRow.channel!=='instagram')reasons.push('channel_not_enabled');
 if(!['awaiting_human','drafting'].includes(caseRow.state))reasons.push('conversation_not_open');
 if(customer?.do_not_contact)reasons.push('contact_opted_out');
 if(process.env.ZERNIO_CONNECT_ENABLED!=='true'||!process.env.ZERNIO_API_KEY)reasons.push('channel_not_configured');
 if((data||[]).some(row=>row.conversation_version===caseRow.conversation_version &&
    !(row.status==='pending'&&row.attempt_count===0)))reasons.push('already_attempted');
 return json({sends:data||[],eligibility:{
   canRequestSend:reasons.length===0,reasons,conversationVersion:caseRow.conversation_version,
   latestInboundAt:caseRow.last_occurred_at
 }});
}
const safePrepareCode=error=>{
 const m=String(error?.message||'');
 if(/reply_window_closed/.test(m))return 'reply_window_closed';
 if(/conversation_stale_or_locked/.test(m))return 'conversation_stale';
 if(/turn_already_has_send|duplicate key|unique constraint/.test(m))return 'duplicate_send_blocked';
 if(/contact_forbidden/.test(m))return 'contact_opted_out';
 if(/newer_business_reply_exists/.test(m))return 'business_already_replied';
 if(/trusted_conversation_missing|channel_identity_not_verified|missing_inbound_anchor/.test(m))return 'conversation_unverified';
 if(/channel_not_enabled/.test(m))return 'channel_not_enabled';
 return 'send_preflight_failed';
};
export async function POST(request){
 const ctx=await session();if(!ctx.id)return json({error:'crm_access_required'},ctx.status);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'invalid_origin'},403);
 let body;try{body=await request.json();}catch{return json({error:'invalid_request'},400);}
 if(body?.action!=='send'||!uuid(body?.id)||!Number.isSafeInteger(body?.version)||body.version<1||
    typeof body.text!=='string'||!body.text.trim()||body.text.length>4000)
  return json({error:'invalid_send'},400);
 if(process.env.ZERNIO_CONNECT_ENABLED!=='true'||!process.env.ZERNIO_API_KEY)
  return json({error:'channel_not_configured'},503);
 const db=serverDatabase();
 const {data:review,error:reviewError}=await db.from('sima_human_review_cases')
  .select('id,tenant_id,account_id,channel,state,conversation_version')
  .eq('tenant_id',ctx.id).eq('id',body.id).maybeSingle();
 if(reviewError)return json({error:'review_unavailable'},503);
 if(!review)return json({error:'review_not_found'},404);
 if(review.channel!=='instagram'||review.conversation_version!==body.version||!['awaiting_human','drafting'].includes(review.state))
  return json({error:'conversation_stale'},409);
 const {data:profile,error:profileError}=await db.from('crm_zernio_profiles')
  .select('profile_id').eq('tenant_id',ctx.id).maybeSingle();
 if(profileError||!profileIdValid(profile?.profile_id))return json({error:'channel_not_connected'},409);
 // Verify this specific sender belongs to this tenant and is connected now.
 try{
  const result=await zernioRequest('GET','/v1/accounts',{query:{profileId:profile.profile_id}});
  const connected=(result.accounts||[]).map(item=>publicAccount(item,profile.profile_id))
    .find(item=>item?.id===review.account_id&&item.platform==='instagram'&&item.connected);
  if(!connected)return json({error:'instagram_sender_not_connected'},409);
 }catch{return json({error:'instagram_account_unavailable'},503);}
 // Authenticated RPC enforces subscription, origin-independent tenant ownership,
 // last trusted inbound <23h, no opt-out, account mapping and unique turn.
 const {data:prepared,error:prepareError}=await ctx.auth.rpc('sima_prepare_human_send',{
  p_review_id:body.id,p_version:body.version,p_body:body.text
 });
 if(prepareError)return json({error:safePrepareCode(prepareError)},409);
 if(!uuid(prepared?.outbox_id))return json({error:'send_preflight_failed'},503);
 const id=prepared.outbox_id;
 // Service-only atomic claim: concurrent buttons can never contact Zernio twice.
 const {data:claimed,error:claimError}=await db.rpc('sima_claim_human_send',{p_outbox_id:id});
 if(claimError||!claimed)return json({error:'send_blocked',outboxId:id},409);
 let status='unknown',providerMessageId=null,errorCode=null;
 try{
  // One and only one dispatch attempt. Unknown network/5xx responses are never
  // retried. Zernio's successful idempotency cache has a 24h retention limit.
  const result=await zernioRequest('POST',
   '/v1/inbox/conversations/'+encodeURIComponent(claimed.conversation_id)+'/messages',
   {body:{accountId:claimed.account_id,message:claimed.body},idempotencyKey:id});
  const receipt=result?.data?.messageId||(
   Array.isArray(result?.data?.messageIds)&&result.data.messageIds.length===1
    ?result.data.messageIds[0]:null);
  if(result?.success===true&&typeof receipt==='string'&&receipt.length>0&&receipt.length<=255&&!result?.data?.partialFailure){
   status='accepted';providerMessageId=receipt;
  }else errorCode='unverified_provider_acknowledgment';
 }catch(e){
  const code=Number(e?.status||0);
  errorCode=(typeof e?.code==='string'&&e.code.length<90?e.code:'provider_request_error');
  // A definite validation / permission / rate refusal is not accepted. Other
  // failures, particularly timeouts, in-flight 409 and 5xx, are ambiguous.
  status=[400,401,403,422,429].includes(code)?'rejected':'unknown';
 }
 const {data:finished,error:finishError}=await db.rpc('sima_finalize_human_send',{
  p_outbox_id:id,p_status:status,p_message_id:providerMessageId,p_error_code:errorCode
 });
 if(finishError)return json({error:'delivery_status_requires_review',outboxId:id,status:'unknown'},202);
 const actual=finished?.status||'unknown';
 return json({outboxId:id,status:actual,providerMessageId:actual==='accepted'?providerMessageId:null,
  providerAccepted:actual==='accepted',delivered:false,
  message:actual==='accepted'
    ?'Zernio پیام را پذیرفت؛ رسیدن یا خوانده‌شدن هنوز تأیید نشده است.'
    :actual==='rejected'
     ?'Zernio ارسال را رد کرد. پیام را دوباره نفرستید تا علت بررسی شود.'
     :'نتیجهٔ ارسال نامشخص است؛ از ارسال مجدد خودداری کنید.'},actual==='accepted'?200:actual==='rejected'?422:202);
}

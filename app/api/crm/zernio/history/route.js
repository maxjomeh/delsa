import {createHash} from 'node:crypto';
import {NextResponse} from 'next/server';
import {createClient} from '../../../../../lib/supabase/server';
import {serverDatabase} from '../../../../../lib/crm/instagram';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=30;
const bad=(error,status=400)=>NextResponse.json({error},{status});
const objectId=id=>typeof id==='string'&&/^[a-f0-9]{24}$/i.test(id);
const eventUuid=(accountId,msgId)=>{
 const h=createHash('sha256').update('zernio-history-v1|'+accountId+'|'+msgId).digest('hex');
 return h.slice(0,8)+'-'+h.slice(8,12)+'-5'+h.slice(13,16)+'-8'+h.slice(17,20)+'-'+h.slice(20,32);
};
async function zget(path,params){
 const token=process.env.ZERNIO_API_KEY;
 if(!token)throw new Error('not_configured');
 const url=new URL('https://zernio.com/api/v1/inbox/'+path);
 for(const [k,v] of Object.entries(params||{}))if(v!==null&&v!==undefined&&v!=='')url.searchParams.set(k,v);
 const response=await fetch(url,{headers:{Authorization:'Bearer '+token,Accept:'application/json'},signal:AbortSignal.timeout(14000),cache:'no-store'});
 if(!response.ok)throw new Error('upstream_'+response.status);
 return response.json();
}
async function owner(){
 const auth=await createClient();
 const {data:{user}}=await auth.auth.getUser();
 if(!user)return null;
 const entitlement=await auth.rpc('has_active_crm');
 return entitlement.data===true?user:null;
}
export async function GET(){
 const user=await owner();if(!user)return bad('اشتراک فعال سیما لازم است.',403);
 const db=serverDatabase();
 const {data}=await db.from('crm_zernio_history_sync').select('status,conversations_scanned,messages_discovered,updated_at,last_error').eq('tenant_id',user.id).maybeSingle();
 return NextResponse.json({sync:data||{status:'idle',conversations_scanned:0,messages_discovered:0}});
}
export async function POST(request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return bad('مبدأ نامعتبر',403);
 const user=await owner();if(!user)return bad('اشتراک فعال سیما لازم است.',403);
 const db=serverDatabase();
 const {data:profile}=await db.from('crm_zernio_profiles').select('profile_id').eq('tenant_id',user.id).maybeSingle();
 if(!objectId(profile?.profile_id))return bad('ابتدا اینستاگرام را به سیما متصل کنید.',409);
 const {data:saved}=await db.from('crm_zernio_history_sync').select('*').eq('tenant_id',user.id).maybeSingle();
 let state=saved||{tenant_id:user.id,profile_id:profile.profile_id,list_cursor:null,current_conversation:null,message_cursor:null,status:'idle',conversations_scanned:0,messages_discovered:0};
 if(state.profile_id!==profile.profile_id)return bad('پروفایل متصل تغییر کرده؛ ادامهٔ همگام‌سازی نیاز به بررسی دارد.',409);
 if(state.status==='completed')return NextResponse.json({done:true,conversations:state.conversations_scanned,messages:state.messages_discovered});
 try{
  if(!state.current_conversation){
   const page=await zget('conversations',{profileId:profile.profile_id,platform:'instagram',limit:'1',...(state.list_cursor?{cursor:state.list_cursor}:{})});
   if(page.meta?.accountsFailed>0||page.meta?.failedAccounts?.length)throw new Error('account_fetch_failed');
   const conv=Array.isArray(page.data)?page.data[0]:null;
   if(!conv){
    if(page.pagination?.hasMore)throw new Error('pagination_inconsistent');
    state.status='completed';
    await db.from('crm_zernio_history_sync').upsert({...state,updated_at:new Date().toISOString()});
    return NextResponse.json({done:true,conversations:state.conversations_scanned,messages:state.messages_discovered});
   }
   if(!objectId(conv.accountId)||typeof conv.id!=='string'||typeof conv.participantId!=='string'||!conv.participantId)throw new Error('conversation_identity_missing');
   state.current_conversation={id:conv.id,accountId:conv.accountId,participantId:conv.participantId,participantName:conv.participantName||'',participantUsername:conv.participantUsername||'',participantPicture:conv.participantPicture||'',platform:'instagram',nextListCursor:page.pagination?.nextCursor||null,hasMoreConversations:!!page.pagination?.hasMore};
   state.message_cursor=null;
   // Save the conversation checkpoint before fetching messages.
   const {error:cpError}=await db.from('crm_zernio_history_sync').upsert({...state,status:'running',updated_at:new Date().toISOString()});
   if(cpError)throw cpError;
  }
  const c=state.current_conversation;
  const path='conversations/'+encodeURIComponent(c.id)+'/messages';
  const page=await zget(path,{accountId:c.accountId,limit:'100',sortOrder:'desc',...(state.message_cursor?{cursor:state.message_cursor}:{})});
  const messages=Array.isArray(page.messages)?page.messages:[];
  const events=messages.filter(m=>m&&typeof m.id==='string'&&!m.isDeleted&&['incoming','outgoing'].includes(m.direction)).map(m=>{
   const inbound=m.direction==='incoming';
   const id=eventUuid(c.accountId,m.id);
   return {event_id:id,tenant_id:user.id,profile_id:profile.profile_id,account_id:c.accountId,event_type:inbound?'message.received':'message.sent',
    payload:{id,event:inbound?'message.received':'message.sent',timestamp:m.createdAt||m.sentAt||new Date().toISOString(),
     account:{accountId:c.accountId,profileId:profile.profile_id,platform:'instagram'},
     conversation:{id:c.id,participantId:c.participantId,participantName:c.participantName,participantUsername:c.participantUsername,participantPicture:c.participantPicture},
     message:{id:m.id,text:m.message||'',sentAt:m.createdAt||m.sentAt,attachments:m.attachments||[]}}
   };
  });
  if(events.length){
   const {error:writeError}=await db.from('crm_zernio_events').upsert(events,{onConflict:'event_id',ignoreDuplicates:true});
   if(writeError)throw writeError;
  }
  state.messages_discovered+=events.length;
  if(page.pagination?.hasMore){
   if(!page.pagination.nextCursor)throw new Error('missing_message_cursor');
   state.message_cursor=page.pagination.nextCursor;
  }else{
   state.conversations_scanned++;
   state.list_cursor=c.nextListCursor;
   state.current_conversation=null;
   state.message_cursor=null;
   if(!c.hasMoreConversations)state.status='completed';
  }
  const {error:saveError}=await db.from('crm_zernio_history_sync').upsert({...state,updated_at:new Date().toISOString(),last_error:null});
  if(saveError)throw saveError;
  // Queue consumer is idempotent, and cron retries if this request ends.
  await db.rpc('crm_zernio_process_batch',{p_limit:100});
  return NextResponse.json({done:state.status==='completed',conversations:state.conversations_scanned,messages:state.messages_discovered,hasMore:state.status!=='completed'});
 }catch(e){
  await db.from('crm_zernio_history_sync').upsert({...state,status:'error',last_error:String(e?.message||'sync_error').slice(0,160),updated_at:new Date().toISOString()});
  return bad('همگام‌سازی موقتاً متوقف شد؛ می‌توان آن را ادامه داد.',503);
 }
}

import {createHash} from 'node:crypto';
import {zernioRequest,profileIdValid} from './zernio.mjs';

const ID=/^[a-f0-9]{24}$/i;
const token=x=>typeof x==='string'&&x.length>0&&x.length<=1024?x:null;
const uuidFrom=(value)=>{
 const hex=createHash('sha256').update('delsa:zernio-history:v1:'+value).digest('hex');
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
};
const text=v=>typeof v==='string'?v.slice(0,8000):'';
export function historyEvent(job,conv,m){
 if(!ID.test(job.account_id)||!profileIdValid(job.profile_id))return null;
 if(typeof m?.id!=='string'||!m.id||m.id.length>200)return null;
 if(m.isDeleted===true||m.noRenderableContent===true)return null;
 const direction=m.direction==='incoming'?'message.received':m.direction==='outgoing'?'message.sent':null;
 if(!direction)return null;
 const participantId=text(conv.participantId).trim();
 if(!participantId||participantId.length>200)return null;
 const body=text(m.message);
 const attachments=Array.isArray(m.attachments)?m.attachments.slice(0,3).map(a=>({type:a?.type||'file'})):[];
 if(!body.trim()&&!attachments.length)return null;
 const sentAt=Number.isFinite(Date.parse(m.sentAt||m.createdAt))?new Date(m.sentAt||m.createdAt).toISOString():null;
 if(!sentAt)return null;
 const id=uuidFrom(job.account_id+':'+m.id);
 const platform=String(conv.platform||m.platform||'instagram').slice(0,30);
 const event={id,event:direction,timestamp:sentAt,profiles:[{id:job.profile_id}],account:{accountId:job.account_id,profileId:job.profile_id,platform},
 conversation:{id:String(conv.id).slice(0,180),participantId,participantName:text(conv.participantName).slice(0,160),participantUsername:text(conv.participantUsername).slice(0,80),participantPicture:text(conv.participantPicture).slice(0,2048)},
 message:{id:m.id,text:body,attachments,direction,sentAt}};
 return {event_id:id,tenant_id:job.tenant_id,profile_id:job.profile_id,account_id:job.account_id,event_type:direction,payload:event};
}
export function safeJob(job){
 return {status:job.status,accountId:job.account_id,completedConversations:job.completed_conversations,importedMessages:job.imported_messages,errors:job.errors,lastErrorCode:job.last_error_code,startedAt:job.started_at,completedAt:job.completed_at};
}
export async function nextHistoryPage(job){
 if(!job.current_conversation){
  const queue=Array.isArray(job.conversation_queue)?job.conversation_queue:[];
  if(job.queue_index<queue.length){
   const conv=queue[job.queue_index];
   return {current_conversation:conv.id,current_participant:conv,message_cursor:null,status:'running'};
  }
  const page=await zernioRequest('GET','/v1/inbox/conversations',{query:{accountId:job.account_id,limit:100,...(job.conversation_cursor?{cursor:job.conversation_cursor}:{})}});
  const items=(Array.isArray(page.data)?page.data:[]).filter(c=>c&&typeof c.id==='string'&&c.accountId===job.account_id&&typeof c.participantId==='string').map(c=>({id:c.id,participantId:c.participantId,participantName:c.participantName||'',participantUsername:c.participantUsername||'',participantPicture:c.participantPicture||'',platform:c.platform||'instagram'}));
  const cursor=page.pagination?.hasMore?token(page.pagination?.nextCursor):null;
  // A broken upstream pagination response must not silently report completion.
  if(page.pagination?.hasMore&&!cursor)throw new Error('UPSTREAM_CURSOR_MISSING');
  if(!items.length&&!cursor)return {status:'complete',completed_at:new Date().toISOString(),conversation_queue:[],current_conversation:null,conversation_cursor:null,queue_index:0,next_conversation_cursor:null};
  if(!items.length&&cursor)return {conversation_cursor:cursor,conversation_queue:[],queue_index:0,next_conversation_cursor:null,status:'running'};
  return {conversation_queue:items,queue_index:0,next_conversation_cursor:cursor,current_conversation:items[0].id,current_participant:items[0],message_cursor:null,status:'running'};
 }
 const result=await zernioRequest('GET',`/v1/inbox/conversations/${encodeURIComponent(job.current_conversation)}/messages`,{query:{accountId:job.account_id,limit:100,sortOrder:'desc',...(job.message_cursor?{cursor:job.message_cursor}:{})}});
 const messages=Array.isArray(result.messages)?result.messages:[];
 const events=messages.map(m=>historyEvent(job,job.current_participant,m)).filter(Boolean);
 const nextCursor=result.pagination?.hasMore?token(result.pagination?.nextCursor):null;
 if(result.pagination?.hasMore&&!nextCursor)throw new Error('MESSAGE_CURSOR_MISSING');
 if(nextCursor)return {events,patch:{message_cursor:nextCursor,last_run_at:new Date().toISOString(),imported_messages:job.imported_messages+events.length}};
 const nextIndex=job.queue_index+1;
 const queue=Array.isArray(job.conversation_queue)?job.conversation_queue:[];
 const next=queue[nextIndex];
 return {events,patch:{
  current_conversation:next?.id||null,current_participant:next||{},message_cursor:null,
  queue_index:next?nextIndex:queue.length,conversation_cursor:next?job.conversation_cursor:job.next_conversation_cursor,
  conversation_queue:next?queue:[],next_conversation_cursor:next?job.next_conversation_cursor:null,
  completed_conversations:job.completed_conversations+1,
  imported_messages:job.imported_messages+events.length,last_run_at:new Date().toISOString(),
  status:!next&&!job.next_conversation_cursor?'complete':'running',
  completed_at:!next&&!job.next_conversation_cursor?new Date().toISOString():null
 }};
}

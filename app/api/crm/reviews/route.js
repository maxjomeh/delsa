import {NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {serverDatabase} from '../../../../lib/crm/instagram';
export const runtime='nodejs';
export const dynamic='force-dynamic';

const json=(value,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
async function tenant(){
 const auth=await createClient();
 const {data:{user},error}=await auth.auth.getUser();
 if(error||!user)return {status:401};
 const {data, error:subscriptionError}=await auth.rpc('has_active_crm');
 return data===true&&!subscriptionError?{id:user.id,status:200}:{status:403};
}
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);

export async function GET(request){
 const owner=await tenant();if(!owner.id)return json({error:'crm_access_required'},owner.status);
 const url=new URL(request.url);
 const db=serverDatabase();
 const customerId=url.searchParams.get('customerId');
 if(customerId!==null){
  const caseId=url.searchParams.get('caseId');
  if(!uuid(customerId)||!uuid(caseId))return json({error:'invalid_ids'},400);
  const {data:review,error:checkError}=await db.from('sima_human_review_cases')
   .select('id,customer_id,account_id,channel,conversation_version,state,last_occurred_at')
   .eq('tenant_id',owner.id).eq('id',caseId).eq('customer_id',customerId).maybeSingle();
  if(checkError)return json({error:'review_unavailable'},503);
  if(!review)return json({error:'review_not_found'},404);
  const {data:messages,error}=await db.from('crm_interactions')
   .select('id,direction,body,occurred_at,channel,kind,external_event_id')
   .eq('tenant_id',owner.id).eq('customer_id',customerId).eq('channel',review.channel)
   .order('occurred_at',{ascending:false}).limit(100);
  if(error)return json({error:'history_unavailable'},503);
  return json({review,messages:(messages||[]).reverse().map(({external_event_id,...m})=>m)});
 }
 const state=url.searchParams.get('state')||'all';
 if(!['all','awaiting_human','drafting','resolved'].includes(state))return json({error:'invalid_state'},400);
 const offset=Number(url.searchParams.get('offset')||0);
 if(!Number.isInteger(offset)||offset<0||offset>10000)return json({error:'invalid_offset'},400);
 let q=db.from('sima_human_review_cases')
  .select('id,customer_id,account_id,channel,last_message_id,last_occurred_at,state,reason_code,conversation_version,draft_text,draft_version,updated_at')
  .eq('tenant_id',owner.id).order('last_occurred_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+39);
 if(state!=='all')q=q.eq('state',state);
 const {data:cases,error}=await q;
 if(error)return json({error:'review_unavailable'},503);
 const list=cases||[];
 if(!list.length)return json({cases:[],hasMore:false});
 const customers=[...new Set(list.map(x=>x.customer_id))],messageIds=[...new Set(list.map(x=>x.last_message_id))];
 const [names,last]=await Promise.all([
  db.from('crm_customers').select('id,name,instagram,phone,custom_fields,do_not_contact').eq('tenant_id',owner.id).in('id',customers),
  db.from('crm_interactions').select('id,body,occurred_at,direction').eq('tenant_id',owner.id).in('id',messageIds)
 ]);
 if(names.error||last.error)return json({error:'review_details_unavailable'},503);
 const customerMap=new Map((names.data||[]).map(x=>[x.id,x]));
 const messageMap=new Map((last.data||[]).map(x=>[x.id,x]));
 return json({cases:list.map(item=>({...item,customer:customerMap.get(item.customer_id)||null,lastMessage:messageMap.get(item.last_message_id)||null})),hasMore:list.length===40,nextOffset:offset+list.length});
}

export async function POST(request){
 const owner=await tenant();if(!owner.id)return json({error:'crm_access_required'},owner.status);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'invalid_origin'},403);
 let body;
 try{body=await request.json();}catch{return json({error:'invalid_body'},400);}
 if(body?.action!=='save_draft'||!uuid(body?.id)||!Number.isInteger(body?.version)||body.version<1||
  typeof body?.text!=='string'||body.text.length>8000)return json({error:'invalid_draft'},400);
 const db=serverDatabase();
 // A fresh customer DM increments conversation_version and invalidates this
 // expected version. The optimistic guard is enforced by Postgres.
 const {data,error}=await db.from('sima_human_review_cases').update({
  draft_text:body.text.trim()||null,
  draft_version:body.version,
  state:'drafting',
  updated_at:new Date().toISOString()
 }).eq('tenant_id',owner.id).eq('id',body.id)
 .eq('conversation_version',body.version).in('state',['awaiting_human','drafting'])
 .select('id,state,conversation_version,draft_version,updated_at').maybeSingle();
 if(error)return json({error:'draft_save_failed'},503);
 if(!data)return json({error:'stale_conversation_refresh_required'},409);
 return json({saved:true,review:data,dispatched:false});
}

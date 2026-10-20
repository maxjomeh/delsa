import {NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {serverDatabase} from '../../../../lib/crm/instagram';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(value,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(v);
async function owner(){
 const auth=await createClient();
 const {data:{user},error}=await auth.auth.getUser();
 if(error||!user)return {status:401};
 const {data,error:subscriptionError}=await auth.rpc('has_active_crm');
 return data===true&&!subscriptionError?{id:user.id,status:200}:{status:403};
}
export async function GET(request){
 const ctx=await owner();if(!ctx.id)return json({error:'crm_access_required'},ctx.status);
 const state=new URL(request.url).searchParams.get('status')||'all';
 if(!['all','draft','approved','revoked'].includes(state))return json({error:'invalid_filter'},400);
 const db=serverDatabase();
 let q=db.from('sima_knowledge_entries')
  .select('id,title,question,answer,category,status,revision,approved_at,expires_at,created_at,updated_at')
  .eq('tenant_id',ctx.id).order('updated_at',{ascending:false}).limit(250);
 if(state!=='all')q=q.eq('status',state);
 const {data,error}=await q;
 return error?json({error:'knowledge_unavailable'},503):json({entries:data||[]});
}
export async function POST(request){
 const ctx=await owner();if(!ctx.id)return json({error:'crm_access_required'},ctx.status);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'invalid_origin'},403);
 let body;try{body=await request.json();}catch{return json({error:'invalid_request'},400);}
 const db=serverDatabase();
 const action=body?.action;
 if(!['create','update','approve','revoke'].includes(action))return json({error:'invalid_action'},400);
 const change=action==='create'||action==='update';
 if(change){
  if(typeof body?.title!=='string'||body.title.trim().length<3||body.title.length>180||
  typeof body.question!=='string'||body.question.trim().length<4||body.question.length>2000||
  typeof body.answer!=='string'||body.answer.trim().length<2||body.answer.length>6000||
  !['faq','policy','product','procedure'].includes(body.category))return json({error:'invalid_knowledge_fields'},400);
 }
 if(action==='create'){
  const {data,error}=await db.from('sima_knowledge_entries')
   .insert({tenant_id:ctx.id,title:body.title.trim(),question:body.question.trim(),answer:body.answer.trim(),category:body.category,status:'draft'})
   .select('id,revision,status').single();
  return error?json({error:'create_failed'},503):json({entry:data});
 }
 if(!uuid(body?.id))return json({error:'invalid_id'},400);
 const {data:current,error:findError}=await db.from('sima_knowledge_entries')
  .select('id,revision,status').eq('tenant_id',ctx.id).eq('id',body.id).maybeSingle();
 if(findError)return json({error:'knowledge_unavailable'},503);
 if(!current)return json({error:'knowledge_not_found'},404);
 const next=action==='update'
  ?{title:body.title.trim(),question:body.question.trim(),answer:body.answer.trim(),category:body.category,status:'draft',approved_at:null}
  :action==='approve'?{status:'approved',approved_at:new Date().toISOString()}
   :{status:'revoked',approved_at:null};
 const {data,error}=await db.from('sima_knowledge_entries')
  .update({...next,revision:current.revision+1,updated_at:new Date().toISOString()})
  .eq('tenant_id',ctx.id).eq('id',body.id).eq('revision',current.revision)
  .select('id,revision,status,updated_at').maybeSingle();
 if(error)return json({error:'knowledge_update_failed'},503);
 if(!data)return json({error:'knowledge_modified_refresh'},409);
 return json({entry:data});
}

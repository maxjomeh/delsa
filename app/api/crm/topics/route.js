import {NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {serverDatabase} from '../../../../lib/crm/instagram';
import {describeTopics,loadAutonomy,updateTopic,setRequiredFields,discover,replay} from '../../../../lib/crm/topic-store.mjs';
// Owner-facing topic management for CIMA. Reads and writes topic CONFIGURATION and learning evidence for the signed-in
// CRM tenant only. It never sends a message and never switches automatic replies on: that switch does not exist yet.
export const runtime='nodejs';
export const dynamic='force-dynamic';
const reply=(body,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const uuid=value=>typeof value==='string'&&/^[0-9a-f-]{36}$/i.test(value);
const STATUS={invalid_label:400,invalid_floor:400,invalid_fields:400,invalid_action:400,unknown_field:400,invalid_transition:409,not_found:404,update_refused:409};
const failure=result=>reply({error:result.error,...(result.field?{field:result.field}:{})},STATUS[result.error]||503);
async function context(){
 const auth=await createClient();
 const {data:{user},error}=await auth.auth.getUser();
 if(error||!user)return {status:401,error:'unauthenticated'};
 const {data:active,error:accessError}=await auth.rpc('has_active_crm');
 if(accessError||active!==true)return {status:403,error:'crm_access_required'};
 return {status:200,id:user.id};
}
export async function GET(){
 const ctx=await context();
 if(ctx.status!==200)return reply({error:ctx.error},ctx.status);
 const db=serverDatabase();
 const [topics,autonomy,fields]=await Promise.all([
  describeTopics(db,ctx.id),loadAutonomy(db,ctx.id),
  db.from('crm_field_definitions').select('key,label').eq('tenant_id',ctx.id).eq('enabled',true).order('priority',{ascending:false}).limit(200)]);
 if(!topics.ok||fields.error)return reply({error:'topics_unavailable'},503);
 return reply({topics:topics.topics,fields:fields.data||[],autoEnabled:autonomy.autoEnabled,floor:autonomy.floor,
  note:'Automatic sending is not available yet: topics can learn and be measured, but CIMA does not send anything on its own.'});
}
export async function POST(request){
 const ctx=await context();
 if(ctx.status!==200)return reply({error:ctx.error},ctx.status);
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'invalid_origin'},403);
 if(Number(request.headers.get('content-length')||0)>20000)return reply({error:'invalid_body'},413);
 let body;try{body=await request.json();}catch{return reply({error:'invalid_body'},400);}
 const action=body?.action,db=serverDatabase();
 if(action==='discover'){const r=await discover(db,ctx.id);return r.ok?reply(r):failure(r);}
 if(action==='replay'){const r=await replay(db,ctx.id);return r.ok?reply(r):failure(r);}
 if(!uuid(body?.id))return reply({error:'invalid_body'},400);
 if(action==='set_fields'){const r=await setRequiredFields(db,ctx.id,body.id,body.fields);return r.ok?reply(r):failure(r);}
 if(['rename','activate','retire','set_floor'].includes(action)){
  const r=await updateTopic(db,ctx.id,body.id,action,action==='rename'?body.label:body.floor);
  if(!r.ok)return failure(r);
  const {profile,...topic}=r.topic;return reply({ok:true,topic});
 }
 return reply({error:'invalid_action'},400);
}

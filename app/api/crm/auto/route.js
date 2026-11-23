import {NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {serverDatabase} from '../../../../lib/crm/instagram';
import {autoMode} from '../../../../lib/crm/auto-answer.mjs';
import {autoOverview,enableAuto,disableAuto,pauseAuto,resumeAuto,setCaps,markWrong} from '../../../../lib/crm/auto-store.mjs';
// Owner control of automatic replies: the master switch, the kill switch, caps, the decision log and "this answer was wrong".
// Turning ON or resuming needs an explicit acknowledgement; stopping never does. This route never sends a message.
export const runtime='nodejs';
export const dynamic='force-dynamic';
const reply=(body,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const uuid=value=>typeof value==='string'&&/^[0-9a-f-]{36}$/i.test(value);
const STATUS={acknowledgement_required:400,invalid_caps:400,not_found:404,not_sent:409,already_marked:409,update_refused:409};
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
 const overview=await autoOverview(serverDatabase(),ctx.id);
 if(!overview.ok)return reply({error:overview.error},503);
 return reply({...overview,serverMode:autoMode()});
}
export async function POST(request){
 const ctx=await context();
 if(ctx.status!==200)return reply({error:ctx.error},ctx.status);
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'invalid_origin'},403);
 if(Number(request.headers.get('content-length')||0)>5000)return reply({error:'invalid_body'},413);
 let body;try{body=await request.json();}catch{return reply({error:'invalid_body'},400);}
 const db=serverDatabase(),action=body?.action;
 let result;
 if(action==='enable')result=await enableAuto(db,ctx.id,{acknowledged:body.acknowledged});
 else if(action==='disable')result=await disableAuto(db,ctx.id);
 else if(action==='pause')result=await pauseAuto(db,ctx.id);
 else if(action==='resume')result=await resumeAuto(db,ctx.id,{acknowledged:body.acknowledged});
 else if(action==='set_caps')result=await setCaps(db,ctx.id,{hourly:body.hourly,customerDaily:body.customerDaily});
 else if(action==='mark_wrong'){
  if(!uuid(body.id))return reply({error:'invalid_body'},400);
  result=await markWrong(db,ctx.id,body.id);
 }else return reply({error:'invalid_action'},400);
 return result.ok?reply(result):reply({error:result.error},STATUS[result.error]||503);
}

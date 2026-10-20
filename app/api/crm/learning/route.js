import {NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {serverDatabase} from '../../../../lib/crm/instagram';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const api=(body,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const valid=id=>typeof id==='string'&&/^[0-9a-f-]{36}$/i.test(id);
async function context(){
 const db=await createClient();const {data:{user},error}=await db.auth.getUser();
 if(error||!user)return {status:401};
 const {data:active,error:entitlement}=await db.rpc('has_active_crm');
 return !entitlement&&active===true?{id:user.id,auth:db,status:200}:{status:403};
}
export async function GET(){
 const ctx=await context();if(!ctx.id)return api({error:'crm_access_required'},ctx.status);
 const {data,error}=await serverDatabase().from('crm_learning_suggestions')
  .select('id,customer_id,kind,field_key,proposed_value,evidence_quote,evidence_interaction_id,confidence,support_count,status,created_at')
  .eq('tenant_id',ctx.id).order('created_at',{ascending:false}).limit(250);
 return error?api({error:'learning_queue_unavailable'},503):api({proposals:data||[],model:'explainable_review_only'});
}
export async function POST(request){
 const ctx=await context();if(!ctx.id)return api({error:'crm_access_required'},ctx.status);
 if(request.headers.get('origin')!==new URL(request.url).origin)return api({error:'invalid_origin'},403);
 let body;try{body=await request.json();}catch{return api({error:'invalid_body'},400);}
 if(!valid(body?.id)||!['accept','reject'].includes(body?.action))return api({error:'invalid_review'},400);
 const {data:item,error}=await serverDatabase().from('crm_learning_suggestions')
 .select('id,kind,field_key,confidence,support_count,status').eq('tenant_id',ctx.id).eq('id',body.id).maybeSingle();
 if(error)return api({error:'unavailable'},503);
 if(!item)return api({error:'not_found'},404);
 if(item.status!=='pending')return api({error:'already_reviewed'},409);
 // Schema discovery is never auto-promoted for arbitrary word clusters.
 const eligible=item.kind==='phone'&&Number(item.confidence)>=.9 ||
 item.kind==='truck_model'||(item.kind==='new_field'&&item.field_key==='truck_model'&&item.support_count>=3);
 if(body.action==='accept'&&!eligible)return api({error:'requires_manual_field_definition'},422);
 const result=await ctx.auth.rpc('crm_review_learning_suggestion',{p_id:item.id,p_accept:body.action==='accept'});
 return result.error?api({error:'review_conflict_or_validation_failed'},409):api({reviewed:true,accepted:body.action==='accept'});
}

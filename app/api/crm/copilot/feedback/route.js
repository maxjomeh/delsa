import {NextResponse} from 'next/server';
import {createClient} from '../../../../../lib/supabase/server';
import {serverDatabase} from '../../../../../lib/crm/instagram';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const reply=(v,status=200)=>NextResponse.json(v,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(request){
 const auth=await createClient();
 const {data:{user},error}=await auth.auth.getUser();
 if(error||!user)return reply({error:'unauthenticated'},401);
 const {data:active,error:subError}=await auth.rpc('has_active_crm');
 if(subError||active!==true)return reply({error:'crm_access_required'},403);
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'invalid_origin'},403);
 let body;try{body=await request.json();}catch{return reply({error:'invalid_request'},400);}
 if(!uuid(body?.candidateId)||!uuid(body?.caseId)||
 !['useful','incorrect','missing_knowledge'].includes(body?.verdict)||
 (body.correctedText!==undefined&&(typeof body.correctedText!=='string'||body.correctedText.length>4000)))
  return reply({error:'invalid_feedback'},400);
 const db=serverDatabase();
 const {data:candidate,error:findError}=await db.from('sima_response_candidates')
  .select('id,review_id').eq('tenant_id',user.id).eq('id',body.candidateId)
  .eq('review_id',body.caseId).maybeSingle();
 if(findError)return reply({error:'feedback_unavailable'},503);
 if(!candidate)return reply({error:'candidate_not_found'},404);
 const corrected=body.verdict==='incorrect'&&body.correctedText?.trim()
  ?body.correctedText.trim():null;
 const {data:saved,error:insertError}=await db.from('sima_copilot_feedback').insert({
  tenant_id:user.id,candidate_id:candidate.id,review_id:candidate.review_id,
  reviewer_id:user.id,verdict:body.verdict,corrected_answer:corrected
 }).select('id,verdict,created_at').single();
 if(insertError?.code==='23505')return reply({error:'feedback_already_submitted'},409);
 if(insertError)return reply({error:'feedback_save_failed'},503);
 return reply({feedback:saved,modelUpdated:false,message:'بازخورد برای ارزیابی آینده ثبت شد؛ مدل خودکار تغییر نکرد.'});
}

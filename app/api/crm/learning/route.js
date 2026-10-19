import {NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {serverDatabase} from '../../../../lib/crm/instagram';
import {extractEvidence,discoverFieldPatterns} from '../../../../lib/crm/learning-evidence.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(data,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function tenant(){
 const db=await createClient();
 const {data:{user}}=await db.auth.getUser();
 if(!user)return null;
 const access=await db.rpc('has_active_crm');
 return access.data===true?user.id:null;
}
async function list(id){
 const db=serverDatabase();
 const {data,error}=await db.from('crm_learning_suggestions').select('id,kind,field_key,proposed_value,evidence_quote,confidence,support_count,status,customer_id,created_at').eq('tenant_id',id).order('created_at',{ascending:false}).limit(300);
 if(error)throw error;
 return data||[];
}
export async function GET(){
 const id=await tenant();if(!id)return json({error:'دسترسی سیما لازم است.'},403);
 try{return json({suggestions:await list(id)});}catch{return json({error:'خطا در بارگذاری پیشنهادها'},503);}
}
export async function POST(request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'مبدأ نامعتبر'},403);
 const id=await tenant();if(!id)return json({error:'دسترسی سیما لازم است.'},403);
 let data;try{data=await request.json();}catch{return json({error:'درخواست نامعتبر'},400);}
 const db=serverDatabase();
 if(data.action==='analyze'){
  try{
   const {data:interactions,error}=await db.from('crm_interactions').select('id,customer_id,body,kind,direction,occurred_at').eq('tenant_id',id).order('occurred_at',{ascending:false}).limit(5000);
   if(error)throw error;
   const already=await list(id);
   const proposals=extractEvidence(interactions);
   const proposals2=discoverFieldPatterns(interactions);
   for(const p of proposals2)proposals.push({kind:'new_field',key:p.key,value:p.label,confidence:p.confidence,quote:p.quote,interaction_id:p.interaction_id,customer_id:null,support_count:p.support_count});
   let created=0;
   for(const s of proposals.slice(0,300)){
    if(already.some(x=>x.kind===s.kind&&x.customer_id===s.customer_id&&x.field_key===s.key&&x.proposed_value===s.value))continue;
    const {error:insertError}=await db.from('crm_learning_suggestions').insert({tenant_id:id,customer_id:s.customer_id||null,kind:s.kind,field_key:s.key,proposed_value:s.value,evidence_quote:s.quote,confidence:s.confidence,support_count:s.support_count||1,evidence_interaction_id:s.interaction_id||null});
    if(!insertError)created++;
   }
   return json({created,suggestions:await list(id)});
  }catch{return json({error:'تحلیل مکالمات انجام نشد.'},503);}
 }
 if(data.action!=='accept'&&data.action!=='reject')return json({error:'عملیات نامعتبر'},400);
 if(typeof data.id!=='string'||!/^[0-9a-f-]{36}$/i.test(data.id))return json({error:'شناسه نامعتبر'},400);
 // Approval happens via one SECURITY DEFINER RPC, enforcing tenant ownership
 // and locking this suggestion to prevent a concurrent duplicate accept.
 const auth=await createClient();
 const {data:out,error}=await auth.rpc('crm_review_learning_suggestion',{p_id:data.id,p_accept:data.action==='accept'});
 if(error)return json({error:'ثبت تصمیم انجام نشد؛ پیشنهاد را بررسی کنید.'},503);
 return json({result:out,suggestions:await list(id)});
}

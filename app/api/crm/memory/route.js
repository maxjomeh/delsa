import {NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {serverDatabase} from '../../../../lib/crm/instagram';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const json=(value,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request){
 const auth=await createClient();
 const {data:{user},error}=await auth.auth.getUser();
 if(error||!user)return json({error:'unauthenticated'},401);
 const {data:active,error:entitlement}=await auth.rpc('has_active_crm');
 if(entitlement||active!==true)return json({error:'crm_access_required'},403);
 const params=new URL(request.url).searchParams;
 const customerId=params.get('customerId'),caseId=params.get('caseId');
 if(!uuid(customerId)||!uuid(caseId))return json({error:'invalid_ids'},400);
 const db=serverDatabase();
 const {data:review,error:reviewError}=await db.from('sima_human_review_cases')
  .select('id,customer_id,channel').eq('tenant_id',user.id).eq('id',caseId).eq('customer_id',customerId).maybeSingle();
 if(reviewError)return json({error:'memory_unavailable'},503);
 if(!review)return json({error:'review_not_found'},404);
 const [{data:customer,error:cErr},{data:states,error:sErr},{data:identities,error:iErr}]=await Promise.all([
  db.from('crm_customers').select('id,name,city,instagram,phone,custom_fields,updated_at,do_not_contact')
   .eq('tenant_id',user.id).eq('id',customerId).maybeSingle(),
  db.from('crm_information_states').select('field_id,source,source_quote,source_interaction_id,proposed_value,updated_at,status')
   .eq('tenant_id',user.id).eq('customer_id',customerId).in('status',['confirmed','review']).limit(100),
  db.from('crm_zernio_contacts').select('platform,username,avatar_url').eq('tenant_id',user.id).eq('customer_id',customerId).limit(8)
 ]);
 if(cErr||sErr||iErr||!customer)return json({error:'memory_unavailable'},503);
 const fieldIds=[...new Set((states||[]).map(x=>x.field_id))];
 let fields=[];
 if(fieldIds.length){
  const {data,error}=await db.from('crm_field_definitions').select('id,label,key,type')
   .eq('tenant_id',user.id).in('id',fieldIds);
  if(error)return json({error:'memory_unavailable'},503);
  fields=data||[];
 }
 const byId=new Map(fields.map(x=>[x.id,x]));
 const mapped=(states||[]).filter(x=>byId.has(x.field_id)).map(x=>({
  label:byId.get(x.field_id).label,key:byId.get(x.field_id).key,
  value:x.proposed_value,sourceQuote:x.source_quote||null,sourceInteractionId:x.source_interaction_id,
  updatedAt:x.updated_at,provenance:x.source||'review_state',status:x.status
 }));
 // CRM phone and city may have been populated by earlier heuristics, so never
 // claim they were owner-verified unless they carry an explicit verified fact.
 return json({customer:{name:customer.name,phone:customer.phone||'',city:customer.city||'',
   phoneVerification:'unknown',doNotContact:customer.do_not_contact,
   social:(identities||[]).map(x=>({platform:x.platform,username:x.username||null,avatarUrl:x.avatar_url||null}))},
  verifiedFacts:mapped.filter(x=>x.status==='confirmed'),verifiedFactsCount:mapped.filter(x=>x.status==='confirmed').length,
  pendingFacts:mapped.filter(x=>x.status==='review'),
  note:'مقادیر معمول پروفایل بدون شاهد تأییدشده، حقیقت قطعی تلقی نمی‌شوند.'});
}

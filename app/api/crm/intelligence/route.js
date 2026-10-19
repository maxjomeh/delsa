import {NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {serverDatabase} from '../../../../lib/crm/instagram';
import {discoverFields,explicitPhone,fieldCandidates} from '../../../../lib/crm/adaptive-fields.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const respond=(value,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
const restricted=/(کد ملی|ملیت|مذهب|دین|بیماری|سلامت|سن|درآمد|ایدئولوژ|جنسیت|سیاسی|قومیت|رابطه جنسی|password|رمز|پاسورد|کارت بانکی)/i;
async function context(){
 const auth=await createClient();
 const {data:{user}}=await auth.auth.getUser();
 if(!user)return {status:401};
 const active=await auth.rpc('has_active_crm');
 return active.data===true&&!active.error?{tenant:user.id,status:200}:{status:403};
}
async function interactions(db,tenant,maxPages=10){
 const all=[];
 for(let i=0;i<maxPages;i++){
  const {data,error}=await db.from('crm_interactions').select('id,customer_id,direction,kind,channel,body,occurred_at,created_at')
   .eq('tenant_id',tenant).order('occurred_at',{ascending:true}).range(i*500,i*500+499);
  if(error)throw error;
  all.push(...data);
  if(data.length<500)break;
 }
 return all;
}
function normalizePhone(value){
 return String(value||'').trim().replace(/^\+98|^0098|^98/,'0');
}
function phoneCandidates(rows){
 const customerRows=new Map(),proposals=new Map();
 for(const row of rows){const r=customerRows.get(row.customer_id)||[];r.push(row);customerRows.set(row.customer_id,r);}
 for(const [id,items] of customerRows){
  const candidates=[];
  for(let i=0;i<items.length;i++){
   const row=items[i];if(row.kind!=='message'||row.direction!=='inbound')continue;
   let phone=explicitPhone(row.body);
   if(!phone&&i>0){
    const prev=items[i-1];
    if(prev.direction==='outbound'&&/(شماره.{0,18}(موبایل|تماس|تلفن|تون|شما)|شماره.{0,10}(بفرست|بدین|بده)|موبایل.{0,15}(چند|بفرست))/u.test(prev.body)){
     const t=normalizePhone(row.body.replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))));
     if(/^09\d{9}$/.test(t))phone=t;
    }
   }
   if(phone)candidates.push({phone,sourceId:row.id,quote:String(row.body).slice(0,500)});
  }
  const unique=[...new Set(candidates.map(x=>x.phone))];
  if(unique.length===1)proposals.set(id,candidates.at(-1));
 }
 return proposals;
}
async function learn(db,tenant){
 // Phase 0: learning NEVER changes verified customer facts or CRM schema.
 // Candidates are stored with an exact source and require explicit review.
 const rows=await interactions(db,tenant);
 const {data:customers,error:customerError}=await db.from('crm_customers').select('id,phone').eq('tenant_id',tenant).limit(5000);
 if(customerError)throw customerError;
 const customerById=new Map((customers||[]).map(c=>[c.id,c]));
 let phoneProposals=0,phoneConflicts=0,fieldProposals=0;
 const propose=async value=>{
  const q=db.from('crm_learning_suggestions').select('id')
   .eq('tenant_id',tenant).eq('kind',value.kind).eq('field_key',value.field_key).eq('proposed_value',value.proposed_value);
  if(value.customer_id)q.eq('customer_id',value.customer_id);
  else q.is('customer_id',null);
  const {data:existing,error:checkError}=await q.limit(1);
  if(checkError)throw checkError;
  if(existing?.length)return false;
  const {error}=await db.from('crm_learning_suggestions').insert({...value,tenant_id:tenant,status:'pending'});
  if(error&&error.code!=='23505')throw error;
  return !error;
 };
 for(const [customerId,p] of phoneCandidates(rows)){
  const customer=customerById.get(customerId);if(!customer||customer.phone===p.phone)continue;
  const conflict=!!customer.phone;
  const created=await propose({
   customer_id:customerId,kind:'phone',field_key:'phone',proposed_value:p.phone,
   evidence_quote:p.quote||'شماره تماس در پیام مشتری مطرح شده است.',
   evidence_interaction_id:p.sourceId,confidence:conflict?.72:.9,support_count:1
  });
  if(created)phoneProposals++;
  if(conflict)phoneConflicts++;
 }
 const {data:definitions,error:definitionsError}=await db.from('crm_field_definitions').select('key,label').eq('tenant_id',tenant);
 if(definitionsError)throw definitionsError;
 const fields=[];
 const groups=discoverFields(rows,{minOccurrences:3,minCustomers:2});
 for(const group of groups){
  if(restricted.test(group.label)||(definitions||[]).some(x=>x.key===group.key||x.label===group.label))continue;
  const evidence=group.sourceInteractions?.[0];
  if(!evidence)continue;
  const created=await propose({
   customer_id:null,kind:'new_field',field_key:group.key,proposed_value:group.label,
   evidence_quote:String(evidence.body||group.question).slice(0,500),
   evidence_interaction_id:evidence.id,confidence:.7,support_count:group.distinctCustomers||2
  });
  if(created)fieldProposals++;
  fields.push({label:group.label,occurrences:group.occurrences,distinctCustomers:group.distinctCustomers,reviewCount:0,status:'pending_owner_approval'});
 }
 return {
  messagesAnalyzed:rows.length,customersAnalyzed:customers.length,phoneUpdates:0,
  phoneProposals,phoneConflicts,newFields:0,fieldProposals,extractions:0,fields,
  kind:'local_tfidf_learning',externalAiEnabled:false,reviewRequired:true
 };
}
export async function GET(){
 const ctx=await context();if(!ctx.tenant)return respond({error:'login_or_subscription_required'},ctx.status);
 const db=serverDatabase();
 const {data,error}=await db.from('crm_field_definitions').select('id,key,label,created_at').eq('tenant_id',ctx.tenant).like('key','learned_%').order('created_at',{ascending:false}).limit(50);
 return error?respond({error:'unavailable'},503):respond({fields:data,externalAiConfigured:!!process.env.OPENAI_API_KEY});
}
export async function POST(request){
 const ctx=await context();if(!ctx.tenant)return respond({error:'login_or_subscription_required'},ctx.status);
 if(request.headers.get('origin')!==new URL(request.url).origin)return respond({error:'invalid_origin'},403);
 try{const data=await learn(serverDatabase(),ctx.tenant);return respond(data);}
 catch(e){return respond({error:'learning_failed'},503);}
}

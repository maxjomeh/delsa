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
 const rows=await interactions(db,tenant);
 const {data:customers,error:customerError}=await db.from('crm_customers').select('id,phone,custom_fields').eq('tenant_id',tenant).limit(5000);
 if(customerError)throw customerError;
 const customerById=new Map(customers.map(c=>[c.id,c]));
 let phones=0,phoneReview=0;
 for(const [customerId,p] of phoneCandidates(rows)){
  const customer=customerById.get(customerId);if(!customer)continue;
  if(customer.phone&&customer.phone!==p.phone){phoneReview++;continue;}
  if(!customer.phone){
   const {error}=await db.from('crm_customers').update({phone:p.phone,updated_at:new Date().toISOString()}).eq('id',customerId).eq('tenant_id',tenant).eq('phone','');
   if(!error)phones++;
   else phoneReview++;
  }
 }
 const proposed=discoverFields(rows,{minOccurrences:3,minCustomers:2});
 const existingResult=await db.from('crm_field_definitions').select('id,key,label').eq('tenant_id',tenant);
 if(existingResult.error)throw existingResult.error;
 const fields=[];let newFields=0,extractions=0;
 for(const group of proposed){
  if(restricted.test(group.label)||existingResult.data.some(x=>x.label===group.label&&x.key!==group.key))continue;
  const incoming={tenant_id:tenant,key:group.key,label:group.label,type:'text',priority:50,question:group.question,condition:'always',enabled:true,ask_enabled:false};
  let {data:field,error:fieldError}=await db.from('crm_field_definitions').select('id,label,key').eq('tenant_id',tenant).eq('key',group.key).maybeSingle();
  if(fieldError)continue;
  if(!field){
   const created=await db.from('crm_field_definitions').insert(incoming).select('id,label,key').single();
   if(created.error){const v=await db.from('crm_field_definitions').select('id,label,key').eq('tenant_id',tenant).eq('key',group.key).maybeSingle();field=v.data;}
   else {field=created.data;newFields++;}
  }
  if(!field)continue;
  const candidates=fieldCandidates(rows,group);
  let reviewCount=0;
  for(const candidate of candidates){
   if(!customerById.has(candidate.customerId))continue;
   const {data:current}=await db.from('crm_information_states').select('status').eq('tenant_id',tenant).eq('customer_id',candidate.customerId).eq('field_id',field.id).maybeSingle();
   if(current?.status==='confirmed'||current?.status==='declined'||current?.status==='review')continue;
   const {error}=await db.from('crm_information_states').upsert({
     tenant_id:tenant,customer_id:candidate.customerId,field_id:field.id,status:'review',
     source:'explicit_message',source_interaction_id:candidate.interactionId,source_quote:candidate.quote,
     proposed_value:candidate.value,updated_at:new Date().toISOString()
   },{onConflict:'tenant_id,customer_id,field_id'});
   if(!error){reviewCount++;extractions++;}
  }
  fields.push({label:group.label,occurrences:group.occurrences,distinctCustomers:group.distinctCustomers,reviewCount});
 }
 return {messagesAnalyzed:rows.length,customersAnalyzed:customers.length,phoneUpdates:phones,phoneConflicts:phoneReview,newFields,extractions,fields,kind:'local_tfidf_learning',externalAiEnabled:false};
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

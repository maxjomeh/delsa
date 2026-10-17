import {NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {createClient as createService} from '@supabase/supabase-js';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const fail=(error,status=400)=>NextResponse.json({error},{status});
const ok=value=>NextResponse.json(value,{headers:{'Cache-Control':'no-store'}});
const valid=id=>/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(id||''));
async function admin(request){
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)return {response:fail('درخواست نامعتبر است.',403)};
 const db=await createClient(),{data:{user}}=await db.auth.getUser();
 if(!user)return {response:fail('ورود مدیر لازم است.',401)};
 const {data:profile}=await db.from('profiles').select('role').eq('id',user.id).maybeSingle();
 return profile?.role==='admin'?{db,user}:{response:fail('دسترسی مدیر لازم است.',403)};
}
export async function GET(request){
 const {db,user,response}=await admin(request);if(response)return response;
 if(new URL(request.url).searchParams.get('apuSummary')==='1'){const {data,error}=await db.rpc('admin_apu_change_summary');return error?fail('تغییرات بارگذاری نشد.',503):ok({changes:data||[]});}
 const id=new URL(request.url).searchParams.get('customerId');if(!valid(id))return fail('مشتری نامعتبر است.');
 const results=await Promise.all([
  db.from('customer_stores').select('name,website').eq('customer_id',id).maybeSingle(),
  db.from('customer_subscriptions').select('id,product_id,plan,starts_at,expires_at').eq('customer_id',id).order('expires_at'),
  db.from('customer_platform_credentials').select('id,platform,username').eq('customer_id',id).order('created_at',{ascending:false}),
  db.from('apu_sources').select('*').eq('user_id',id).is('deleted_at',null).order('created_at',{ascending:false}),
  db.from('apu_rules').select('*').eq('user_id',id).is('deleted_at',null).order('created_at',{ascending:false}),
  db.from('apu_change_history').select('*').eq('user_id',id).order('id',{ascending:false}).limit(100),
  db.from('apu_history_reads').select('last_seen_id').eq('admin_id',user.id).eq('user_id',id).maybeSingle()]);
 if(results.some(r=>r.error))return fail('جدول‌های جزئیات مشتری آماده نیستند؛ migration را اجرا کنید.',503);
 return ok({store:results[0].data,subscriptions:results[1].data||[],credentials:results[2].data||[],sources:results[3].data||[],rules:results[4].data||[],history:results[5].data||[],lastSeenId:results[6].data?.last_seen_id||0});
}
export async function POST(request){
 const {db,user,response}=await admin(request);if(response)return response;
 let b;try{b=await request.json()}catch{return fail('درخواست نامعتبر است.')}
 const id=b.customerId;if(!valid(id))return fail('مشتری نامعتبر است.');
 if(b.action==='apu-seen'){
  if(!Number.isSafeInteger(b.lastSeenId)||b.lastSeenId<1)return fail('شناسه تغییر نامعتبر است.');
  const {data:event}=await db.from('apu_change_history').select('id').eq('id',b.lastSeenId).eq('user_id',id).maybeSingle();
  if(!event)return fail('تغییر پیدا نشد.',404);
  const {data:cursor}=await db.from('apu_history_reads').select('last_seen_id').eq('admin_id',user.id).eq('user_id',id).maybeSingle();
  if((cursor?.last_seen_id||0)>=b.lastSeenId)return ok({ok:true});
  const {error}=await db.from('apu_history_reads').upsert({admin_id:user.id,user_id:id,last_seen_id:b.lastSeenId});
  return error?fail('ثبت مشاهده انجام نشد.'):ok({ok:true});
 }
 if(b.action==='store'){
  const name=String(b.name||'').trim(),website=String(b.website||'').trim();
  if(name.length>120||website.length>2048)return fail('اطلاعات فروشگاه طولانی است.');
  if(website){try{const url=new URL(website);if(!['https:','http:'].includes(url.protocol))throw Error()}catch{return fail('لینک سایت معتبر نیست.')}}
  const {error}=await db.from('customer_stores').upsert({customer_id:id,name,website,updated_at:new Date().toISOString()});
  return error?fail('ذخیره فروشگاه انجام نشد.'):ok({ok:true});
 }
 if(b.action==='subscription'){
  if(!valid(b.productId)||!['demo','month','quarter','year'].includes(b.plan))return fail('محصول و مدت را انتخاب کنید.');
  const {data:product}=await db.from('store_products').select('id').eq('id',b.productId).maybeSingle();
  if(!product)return fail('محصول پیدا نشد.',404);
  const start=new Date(),end=new Date(start);
  if(b.plan==='demo')end.setUTCDate(end.getUTCDate()+7);
  else if(b.plan==='year')end.setUTCFullYear(end.getUTCFullYear()+1);
  else end.setUTCMonth(end.getUTCMonth()+(b.plan==='quarter'?3:1));
  const {error}=await db.from('customer_subscriptions').upsert({customer_id:id,product_id:b.productId,plan:b.plan,starts_at:start.toISOString(),expires_at:end.toISOString()},{onConflict:'customer_id,product_id'});
  return error?fail('اشتراک ذخیره نشد.'):ok({ok:true});
 }
 if(b.action==='adjust'){
  if(!valid(b.subscriptionId)||![1,-1].includes(b.days))return fail('درخواست نامعتبر است.');
  const {data:item}=await db.from('customer_subscriptions').select('expires_at').eq('id',b.subscriptionId).eq('customer_id',id).maybeSingle();
  if(!item)return fail('اشتراک پیدا نشد.',404);
  const end=new Date(item.expires_at);end.setUTCDate(end.getUTCDate()+b.days);
  const {data,error}=await db.from('customer_subscriptions').update({expires_at:end.toISOString()}).eq('id',b.subscriptionId).eq('customer_id',id).eq('expires_at',item.expires_at).select('id');
  return error||!data?.length?fail('تغییر مدت انجام نشد؛ دوباره تلاش کنید.',409):ok({ok:true});
 }
 if(b.action==='role'){
  if(user.id===id||!['user','admin'].includes(b.role))return fail('تغییر نقش مجاز نیست.');
  const {error}=await db.rpc('admin_set_customer_role',{target_id:id,new_role:b.role});
  return error?fail('تغییر نقش انجام نشد؛ migration را بررسی کنید.'):ok({ok:true});
 }
 if(b.action==='delete-customer'){
  if(user.id===id)return fail('حساب خودتان را نمی‌توانید حذف کنید.');
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY,url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  if(!key||!url)return fail('کلید سرویس برای حذف کامل حساب تنظیم نشده است.',503);
  const {data:target}=await db.from('profiles').select('id').eq('id',id).maybeSingle();if(!target)return fail('مشتری پیدا نشد.',404);
  const service=createService(url,key,{auth:{persistSession:false}});
  const {error}=await service.auth.admin.deleteUser(id);
  return error?fail('حذف مشتری انجام نشد.'):ok({ok:true});
 }
 return fail('عملیات نامعتبر است.');
}
export async function DELETE(request){
 const {db,response}=await admin(request);if(response)return response;
 const p=new URL(request.url).searchParams,id=p.get('id'),customerId=p.get('customerId');
 if(!valid(id)||!valid(customerId))return fail('شناسه نامعتبر است.');
 const {data,error}=await db.from('customer_subscriptions').delete().eq('id',id).eq('customer_id',customerId).select('id');
 return error||!data?.length?fail('حذف اشتراک انجام نشد.'):ok({ok:true});
}

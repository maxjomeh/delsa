import {NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {database,action,scan} from '../../../../lib/dorpin/server';
import {productId} from '../../../../lib/dorpin/digikala.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(value,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store, private'}});
async function access(){const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return {response:json({error:'ابتدا وارد حساب شوید.'},401)};const a=await db.rpc('has_active_dorpin');if(a.error||!a.data)return {response:json({error:'اشتراک فعال دورپین لازم است.'},403)};return {db,user};}
export async function GET(){try{const a=await access();if(a.response)return a.response;const result=await a.db.from('dorpin_monitors').select('id,dkp,label,title,offers,checked_at,attempted_at,error,variant_group,selected_offer,excluded,mode,min_saving,interval_minutes,history').order('created_at',{ascending:false}).limit(200);if(result.error)throw result.error;return json({items:result.data});}catch{return json({error:'اطلاعات پایش دریافت نشد؛ تنظیمات سرور و پایگاه داده را بررسی کنید.'},503);}}
export async function POST(request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'درخواست معتبر نیست.'},403);
 try{
  const a=await access();if(a.response)return a.response;
  const text=await request.text();if(text.length>4000)return json({error:'درخواست بیش از حد بزرگ است.'},413);
  let b;try{b=JSON.parse(text);}catch{return json({error:'درخواست معتبر نیست.'},400);}
  const db=database();
  if(b.action==='add'){
   let dkp;try{dkp=productId(b.url);}catch(e){return json({error:e.message},400);}
   const label=String(b.label||'').trim();if(!label||label.length>300)return json({error:'نام محصول لازم است.'},400);
   const count=await db.from('dorpin_monitors').select('id',{count:'exact',head:true}).eq('user_id',a.user.id);if(count.error)throw count.error;if(count.count>=200)return json({error:'سقف این نسخه ۲۰۰ محصول است.'},409);
   const result=await db.from('dorpin_monitors').insert({user_id:a.user.id,dkp,label}).select('id').single();if(result.error){if(result.error.code==='23505')return json({error:'این محصول قبلاً ثبت شده است.'},409);throw result.error;}
   return json({ok:true,id:result.data.id});
  }
  if(!/^[a-f0-9-]{36}$/i.test(b.id||''))return json({error:'محصول معتبر نیست.'},400);
  if(b.action==='scan'){const result=await scan(db,a.user.id,b.id);return json(result,result.busy?429:result.failed?502:200);}
  if(!['select','configure','exclude'].includes(b.action))return json({error:'عملیات معتبر نیست.'},400);
  if(b.action==='configure'&&(!['approval','automatic','locked'].includes(b.mode)||!Number.isSafeInteger(b.min_saving)||b.min_saving<0||!Number.isInteger(b.interval_minutes)||b.interval_minutes<60||b.interval_minutes>10080))return json({error:'تنظیمات معتبر نیست.'},400);
  const result=await action(db,a.user.id,b.id,b.action,b);return json(result);
 }catch(e){const message=String(e.message);if(/refresh_required|offer_missing/.test(message))return json({error:'ابتدا قیمت‌ها را دوباره بررسی کنید؛ پیشنهاد انتخابی باید تازه و موجود باشد.'},409);if(/not_found|subscription_required/.test(message))return json({error:'دسترسی به محصول ممکن نیست.'},403);return json({error:'عملیات انجام نشد؛ دوباره تلاش کنید.'},503);}
}

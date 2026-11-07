import {NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {createClient as createService} from '@supabase/supabase-js';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const validUUID=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value||''));
const fail=(error,status=400)=>NextResponse.json({error},{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request){
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)return fail('درخواست از مبدأ نامعتبر است.',403);
 const db=await createClient();
 const {data:{user},error:authError}=await db.auth.getUser();
 if(authError||!user)return fail('لطفاً وارد حساب مدیریت شوید.',401);
 const {data:profile}=await db.from('profiles').select('role').eq('id',user.id).maybeSingle();
 if(profile?.role!=='admin')return fail('دسترسی مدیر لازم است.',403);
 let body;try{body=await request.json()}catch{return fail('درخواست نامعتبر است.')}
 const kind=body?.kind,ids=body?.ids;
 if(!['visitor','customer'].includes(kind)||!Array.isArray(ids)||ids.length<1||ids.length>30||ids.some(id=>!validUUID(id))||new Set(ids).size!==ids.length)return fail('حداکثر ۳۰ گفت‌وگوی معتبر انتخاب کنید.');
 if(body.confirm!=='DELETE_CHATS')return fail('تأیید حذف گفت‌وگوها نامعتبر است.');
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return fail('دسترسی سرویس حذف روی سرور تنظیم نشده است.',503);
 const service=createService(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 if(kind==='visitor'){
  const {data:known,error:readError}=await service.from('visitor_chats').select('id').in('id',ids);
  if(readError)return fail('بررسی گفت‌وگوها ناموفق بود.',503);
  if(known.length!==ids.length)return fail('بعضی گفت‌وگوها دیگر موجود نیستند؛ فهرست را تازه‌سازی کنید.',409);
  // visitor_chat_messages is ON DELETE CASCADE: delete thread and its messages atomically.
  const {data,error}=await service.from('visitor_chats').delete().in('id',ids).select('id');
  if(error||data?.length!==ids.length)return fail('حذف گفتگوهای بازدیدکنندگان کامل نشد؛ فهرست را تازه‌سازی کنید.',409);
  return NextResponse.json({ok:true,deleted:data.length},{headers:{'Cache-Control':'no-store'}});
 }
 // Delete messages only: never delete the customer's account or any CRM information.
 const {data:known,error:readError}=await service.from('profiles').select('id,role').in('id',ids);
 if(readError||known?.length!==ids.length)return fail('بعضی حساب‌ها پیدا نشدند.',409);
 if(known.some(p=>p.role==='admin'))return fail('حذف تاریخچه پشتیبانی مدیران مجاز نیست.',403);
 const {error}=await service.from('support_messages').delete().in('user_id',ids);
 if(error)return fail('حذف پیام‌های پشتیبانی انجام نشد.',409);
 return NextResponse.json({ok:true,deleted:ids.length},{headers:{'Cache-Control':'no-store'}});
}

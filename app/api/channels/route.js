import {NextResponse} from 'next/server';
import {createClient} from '../../../lib/supabase/server';
import {instagramConfiguration,serverDatabase} from '../../../lib/crm/instagram';
import {isGrantUpdate,isUsableConnection} from '../../../lib/crm/channel-hub.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(body,status=200)=>NextResponse.json(body,{
 status,headers:{'Cache-Control':'no-store, private'}
});

async function session() {
 const db=await createClient();
 const {data:{user},error}=await db.auth.getUser();
 if(error||!user)return {error:json({error:'برای مدیریت کانال‌ها وارد شوید.'},401)};
 return {db,user};
}

// Shared DELSA read endpoint: never returns OAuth secrets, remote customer IDs,
// decrypted tokens or any connection belonging to another authenticated user.
export async function GET(request){
 const s=await session();if(s.error)return s.error;
 const [connections,grants,entitlement]=await Promise.all([
  s.db.from('crm_channel_connections')
   .select('id,channel,username,status,expires_at,last_received_at')
   .eq('tenant_id',s.user.id).order('created_at',{ascending:false}).limit(30),
  s.db.from('delsa_channel_grants')
   .select('connection_id,service_code,allowed')
   .eq('tenant_id',s.user.id).limit(60),
  s.db.rpc('has_active_crm')
 ]);
 if(connections.error||grants.error||entitlement.error){
  return json({error:'تنظیمات Channel Hub هنوز آماده نیست؛ وضعیت دیتابیس را بررسی کنید.'},503);
 }
 return json({
  configured:instagramConfiguration(new URL(request.url).origin).ready,
  crmEnabled:!!entitlement.data,
  channels:connections.data||[],grants:grants.data||[],
  availableServices:['crm'],
  outboundEnabled:false
 });
}

export async function POST(request) {
 if(request.headers.get('origin')!==new URL(request.url).origin)
  return json({error:'مبدأ درخواست معتبر نیست.'},403);
 const s=await session();if(s.error)return s.error;
 let body;
 try{
  const raw=await request.text();
  if(raw.length>1024)return json({error:'درخواست بیش از حد بزرگ است.'},413);
  body=JSON.parse(raw);
 }catch{return json({error:'ساختار درخواست نامعتبر است.'},400);}
 if(!isGrantUpdate(body))return json({error:'این مجوز هنوز پشتیبانی نمی‌شود.'},400);
 const connection=await s.db.from('crm_channel_connections')
   .select('id,tenant_id,channel,status,expires_at')
   .eq('tenant_id',s.user.id).eq('id',body.connectionId).maybeSingle();
 if(connection.error)return json({error:'خطا در اعتبارسنجی مالکیت اتصال.'},503);
 if(!connection.data)return json({error:'این اتصال متعلق به حساب شما نیست.'},404);

 if(body.allowed){
  if(!isUsableConnection(connection.data))
   return json({error:'ابتدا حساب اینستاگرام را دوباره متصل کنید.'},409);
  const active=await s.db.rpc('has_active_crm');
  if(active.error||!active.data)
   return json({error:'برای اعطای دسترسی سیما، اشتراک فعال لازم است.'},403);
 }
 // Disabling a grant is still allowed after subscription expiry.
 try{
  const privileged=serverDatabase();
  const {error}=await privileged.from('delsa_channel_grants').upsert({
   tenant_id:s.user.id,connection_id:connection.data.id,
   service_code:'crm',allowed:body.allowed,updated_at:new Date().toISOString()
  },{onConflict:'connection_id,service_code'});
  if(error)throw error;
  return json({ok:true,connectionId:connection.data.id,serviceCode:'crm',allowed:body.allowed});
 }catch{
  return json({error:'ذخیره مجوز انجام نشد؛ پیکربندی سرور را بررسی کنید.'},503);
 }
}

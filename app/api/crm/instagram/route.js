import {NextResponse} from 'next/server';
import {randomBytes} from 'node:crypto';
import {createClient} from '../../../../lib/supabase/server';
import {instagramConfiguration,instagramAuthorization,seal,serverDatabase} from '../../../../lib/crm/instagram';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(value,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store, private'}});
async function authenticated(){const db=await createClient();const {data:{user}}=await db.auth.getUser();return {db,user};}
export async function GET(request){
 const {db,user}=await authenticated();if(!user)return json({error:'ابتدا وارد پنل شوید.'},401);
 const {data,error}=await db.from('crm_channel_connections').select('id,username,status,expires_at,last_received_at').eq('tenant_id',user.id).order('created_at',{ascending:false});
 if(error)return json({error:'وضعیت اتصال دریافت نشد.'},503);
 return json({configured:instagramConfiguration(new URL(request.url).origin).ready,connections:data||[],automaticReplies:false,freeConversationExtraction:false});
}
export async function POST(request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'درخواست معتبر نیست.'},403);
 const {db,user}=await authenticated();if(!user)return json({error:'ابتدا وارد پنل شوید.'},401);
 let body;try{body=await request.json();}catch{return json({error:'درخواست معتبر نیست.'},400);}
 if(body.action==='disconnect'){
  if(!/^[a-f0-9-]{36}$/.test(String(body.id||'')))return json({error:'اتصال معتبر نیست.'},400);
  const {data}=await db.from('crm_channel_connections').select('id').eq('id',body.id).eq('tenant_id',user.id).maybeSingle();if(!data)return json({error:'اتصال پیدا نشد.'},404);
  try{const r=await serverDatabase().rpc('crm_disconnect_instagram',{p_tenant:user.id,p_connection:body.id});if(r.error)throw r.error;return json({ok:true});}catch{return json({error:'قطع اتصال انجام نشد.'},503);}
 }
 if(body.action!=='connect')return json({error:'درخواست معتبر نیست.'},400);
 const entitlement=await db.rpc('has_active_crm');if(entitlement.error||!entitlement.data)return json({error:'اشتراک فعال سیما لازم است.'},403);
 if(!instagramConfiguration(new URL(request.url).origin).ready)return json({error:'اتصال رسمی اینستاگرام هنوز توسط دلسا تنظیم نشده است.'},503);
 const nonce=randomBytes(32).toString('base64url');const response=json({url:instagramAuthorization(nonce)});
 response.cookies.set('sima_instagram_state',seal(JSON.stringify({nonce,userId:user.id,expires:Date.now()+600000})),{httpOnly:true,secure:true,sameSite:'lax',maxAge:600,path:'/api/crm/instagram'});
 return response;
}

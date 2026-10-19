import {NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {serverDatabase} from '../../../../lib/crm/instagram';
import {zernioConfigured,zernioRequest,publicAccount,profileIdValid,ZERNIO_PLATFORMS} from '../../../../lib/crm/zernio.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';

const json=(data,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const enabled=()=>zernioConfigured()&&process.env.ZERNIO_CONNECT_ENABLED==='true';

async function userContext(){
 const db=await createClient(),{data:{user},error}=await db.auth.getUser();
 if(error||!user)return {user:null,entitled:false};
 const active=await db.rpc('has_active_crm');
 return {user,entitled:!active.error&&active.data===true};
}
async function ownProfile(tenant){
 const db=serverDatabase();
 const {data,error}=await db.from('crm_zernio_profiles').select('profile_id').eq('tenant_id',tenant).maybeSingle();
 if(error)throw new Error('ZERNIO_STORAGE_NOT_READY');
 return data?.profile_id||null;
}
async function provisionProfile(tenant){
 const saved=await ownProfile(tenant);if(saved)return saved;
 let listed=await zernioRequest('GET','/v1/profiles',{query:{externalId:tenant}});
 let existing=(listed.profiles||[]).find(p=>p.externalId===tenant&&profileIdValid(p._id));
 let profileId=existing?._id;
 if(!profileId){
  try{
   const created=await zernioRequest('POST','/v1/profiles',{body:{name:`DELSA · ${tenant.slice(0,12)}`,externalId:tenant},idempotencyKey:`delsa-profile-${tenant}`});
   if(created.profile?.externalId!==tenant||!profileIdValid(created.profile?._id))throw new Error('ZERNIO_PROFILE_INVALID');
   profileId=created.profile._id;
  }catch(e){
   if(e.status!==409)throw e;
   listed=await zernioRequest('GET','/v1/profiles',{query:{externalId:tenant}});
   profileId=(listed.profiles||[]).find(p=>p.externalId===tenant&&profileIdValid(p._id))?._id;
   if(!profileId)throw new Error('ZERNIO_PROFILE_CONFLICT');
  }
 }
 const db=serverDatabase();
 const inserted=await db.from('crm_zernio_profiles').insert({tenant_id:tenant,profile_id:profileId});
 if(inserted.error){
  if(inserted.error.code!=='23505')throw new Error('ZERNIO_PROFILE_SAVE_FAILED');
  const concurrent=await ownProfile(tenant);
  if(!concurrent||concurrent!==profileId)throw new Error('ZERNIO_PROFILE_CONFLICT');
 }
 return profileId;
}
export async function GET(){
 const {user,entitled}=await userContext();
 if(!user)return json({error:'ابتدا وارد پنل شوید.'},401);
 const configured=zernioConfigured();
 if(!entitled)return json({configured,enabled:false,entitled:false,accounts:[]});
 if(!enabled())return json({configured,enabled:false,entitled:true,accounts:[]});
 try{
  const profileId=await ownProfile(user.id);
  if(!profileId)return json({configured,enabled:true,entitled:true,profileReady:false,accounts:[]});
  const result=await zernioRequest('GET','/v1/accounts',{query:{profileId}});
  return json({configured,enabled:true,entitled:true,profileReady:true,profileId,accounts:(result.accounts||[]).map(a=>publicAccount(a,profileId)).filter(Boolean)});
 }catch{return json({error:'دریافت اطلاعات Zernio فعلاً ممکن نیست.',configured,enabled:true},503);}
}
export async function POST(request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'مبدأ درخواست معتبر نیست.'},403);
 const {user,entitled}=await userContext();
 if(!user)return json({error:'ابتدا وارد پنل شوید.'},401);
 if(!entitled)return json({error:'اشتراک فعال سیما لازم است.'},403);
 if(!enabled())return json({error:'اتصال Zernio هنوز برای دلسا فعال نشده است.'},503);
 let body;try{body=await request.json();}catch{return json({error:'درخواست معتبر نیست.'},400);}
 if(body?.action!=='prepare'&&body?.action!=='connect')return json({error:'درخواست معتبر نیست.'},400);
 if(body.action==='connect'&&!ZERNIO_PLATFORMS.includes(body.platform))return json({error:'این پلتفرم هنوز آمادهٔ اتصال نیست.'},400);
 try{
  const profileId=await provisionProfile(user.id);
  if(body.action==='prepare')return json({ok:true,profileReady:true,profileId});
  const redirectUrl=new URL('/dashboard?tab=crm',new URL(request.url).origin).toString();
  const scopes='messaging,comments';
  const result=await zernioRequest('GET',`/v1/connect/${body.platform}`,{query:{profileId,redirect_url:redirectUrl,scopes}});
  const url=new URL(result.authUrl);
  if(url.protocol!=='https:'||!url.hostname||url.username||url.password)throw new Error('ZERNIO_AUTH_URL_INVALID');
  return json({url:url.toString()});
 }catch{return json({error:'آماده‌سازی اتصال انجام نشد. وضعیت تنظیمات Zernio و دیتابیس را بررسی کنید.'},503);}
}

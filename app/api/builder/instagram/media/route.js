import {NextResponse} from 'next/server';
import {createClient} from '../../../../../lib/supabase/server';
import {seal,unseal,serverDatabase} from '../../../../../lib/crm/instagram';
import {fetchMediaPage,refreshToken,needsRefresh,InstagramError,errorMessages} from '../../../../../lib/builder-instagram';
import {graphOrigin,isUuid} from '../../../../../lib/builder-instagram-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(value,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store, private'}});
const status={instagram_token_invalid:401,instagram_permission:403,instagram_rate_limited:429,instagram_unavailable:502};

// GET /api/builder/instagram/media?account=<row id>&kind=posts|stories&after=<cursor>
// Reads one page of the signed-in customer's own media. Nothing is stored here.
export async function GET(request){
 const q=new URL(request.url).searchParams,id=q.get('account'),kind=q.get('kind')==='stories'?'stories':'posts';
 if(!isUuid(id))return json({error:'invalid'},400);
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)return json({error:'unauthorized'},401);
 const access=await db.rpc('has_site_builder_access');
 if(access.error||!access.data)return json({error:'store_access_denied',message:errorMessages.store_access_denied},403);
 // RLS: only the owner's own accounts are visible.
 const {data:row}=await db.from('builder_instagram_accounts').select('id,username,status').eq('id',id).maybeSingle();
 if(!row)return json({error:'not_found'},404);
 if(row.status!=='connected')return json({error:'instagram_token_invalid',message:errorMessages.instagram_token_invalid},401);
 const svc=serverDatabase();
 const expire=()=>svc.rpc('builder_instagram_mark_expired',{p_owner:user.id,p_id:id}).then(()=>{},()=>{});
 let rec,token;
 try{
  const r=await svc.rpc('builder_instagram_token',{p_owner:user.id,p_id:id});if(r.error)throw r.error;
  rec=r.data?.[0];if(!rec)return json({error:'instagram_token_invalid',message:errorMessages.instagram_token_invalid},401);
  token=unseal(rec.ciphertext);
 }catch{return json({error:'unavailable',message:errorMessages.instagram_unavailable},503)}
 const origin=graphOrigin();
 if(needsRefresh(rec.expires_at)){
  try{
   const fresh=await refreshToken({token,origin});
   const stored=await svc.rpc('builder_instagram_store_token',{p_owner:user.id,p_id:id,p_ciphertext:seal(fresh.token),p_expires:fresh.expires});
   if(!stored.error&&stored.data)token=fresh.token;
  }catch(e){
   // A failed renewal only matters once the token has really expired.
   if(Date.parse(rec.expires_at)<=Date.now()){await expire();return json({error:'instagram_token_invalid',message:errorMessages.instagram_token_invalid},401)}
  }
 }
 try{
  const page=await fetchMediaPage({token,account:rec.account_id,kind,after:q.get('after')||'',origin});
  return json({...page,account:{id,username:row.username}});
 }catch(e){
  const code=e instanceof InstagramError?e.code:'instagram_unavailable';
  if(code==='instagram_token_invalid')await expire();
  return json({error:code,message:errorMessages[code]},status[code]||502);
 }
}

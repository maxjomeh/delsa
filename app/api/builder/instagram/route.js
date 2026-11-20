import {NextResponse} from 'next/server';
import {randomBytes} from 'node:crypto';
import {createClient} from '../../../../lib/supabase/server';
import {instagramAuthorization,seal,serverDatabase} from '../../../../lib/crm/instagram';
import {BUILDER_SCOPE,errorMessages} from '../../../../lib/builder-instagram';
import {builderInstagramConfiguration,isUuid,missingObject} from '../../../../lib/builder-instagram-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(value,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store, private'}});

// GET  -> {configured, installed, accounts:[{id,username,status,expires_at}]}  (tokens never leave the server)
// POST {action:'connect'} -> {url} to Instagram's login; {action:'disconnect', id} -> {ok:true}
export async function GET(request){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)return json({error:'unauthorized'},401);
 const configured=builderInstagramConfiguration(new URL(request.url).origin).ready;
 const {data,error}=await db.from('builder_instagram_accounts').select('id,username,status,expires_at,connected_at').neq('status','disconnected').order('connected_at',{ascending:false});
 if(error)return missingObject(error)?json({configured,installed:false,accounts:[]}):json({error:'unavailable'},503);
 return json({configured,installed:true,accounts:data||[]});
}
export async function POST(request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'forbidden'},403);
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)return json({error:'unauthorized'},401);
 let body;try{body=await request.json()}catch{return json({error:'invalid'},400)}
 const access=await db.rpc('has_site_builder_access');
 if(access.error||!access.data)return json({error:'store_access_denied',message:errorMessages.store_access_denied},403);
 if(body.action==='disconnect'){
  if(!isUuid(body.id))return json({error:'invalid'},400);
  const {data}=await db.from('builder_instagram_accounts').select('id').eq('id',body.id).maybeSingle();
  if(!data)return json({error:'not_found'},404);
  try{const r=await serverDatabase().rpc('builder_disconnect_instagram',{p_owner:user.id,p_id:body.id});if(r.error)throw r.error;return json({ok:true})}catch{return json({error:'unavailable'},503)}
 }
 if(body.action!=='connect')return json({error:'invalid'},400);
 if(!builderInstagramConfiguration(new URL(request.url).origin).ready)return json({error:'not_configured',message:errorMessages.not_configured},503);
 const nonce=randomBytes(32).toString('base64url');
 const response=json({url:instagramAuthorization(nonce,BUILDER_SCOPE)});
 // Same cookie name/path as the CRM connector (the redirect URI is registered once); `purpose` routes the callback.
 response.cookies.set('sima_instagram_state',seal(JSON.stringify({nonce,userId:user.id,purpose:'builder',expires:Date.now()+600000})),{httpOnly:true,secure:true,sameSite:'lax',maxAge:600,path:'/api/crm/instagram'});
 return response;
}

import {NextResponse} from 'next/server';
import {createClient} from '../../../../../lib/supabase/server';
import {instagramConfiguration,unseal,seal,exchangeInstagramCode,serverDatabase} from '../../../../../lib/crm/instagram';
import {builderInstagramConfiguration} from '../../../../../lib/builder-instagram-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
// One Instagram redirect URI serves two products: the CRM connector (default) and the site builder (state.purpose==='builder').
export async function GET(request){
 const url=new URL(request.url);
 let builder=false;
 function finish(result){
  const target=new URL(builder?'/dashboard/builder':'/dashboard',url.origin);
  target.search=new URLSearchParams(builder?{instagram:result}:{tab:'crm',sima_connection:result}).toString();
  const response=NextResponse.redirect(target);response.cookies.set('sima_instagram_state','',{httpOnly:true,secure:true,sameSite:'lax',maxAge:0,path:'/api/crm/instagram'});response.headers.set('Cache-Control','no-store, private');return response;
 }
 try{
  const db=await createClient(),{data:{user}}=await db.auth.getUser();
  const state=user?JSON.parse(unseal(request.cookies.get('sima_instagram_state')?.value||'')):null;
  builder=state?.purpose==='builder';
  if(!(builder?builderInstagramConfiguration(url.origin):instagramConfiguration(url.origin)).ready)return finish('unconfigured');
  if(!user)return finish('login_required');
  if(state.userId!==user.id||state.expires<Date.now()||typeof state.nonce!=='string'||state.nonce!==url.searchParams.get('state'))return finish('invalid_state');
  if(url.searchParams.has('error'))return finish('cancelled');
  const code=url.searchParams.get('code');if(!code||code.length>2000)return finish('invalid_state');
  if(builder){
   // Needs site-builder access (not a CRM subscription); no message webhook; tokens stay separate from the CRM's.
   const access=await db.rpc('has_site_builder_access');if(access.error||!access.data)return finish('access_required');
   const own=await exchangeInstagramCode(code,{subscribe:false});
   const saved=await serverDatabase().rpc('builder_connect_instagram',{p_owner:user.id,p_account:own.account,p_username:own.username,p_ciphertext:seal(own.token),p_expires:own.expires});
   return finish(saved.error?(String(saved.error.message||'').includes('builder_instagram_limit')?'limit':'failed'):'connected');
  }
  const active=await db.rpc('has_active_crm');if(active.error||!active.data)return finish('subscription_required');
  const account=await exchangeInstagramCode(code);
  const r=await serverDatabase().rpc('crm_connect_instagram',{p_tenant:user.id,p_account:account.account,p_username:account.username,p_ciphertext:seal(account.token),p_expires:account.expires});
  if(r.error)return finish('failed');return finish('connected');
 }catch{return finish('failed');}
}

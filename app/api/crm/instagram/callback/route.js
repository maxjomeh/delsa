import {NextResponse} from 'next/server';
import {createClient} from '../../../../../lib/supabase/server';
import {instagramConfiguration,unseal,seal,exchangeInstagramCode,serverDatabase} from '../../../../../lib/crm/instagram';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request){
 const url=new URL(request.url);
 function finish(result){const target=new URL('/dashboard',url.origin);target.search=new URLSearchParams({tab:'crm',sima_connection:result}).toString();const response=NextResponse.redirect(target);response.cookies.set('sima_instagram_state','',{httpOnly:true,secure:true,sameSite:'lax',maxAge:0,path:'/api/crm/instagram'});response.headers.set('Cache-Control','no-store, private');return response;}
 try{
  if(!instagramConfiguration(url.origin).ready)return finish('unconfigured');
  const db=await createClient(),{data:{user}}=await db.auth.getUser();if(!user)return finish('login_required');
  const state=JSON.parse(unseal(request.cookies.get('sima_instagram_state')?.value||''));
  if(state.userId!==user.id||state.expires<Date.now()||typeof state.nonce!=='string'||state.nonce!==url.searchParams.get('state'))return finish('invalid_state');
  if(url.searchParams.has('error'))return finish('cancelled');
  const code=url.searchParams.get('code');if(!code||code.length>2000)return finish('invalid_state');
  const active=await db.rpc('has_active_crm');if(active.error||!active.data)return finish('subscription_required');
  const account=await exchangeInstagramCode(code);
  const r=await serverDatabase().rpc('crm_connect_instagram',{p_tenant:user.id,p_account:account.account,p_username:account.username,p_ciphertext:seal(account.token),p_expires:account.expires});
  if(r.error)return finish('failed');return finish('connected');
 }catch{return finish('failed');}
}

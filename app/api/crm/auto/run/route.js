import {NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {serverDatabase} from '../../../../../lib/crm/instagram';
import {publicAccount,profileIdValid,zernioRequest} from '../../../../../lib/crm/zernio.mjs';
import {autoMode} from '../../../../../lib/crm/auto-answer.mjs';
import {runAutoAnswers} from '../../../../../lib/crm/auto-runner.mjs';
// Scheduled runner for automatic replies. Nothing happens unless ALL of these hold: a valid cron secret, the server mode
// CIMA_AUTO_MODE is 'dry_run' or 'live' (default OFF), the tenant has switched automatic replies on and not paused them,
// and a topic is in stage 'auto'. It is NOT scheduled by this repository: whoever operates the deployment decides when
// (and whether) to call it. Responses never include message text.
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const reply=(body,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
const permitted=request=>{
 const secret=process.env.CIMA_AUTO_CRON_SECRET||'';
 const candidate=request.headers.get('authorization')||'';
 if(secret.length<32||!candidate.startsWith('Bearer '))return false;
 const a=Buffer.from(secret),b=Buffer.from(candidate.slice(7));
 return a.length===b.length&&timingSafeEqual(a,b);
};
// The sender must belong to this tenant AND be connected right now (same check as the human send path).
async function senderConnected(db,tenantId,accountId){
 const {data:profile,error}=await db.from('crm_zernio_profiles').select('profile_id').eq('tenant_id',tenantId).maybeSingle();
 if(error||!profileIdValid(profile?.profile_id))return false;
 try{
  const result=await zernioRequest('GET','/v1/accounts',{query:{profileId:profile.profile_id}});
  return (result.accounts||[]).map(item=>publicAccount(item,profile.profile_id)).some(item=>item?.id===accountId&&item.platform==='instagram'&&item.connected);
 }catch{return false;}
}
async function handle(request){
 if(!permitted(request))return reply({error:'unauthorized'},401);
 const mode=autoMode();
 if(mode==='off')return reply({mode,skipped:'mode_off'});
 if(mode==='live'&&(process.env.ZERNIO_CONNECT_ENABLED!=='true'||!process.env.ZERNIO_API_KEY))return reply({mode,skipped:'channel_not_configured'});
 const db=serverDatabase();
 const {data:tenants,error}=await db.from('sima_autonomy_settings').select('tenant_id').eq('auto_enabled',true).order('tenant_id',{ascending:true}).limit(50);
 if(error)return reply({error:'tenants_unavailable'},503);
 const started=Date.now(),results=[];
 for(const {tenant_id:tenantId} of tenants||[]){
  if(Date.now()-started>45000)break;
  try{
   results.push(await runAutoAnswers({db,tenantId,mode,limit:5,request:zernioRequest,verifySender:(tenant,account)=>senderConnected(db,tenant,account)}));
  }catch{results.push({tenantId,mode,skipped:'run_failed'});}
 }
 return reply({mode,tenants:results});
}
export const GET=handle;
export const POST=handle;

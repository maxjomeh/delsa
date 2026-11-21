import {NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {createClient} from '../../../../../lib/supabase/server';
import {seal,unseal,serverDatabase} from '../../../../../lib/crm/instagram';
import {InstagramError,errorMessages} from '../../../../../lib/builder-instagram';
import {syncAccount,MIN_USER_GAP_MS} from '../../../../../lib/builder-instagram-sync';
import {graphOrigin,isUuid,missingObject} from '../../../../../lib/builder-instagram-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const json=(value,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store, private'}});
const status={instagram_token_invalid:401,instagram_permission:403,instagram_rate_limited:429,instagram_unavailable:502};
const secretOk=(header)=>{
 const secret=process.env.BUILDER_INSTAGRAM_CRON_SECRET||'';
 const given=String(header||'').replace(/^Bearer\s+/i,'');
 if(secret.length<24||!given)return false;
 const a=Buffer.from(given),b=Buffer.from(secret);
 return a.length===b.length&&timingSafeEqual(a,b);
};

// GET: scheduled run (Authorization: Bearer BUILDER_INSTAGRAM_CRON_SECRET). Walks the accounts whose last check is older than ~6 hours
// and stops before the function time limit. Never creates or changes a product; only fills the suggestions inbox and change notices.
export async function GET(request){
 if(!process.env.BUILDER_INSTAGRAM_CRON_SECRET)return json({error:'not_configured'},503);
 if(!secretOk(request.headers.get('authorization')))return json({error:'unauthorized'},401);
 const svc=serverDatabase(),origin=graphOrigin(),started=Date.now();
 const due=await svc.rpc('builder_instagram_due_accounts',{p_limit:20});
 if(due.error)return missingObject(due.error)?json({ok:true,installed:false,accounts:0}):json({error:'unavailable'},503);
 const totals={accounts:0,suggested:0,changed:0,deleted:0,failed:0};
 for(const row of due.data||[]){
  if(Date.now()-started>45000)break;
  try{
   const r=await syncAccount({svc,userId:row.owner_id,accountRow:row.id,origin,seal,unseal});
   totals.accounts++;totals.suggested+=r.suggested;totals.changed+=r.changed;totals.deleted+=r.deleted;
  }catch(e){
   totals.failed++;
   // Instagram asked us to slow down: stop the whole run instead of hammering the API for the other accounts.
   if(e instanceof InstagramError&&e.code==='instagram_rate_limited')break;
  }
 }
 return json({ok:true,...totals});
}

// POST {account} -> checks one of the signed-in customer's own accounts now (at most once per 10 minutes) and returns the counts.
// POST {action:'dismiss', account, ids:[Instagram media ids]} -> hides suggestions the customer does not want.
export async function POST(request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'forbidden'},403);
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)return json({error:'unauthorized'},401);
 let body;try{body=await request.json()}catch{return json({error:'invalid'},400)}
 const access=await db.rpc('has_site_builder_access');
 if(access.error||!access.data)return json({error:'store_access_denied',message:errorMessages.store_access_denied},403);
 if(body.action==='dismiss'){
  const ids=Array.isArray(body.ids)?body.ids.map(String):[];
  if(!isUuid(body.account)||!ids.length||ids.length>100||!ids.every(i=>/^[0-9]{1,40}$/.test(i)))return json({error:'invalid'},400);
  // RLS + column grant: only the owner's own rows, only the status column, only new -> dismissed.
  const {error}=await db.from('builder_instagram_suggestions').update({status:'dismissed'}).eq('account_row',body.account).in('media_id',ids).eq('status','new');
  return error?json({error:'unavailable'},503):json({ok:true});
 }
 if(!isUuid(body.account))return json({error:'invalid'},400);
 const {data:row,error}=await db.from('builder_instagram_accounts').select('id,status,last_checked_at').eq('id',body.account).maybeSingle();
 if(error&&missingObject(error))return json({error:'unavailable'},503);
 if(!row)return json({error:'not_found'},404);
 if(row.status!=='connected')return json({error:'instagram_token_invalid',message:errorMessages.instagram_token_invalid},401);
 const last=Date.parse(row.last_checked_at||'');
 if(Number.isFinite(last)&&Date.now()-last<MIN_USER_GAP_MS)return json({skipped:true,suggested:0,changed:0,deleted:0});
 try{
  const r=await syncAccount({svc:serverDatabase(),userId:user.id,accountRow:row.id,origin:graphOrigin(),seal,unseal});
  return json(r);
 }catch(e){
  const code=e instanceof InstagramError?e.code:'instagram_unavailable';
  return json({error:code,message:errorMessages[code]||errorMessages.instagram_unavailable},status[code]||502);
 }
}

import {NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {serverDatabase} from '../../../../../../lib/crm/instagram';
import {nextHistoryPage} from '../../../../../../lib/crm/zernio-history.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const api=(data,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
const permitted=request=>{
 const secret=process.env.SIMA_HISTORY_CRON_SECRET;
 const candidate=request.headers.get('authorization')||'';
 if(!secret||!candidate.startsWith('Bearer '))return false;
 const a=Buffer.from(secret),b=Buffer.from(candidate.slice(7));
 return a.length===b.length&&timingSafeEqual(a,b);
};
async function bootstrap(db){
 const {data,error}=await db.from('crm_zernio_events').select('tenant_id,profile_id,account_id,payload')
  .in('event_type',['account.connected','message.received']).order('received_at',{ascending:false}).limit(3000);
 if(error)throw error;
 const unique=new Map();
 for(const e of data){
  if(!e.account_id||!/^[a-f0-9]{24}$/i.test(e.account_id))continue;
  const platform=e.payload?.account?.platform;
  if(!['instagram','facebook'].includes(platform))continue;
  const k=e.tenant_id+':'+e.account_id;if(!unique.has(k))unique.set(k,e);
 }
 const {data:jobs,error:jobsError}=await db.from('crm_zernio_history_jobs').select('tenant_id,account_id,status,completed_at,started_at,last_run_at,errors').limit(1000);
 if(jobsError)throw jobsError;
 const current=new Map(jobs.map(j=>[j.tenant_id+':'+j.account_id,j]));
 let added=0;
 for(const [key,e] of unique){
  const existing=current.get(key);
  if(!existing){
   const {error:writeError}=await db.from('crm_zernio_history_jobs').upsert({tenant_id:e.tenant_id,profile_id:e.profile_id,account_id:e.account_id},{onConflict:'tenant_id,account_id',ignoreDuplicates:true});
   if(!writeError)added++;
  }else if(existing.status==='complete'&&existing.completed_at&&Date.now()-Date.parse(existing.completed_at)>12*3600000&&Date.now()-Date.parse(existing.started_at)<7*86400000){
   // Meta history replays can be delayed; repeat sweep during first week.
   await db.from('crm_zernio_history_jobs').update({status:'queued',conversation_cursor:null,conversation_queue:[],queue_index:0,current_conversation:null,current_participant:{},message_cursor:null,next_conversation_cursor:null,completed_conversations:0,imported_messages:0,completed_at:null}).eq('tenant_id',e.tenant_id).eq('account_id',e.account_id).eq('status','complete');
  }else if(existing.status==='error'&&existing.errors<5&&(!existing.last_run_at||Date.now()-Date.parse(existing.last_run_at)>30*60000)){
   await db.from('crm_zernio_history_jobs').update({status:'queued',last_error_code:null}).eq('tenant_id',e.tenant_id).eq('account_id',e.account_id).eq('status','error');
  }
 }
 return added;
}
export async function GET(request){
 if(!permitted(request))return new Response('Unauthorized',{status:401});
 const db=serverDatabase();let done=0,inserted=0,failed=0;
 try{
  const added=await bootstrap(db);
  for(let i=0;i<4;i++){
   const {data:job,error}=await db.rpc('crm_zernio_claim_next_history_job');
   if(error)throw error;
   if(!job)break;
   try{
    const result=await nextHistoryPage(job);
    if(result.events?.length){
     const write=await db.from('crm_zernio_events').upsert(result.events,{onConflict:'event_id',ignoreDuplicates:true});
     if(write.error)throw write.error;
     inserted+=result.events.length;
    }
    const patch={...result.patch,...(!result.patch?result:{}),lease_token:null,lease_until:null,last_error_code:null};
    const {error:saveError}=await db.from('crm_zernio_history_jobs').update(patch).eq('tenant_id',job.tenant_id).eq('account_id',job.account_id).eq('lease_token',job.lease_token);
    if(saveError)throw saveError;
    done++;
   }catch(e){
    const code=typeof e?.code==='string'&&e.code.length<70?e.code:'HISTORY_WORKER_FAILED';
    await db.from('crm_zernio_history_jobs').update({status:'error',errors:job.errors+1,last_error_code:code,last_run_at:new Date().toISOString(),lease_token:null,lease_until:null}).eq('tenant_id',job.tenant_id).eq('account_id',job.account_id).eq('lease_token',job.lease_token);
    failed++;break;
   }
  }
  if(inserted){const {error}=await db.rpc('crm_zernio_process_batch',{p_limit:160});if(error)console.error('SIMA Zernio ingestion queue pending',{code:error.code});}
  return api({ok:true,accountsAdded:added,steps:done,queuedMessages:inserted,workerErrors:failed});
 }catch{return api({error:'history_worker_unavailable'},503);}
}

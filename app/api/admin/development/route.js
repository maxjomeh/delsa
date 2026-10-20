import {NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {serverDatabase} from '../../../../lib/crm/instagram';
import {AUDIT_DATE,BASELINE_SHA,PHASES,productSummary,phaseSummary,applyVerifiedRelease} from '../../../../lib/development/progress.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=30;
const REPO='maxjomeh/delsa';
const json=(data,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const validCode=x=>typeof x==='string'&&/^[a-z0-9_]{2,60}$/.test(x);
const validSha=x=>typeof x==='string'&&/^[0-9a-f]{40}$/.test(x);
const validScore=x=>Number.isInteger(x)&&x>=0&&x<=100;
const pathValid=x=>typeof x==='string'&&x.length<=200&&/^(app|components|lib|tests|supabase|docs)\/[a-zA-Z0-9_./-]+$/.test(x)&&!x.includes('..');
async function admin(){
 const auth=await createClient();
 const {data:{user},error}=await auth.auth.getUser();
 if(error||!user)return {status:401};
 const {data:profile,error:roleError}=await auth.from('profiles').select('role').eq('id',user.id).maybeSingle();
 if(roleError||profile?.role!=='admin')return {status:403};
 return {userId:user.id};
}
function activeSha(){
 // A Preview promoted without Production build/configuration is not proof of a production release.
 return process.env.VERCEL_ENV==='production'&&validSha(process.env.VERCEL_GIT_COMMIT_SHA)?
   process.env.VERCEL_GIT_COMMIT_SHA:null;
}
async function github(path){
 const headers={'Accept':'application/vnd.github+json','User-Agent':'delsa-development-progress'};
 if(process.env.GITHUB_PROGRESS_TOKEN)headers.Authorization='Bearer '+process.env.GITHUB_PROGRESS_TOKEN;
 const res=await fetch('https://api.github.com/repos/'+REPO+'/'+path,{headers,signal:AbortSignal.timeout(12000),next:{revalidate:300}});
 if(!res.ok)throw Error('github_'+res.status);
 return res.json();
}
async function releasedEvidence(sha){
 const output={productionSha:sha,ciState:'unknown',ciPassed:false,comparisonComplete:false,changedPaths:[],treePaths:[],status:'missing_evidence'};
 if(!sha)return output;
 if(sha===BASELINE_SHA){output.status='baseline';return output;}
 const [comparison,tree,actions]=await Promise.allSettled([
  github('compare/'+BASELINE_SHA+'...'+sha),
  github('git/trees/'+sha+'?recursive=1'),
  github('actions/runs?head_sha='+sha+'&per_page=30')
 ]);
 if(comparison.status==='fulfilled'){
  const c=comparison.value;
  output.changedPaths=(c.files||[]).map(x=>x.filename).filter(pathValid);
  output.comparisonComplete=['ahead','identical'].includes(c.status)&&Array.isArray(c.files)&&c.files.length<300;
 }
 if(tree.status==='fulfilled'&&tree.value.truncated!==true&&Array.isArray(tree.value.tree)){
  output.treePaths=tree.value.tree.filter(x=>x.type==='blob').map(x=>x.path).filter(pathValid);
 }else output.comparisonComplete=false;
 if(actions.status==='fulfilled'){
  const runs=(actions.value.workflow_runs||[]).filter(x=>x.head_sha===sha&&!x.name?.toLowerCase().includes('dependabot'));
  if(runs.length){
   output.ciState=runs.some(x=>x.conclusion==='failure'||x.conclusion==='cancelled')?'failed':
    runs.every(x=>x.status==='completed'&&x.conclusion==='success')?'passed':'pending';
  }
 }
 output.ciPassed=output.ciState==='passed';
 output.status=output.comparisonComplete?(output.ciPassed?'verified_ci_and_release':'ci_not_verified'):'evidence_incomplete';
 return output;
}
async function portfolio(db,refresh=false){
 const sha=activeSha();
 const [productsResponse,customResponse,reviewsResponse,snapshotResponse]=await Promise.all([
  db.from('store_products').select('id,name,service_code,is_published').order('created_at',{ascending:true}).limit(100),
  db.from('development_custom_features').select('*').order('created_at',{ascending:true}).limit(1000),
  db.from('development_feature_reviews').select('feature_id,implementation,readiness,notes,reviewed_at').limit(500),
  sha?db.from('development_release_snapshots').select('commit_sha,ci_state,comparison_complete,changed_paths,tree_paths,evidence_status,checked_at').eq('product_code','cima').eq('commit_sha',sha).eq('environment','production').maybeSingle():Promise.resolve({data:null,error:null})
 ]);
 if(productsResponse.error||customResponse.error||reviewsResponse.error||snapshotResponse.error)throw Error('database_unavailable');
 const stored=snapshotResponse.data;
 const evidence=refresh?await releasedEvidence(sha):{
  productionSha:sha,ciState:stored?.ci_state||'unknown',ciPassed:stored?.ci_state==='passed',
  comparisonComplete:stored?.comparison_complete===true,changedPaths:stored?.changed_paths||[],
  treePaths:stored?.tree_paths||[],status:stored?.evidence_status||'not_checked',
  checkedAt:stored?.checked_at||null
 };
 if(refresh&&sha){
  const {error}=await db.from('development_release_snapshots').upsert({
   product_code:'cima',commit_sha:sha,environment:'production',
   ci_state:evidence.ciState,comparison_complete:evidence.comparisonComplete,
   changed_paths:evidence.changedPaths,tree_paths:evidence.treePaths,
   evidence_status:evidence.status,checked_at:new Date().toISOString()
  },{onConflict:'product_code,commit_sha,environment'});
  if(error)throw Error('snapshot_write_failed');
  evidence.checkedAt=new Date().toISOString();
 }
 const reviews=new Map((reviewsResponse.data||[]).map(x=>[x.feature_id,x]));
 const audited=PHASES.map(phase=>({...phase,features:phase.features.map(f=>{
  const override=reviews.get(f.id);
  return override?{...f,implementation:override.implementation,readiness:override.readiness,
   reviewedAt:override.reviewed_at,reviewNote:override.notes}:f;
 })}));
 const baseline=productSummary(audited);
 const auto=applyVerifiedRelease(audited,evidence);
 const cimaPhases=auto.phases.map(phase=>({...phase,...phaseSummary(phase),features:phase.features.map(f=>({...f,score:+(0.45*f.implementation+0.55*f.readiness).toFixed(1)}))}));
 const services=[...(productsResponse.data||[])];
 if(!services.some(x=>x.service_code==='crm'))services.unshift({id:'cima-core',name:'سیما — CIMA Intelligence',service_code:'crm',is_published:false});
 const products=services.map((p,i)=>{
  const code=p.service_code==='crm'?'cima':validCode(p.service_code)?p.service_code:'store_'+String(p.id).replaceAll('-','').slice(0,12);
  if(code==='cima')return {code,name:p.name,published:p.is_published,tracked:true,phases:cimaPhases,
    totals:productSummary(cimaPhases),auditedBaseline:baseline,autoPromotions:auto.promotions,
    auditDate:AUDIT_DATE};
  const rows=(customResponse.data||[]).filter(r=>r.product_code===code);
  const phases=[...new Map(rows.map(r=>[r.phase_key,r.phase_title]))].map(([key,title])=>{
   const items=rows.filter(r=>r.phase_key===key);
   const total=items.reduce((v,r)=>v+Number(r.weight),0)||1;
   const features=items.map(r=>{
    const sourcePresent=r.source_paths.length>0&&r.source_paths.every(x=>evidence.treePaths.includes(x));
    const touched=r.source_paths.some(x=>evidence.changedPaths.includes(x));
    const testPresent=r.test_paths.some(x=>evidence.treePaths.includes(x));
    const verified=!!sha&&sha!==BASELINE_SHA&&evidence.comparisonComplete&&evidence.ciPassed&&sourcePresent&&touched&&testPresent;
    const impl=verified?Math.min(95,r.implementation+5):r.implementation;
    const ready=verified?Math.min(80,r.readiness+3):r.readiness;
    return {id:r.id,label:r.label,weight:100*Number(r.weight)/total,implementation:impl,readiness:ready,
     score:+(0.45*impl+0.55*ready).toFixed(1),sourcePaths:r.source_paths,testPaths:r.test_paths,
     autoVerified:verified,notes:r.notes};
   });
   const phaseWeight=Number(items[0].phase_weight);
   return {number:key,key,name:title,weight:phaseWeight,features,...phaseSummary({features})};
  });
  return {code,name:p.name,published:p.is_published,tracked:phases.length>0,phases,
   totals:phases.length?productSummary(phases):null,auditedBaseline:null,autoPromotions:phases.flatMap(x=>x.features).filter(x=>x.autoVerified).length,auditDate:null};
 });
 return {products,evidence:{productionSha:evidence.productionSha,ciState:evidence.ciState,
  comparisonComplete:evidence.comparisonComplete,status:evidence.status,checkedAt:evidence.checkedAt||null,
  changedCount:evidence.changedPaths.length},baselineSha:BASELINE_SHA,method:'45% implementation + 55% operational readiness; CI evidence gives only bounded credit'};
}
export async function GET(){
 const ctx=await admin();if(!ctx.userId)return json({error:'admin_access_required'},ctx.status);
 try{return json(await portfolio(serverDatabase()));}catch{return json({error:'development_dashboard_unavailable'},503);}
}
export async function POST(request){
 const ctx=await admin();if(!ctx.userId)return json({error:'admin_access_required'},ctx.status);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'invalid_origin'},403);
 let body;try{body=await request.json();}catch{return json({error:'invalid_json'},400);}
 const db=serverDatabase();
 if(body?.action==='sync'){
  try{return json(await portfolio(db,true));}catch{return json({error:'sync_unavailable_keep_previous_evidence'},503);}
 }
 if(body?.action==='review_cima'){
  if(!/^p[0-6]f[0-9]{1,3}$/.test(body.id||'')||
   !PHASES.some(p=>p.features.some(f=>f.id===body.id))||!validScore(body.implementation)||!validScore(body.readiness)||
   typeof body.notes!=='string'||body.notes.trim().length<8||body.notes.length>2000)return json({error:'invalid_audit_review'},400);
  const {error}=await db.from('development_feature_reviews').upsert({
   feature_id:body.id,implementation:body.implementation,readiness:body.readiness,
   notes:body.notes.trim(),reviewed_by:ctx.userId,reviewed_at:new Date().toISOString()
  },{onConflict:'feature_id'});
  if(error)return json({error:'review_save_failed'},503);
  return json({saved:true});
 }
 if(body?.action==='add_feature'){
  const pathList=x=>Array.isArray(x)&&x.length<=8&&x.every(pathValid);
  if(!validCode(body.productCode)||body.productCode==='cima'||
   !/^[a-z0-9_]{2,80}$/.test(body.phaseKey||'')||
   !/^[a-z0-9_]{2,80}$/.test(body.featureKey||'')||
   typeof body.phaseTitle!=='string'||!body.phaseTitle.trim()||body.phaseTitle.length>160||
   typeof body.label!=='string'||!body.label.trim()||body.label.length>240||
   !Number.isFinite(body.phaseWeight)||body.phaseWeight<=0||body.phaseWeight>100||
   !Number.isFinite(body.weight)||body.weight<=0||body.weight>100||
   !pathList(body.sourcePaths)||!pathList(body.testPaths))return json({error:'invalid_roadmap_feature'},400);
  const known=await db.from('store_products').select('id,service_code').eq('service_code',body.productCode).limit(1);
  if(known.error||!known.data?.length)return json({error:'product_not_found'},404);
  const row={product_code:body.productCode,phase_key:body.phaseKey,phase_title:body.phaseTitle.trim(),
   feature_key:body.featureKey,label:body.label.trim(),phase_weight:body.phaseWeight,weight:body.weight,
   source_paths:body.sourcePaths,test_paths:body.testPaths,updated_by:ctx.userId};
  const {error}=await db.from('development_custom_features').insert(row);
  if(error)return json({error:error.code==='23505'?'feature_already_exists':'feature_create_failed'},error.code==='23505'?409:503);
  return json({saved:true});
 }
 if(body?.action==='review_custom'){
  if(!validCode(body.productCode)||!/^[0-9a-f-]{36}$/i.test(body.id||'')||
   !validScore(body.implementation)||!validScore(body.readiness)||
   typeof body.notes!=='string'||body.notes.trim().length<8||body.notes.length>2000)return json({error:'invalid_review'},400);
  const {data,error}=await db.from('development_custom_features').update({
   implementation:body.implementation,readiness:body.readiness,notes:body.notes.trim(),
   updated_by:ctx.userId,updated_at:new Date().toISOString()
  }).eq('id',body.id).eq('product_code',body.productCode).select('id').maybeSingle();
  if(error||!data)return json({error:'feature_not_found'},404);
  return json({saved:true});
 }
 return json({error:'unknown_action'},400);
}
import {NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {serverDatabase} from '../../../../lib/crm/instagram';
import {STATUSES,SCOPES,WORKSTREAMS,TYPES,PRIORITIES,EVIDENCE_KINDS,valid,validTaskInput,validCriteria,validCodes,validURL,validSHA,isUuid,nonempty} from '../../../../lib/devos/contracts.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(x,status=200)=>NextResponse.json(x,{status,headers:{'Cache-Control':'private,no-store'}});
const safe=(x,max=2000)=>typeof x==='string'&&x.length<=max;
const validKey=x=>typeof x==='string'&&/^[A-Z0-9_-]{3,56}$/.test(x);
async function admin(){
 const client=await createClient();
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user)return {status:401};
 const {data:profile,error:e}=await client.from('profiles').select('role').eq('id',user.id).maybeSingle();
 return e||profile?.role!=='admin'?{status:403}:{id:user.id};
}
export async function GET(request){
 const access=await admin();if(!access.id)return json({error:'admin_required'},access.status);
 const p=new URL(request.url).searchParams;
 const product=p.get('product')||'',status=p.get('status')||'',sprintCode=p.get('sprint_code')||'',q=p.get('q')||'';
 const offset=Math.min(10000,Math.max(0,Number(p.get('offset'))||0));
 if(product&&product!=='platform'&&!/^[a-z0-9_]{2,60}$/.test(product)||status&&!valid(STATUSES,status)||sprintCode&&!validKey(sprintCode)||q.length>100)return json({error:'invalid_filter'},400);
 try{
  const db=serverDatabase();
  const sp=await db.from('devos_sprints').select('id,code,title,objective,scope,product_codes,state,acceptance_criteria,created_at').order('created_at',{ascending:false}).limit(100);
  if(sp.error)throw sp.error;
  let list=db.from('devos_tasks').select('id,task_key,title,description,scope,product_codes,workstream,task_type,priority,status,phase_ref,acceptance_criteria,blocker_reason,notes,revision,sprint_id,created_at,updated_at,closed_at',{count:'exact'}).order('updated_at',{ascending:false}).range(offset,offset+99);
  if(product==='platform')list=list.eq('scope','platform');else if(product)list=list.contains('product_codes',[product]);
  if(status)list=list.eq('status',status);
  if(sprintCode){
   const s=sp.data.find(x=>x.code===sprintCode);
   if(!s)return json({tasks:[],total:0,sprints:sp.data,evidence:[],dependencies:[],events:[],offset,limit:100});
   list=list.eq('sprint_id',s.id);
  }
  if(q)list=list.or('title.ilike.%'+q.replace(/[%_,()]/g,'')+'%,task_key.ilike.%'+q.replace(/[%_,()]/g,'')+'%');
  const tasks=await list;if(tasks.error)throw tasks.error;
  const ids=tasks.data.map(x=>x.id);
  let evidence=[],dependencies=[];
  if(ids.length){
   const [e,d]=await Promise.all([
    db.from('devos_evidence').select('id,task_id,kind,verdict,url,commit_sha,deployment_id,notes,created_at').in('task_id',ids).order('created_at',{ascending:false}).limit(500),
    db.from('devos_task_dependencies').select('task_id,depends_on_id').in('task_id',ids).limit(500)]);
   if(e.error||d.error)throw Error('evidence_fetch_failed');evidence=e.data;dependencies=d.data;
  }
  let events=[];
  if(isUuid(p.get('history'))){const h=await db.from('devos_task_events').select('id,task_id,action,actor_id,old_snapshot,new_snapshot,occurred_at').eq('task_id',p.get('history')).order('id',{ascending:false}).limit(60);if(!h.error)events=h.data;}
  return json({tasks:tasks.data,total:tasks.count||0,sprints:sp.data,evidence,dependencies,events,offset,limit:100});
 }catch{return json({error:'devos_unavailable'},503)}
}
export async function POST(request){
 const access=await admin();if(!access.id)return json({error:'admin_required'},access.status);
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'origin_mismatch'},403);
 let x;try{x=await request.json()}catch{return json({error:'invalid_json'},400)}
 if(!x||typeof x!=='object'||Array.isArray(x))return json({error:'invalid_body'},400);
 const db=serverDatabase(),actor=access.id;
 try{
  if(x.action==='create_sprint'){
   if(!validKey(x.code)||!nonempty(x.title,180)||!safe(x.objective||'',3000)||!valid(SCOPES,x.scope)||!validCodes(x.productCodes)||!validCriteria(x.acceptanceCriteria||[]))return json({error:'invalid_sprint'},400);
   const s=await db.from('devos_sprints').insert({code:x.code,title:x.title.trim(),objective:x.objective||'',scope:x.scope,product_codes:x.productCodes,state:'planned',acceptance_criteria:x.acceptanceCriteria||[]}).select('id,code').single();
   if(s.error)return json({error:s.error.code==='23505'?'sprint_exists':'save_failed'},s.error.code==='23505'?409:503);
   return json({saved:true,sprint:s.data},201);
  }
  if(x.action==='create_task'){
   if(!validTaskInput(x))return json({error:'invalid_task'},400);
   if(['released','verified'].includes(x.status))return json({error:'release_needs_evidence'},400);
   const d=await db.from('devos_tasks').insert({
    title:x.title.trim(),description:x.description||'',scope:x.scope,product_codes:x.productCodes,
    workstream:x.workstream,task_type:x.taskType,priority:x.priority,status:x.status,
    phase_ref:x.phaseRef||null,acceptance_criteria:x.acceptanceCriteria,sprint_id:x.sprintId||null,
    created_by:actor,updated_by:actor
   }).select('id,task_key').single();
   if(d.error)return json({error:'create_task_failed'},503);
   return json({saved:true,task:d.data},201);
  }
  if(x.action==='update_task'){
   if(!isUuid(x.id)||!Number.isInteger(x.revision)||x.revision<1||!x.patch||typeof x.patch!=='object'||Array.isArray(x.patch))return json({error:'invalid_patch'},400);
   const p=x.patch;
   if(p.title!==undefined&&(!nonempty(p.title,240)||p.title.trim().length<5)||
    p.description!==undefined&&!safe(p.description,8000)||p.notes!==undefined&&!safe(p.notes,8000)||
    p.blocker_reason!==undefined&&!safe(p.blocker_reason,2000)||
    p.priority!==undefined&&!valid(PRIORITIES,p.priority)||p.status!==undefined&&!valid(STATUSES,p.status)||
    p.scope!==undefined&&!valid(SCOPES,p.scope)||p.task_type!==undefined&&!valid(TYPES,p.task_type)||
    p.workstream!==undefined&&!valid(WORKSTREAMS,p.workstream)||
    p.product_codes!==undefined&&!validCodes(p.product_codes)||p.acceptance_criteria!==undefined&&!validCriteria(p.acceptance_criteria)||
    p.sprint_id!==undefined&&p.sprint_id!==null&&!isUuid(p.sprint_id)||
    p.phase_ref!==undefined&&p.phase_ref!==null&&p.phase_ref!==''&&!/^p[0-6]f[0-9]{1,3}$/.test(p.phase_ref))
    return json({error:'invalid_patch'},400);
   const d=await db.rpc('devos_patch_task',{p_task_id:x.id,p_expected_revision:x.revision,p_patch:p,p_actor:actor});
   if(d.error)return json({error:d.error.message?.slice(0,150)||'patch_failed'},d.error.message?.includes('revision_conflict')?409:422);
   return json({saved:true,task:d.data});
  }
  if(x.action==='add_dependency'){
   if(!isUuid(x.id)||!isUuid(x.dependsOnId))return json({error:'invalid_dependency'},400);
   const r=await db.rpc('devos_add_dependency',{p_task:x.id,p_parent:x.dependsOnId});
   return r.error?json({error:r.error.message?.slice(0,150)||'dependency_failed'},422):json({saved:true});
  }
  if(x.action==='add_evidence'){
   if(!isUuid(x.id)||!valid(EVIDENCE_KINDS,x.kind)||!['passed','failed','blocked','unknown'].includes(x.verdict)||
    !validURL(x.url)||!validSHA(x.commitSha)||!safe(x.deploymentId||'',120)||!safe(x.notes||'',2000))return json({error:'invalid_evidence'},400);
   const r=await db.from('devos_evidence').insert({task_id:x.id,kind:x.kind,verdict:x.verdict,url:x.url||null,commit_sha:x.commitSha||null,deployment_id:x.deploymentId||null,notes:x.notes||'',added_by:actor}).select('id').single();
   return r.error?json({error:'evidence_failed'},503):json({saved:true,evidence:r.data},201);
  }
  if(x.action==='sync_github'){
   const headers={Accept:'application/vnd.github+json','User-Agent':'delsa-devos'};
   if(process.env.GITHUB_PROGRESS_TOKEN)headers.Authorization='Bearer '+process.env.GITHUB_PROGRESS_TOKEN;
   const result=await fetch('https://api.github.com/repos/maxjomeh/delsa/pulls?state=all&per_page=100',{headers,signal:AbortSignal.timeout(12000),cache:'no-store'});
   if(!result.ok)return json({error:'github_unavailable',status:result.status},503);
   const prs=await result.json();if(!Array.isArray(prs))return json({error:'invalid_github_data'},503);
   const keys=[...new Set(prs.map(p=>String(p.title||'').match(/\b(?:CIMA-\d{3}|DEV-\d{6})\b/)?.[0]).filter(Boolean))];
   if(!keys.length)return json({saved:true,created:0,matched:0});
   const rows=await db.from('devos_tasks').select('id,task_key').in('task_key',keys).limit(100);
   if(rows.error)throw rows.error;
   const map=new Map(rows.data.map(t=>[t.task_key,t.id]));let created=0;
   const present=await db.from('devos_evidence').select('task_id,url').eq('kind','pr').in('task_id',Array.from(map.values())).limit(500);
   if(present.error)throw present.error;
   const seen=new Set(present.data.map(r=>r.task_id+'|'+r.url));
   for(const p of prs){
    const key=String(p.title||'').match(/\b(?:CIMA-\d{3}|DEV-\d{6})\b/)?.[0];
    if(!key||!map.has(key)||!/^https:\/\/github.com\/maxjomeh\/delsa\/pull\/\d+$/.test(p.html_url||''))continue;
    const dedup=map.get(key)+'|'+p.html_url;if(seen.has(dedup))continue;
    const r=await db.from('devos_evidence').insert({task_id:map.get(key),kind:'pr',verdict:'unknown',url:p.html_url,commit_sha:/^[0-9a-f]{40}$/.test(p.head?.sha||'')?p.head.sha:null,notes:'Linked PR; production acceptance NOT verified',added_by:actor});
    if(!r.error){seen.add(dedup);created++}
   }
   return json({saved:true,matched:map.size,created});
  }
  return json({error:'unknown_action'},400);
 }catch{return json({error:'request_failed'},503)}
}

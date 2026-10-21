// Deployment proof is a separate audited fact from execution % or operational readiness.
// Do not infer a release from Preview, CI, a branch name, or a task status alone.
export function productionEvidenceForTasks(tasks=[],evidence=[],activeSha=''){
 const results=new Map();
 if(typeof activeSha!=='string'||!/^[a-f0-9]{40}$/i.test(activeSha))return results;
 const owned=new Map(tasks.map(task=>[task.id,task]));
 for(const e of evidence){
  const t=owned.get(e.task_id);
  if(!t||!['released','verified'].includes(t.status))continue;
  if(e.kind!=='production_deployed'||e.verdict!=='passed'||e.commit_sha!==activeSha)continue;
  if(!results.has(t.id))results.set(t.id,e);
 }
 return results;
}

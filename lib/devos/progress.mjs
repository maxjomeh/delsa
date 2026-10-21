// Task execution progress is documented by humans, never inferred from status or CI.
export function validProgress(value){return value===null||(Number.isInteger(value)&&value>=0&&value<=100)}
export function progressByTask(tasks=[]){
 const byId=new Map(tasks.map(t=>[t.id,t]));
 const children=new Map(tasks.map(t=>[t.id,[]]));
 for(const t of tasks)if(t.parent_task_id&&children.has(t.parent_task_id))children.get(t.parent_task_id).push(t.id);
 const result=new Map(),processing=new Set();
 const score=id=>{
  if(result.has(id))return result.get(id);
  if(processing.has(id))return {value:null,assessed:0,leaves:0,cyclic:true};
  processing.add(id);
  const childIds=children.get(id)||[];
  let value,assessed,leaves;
  if(childIds.length){
   const entries=childIds.map(score);
   leaves=entries.reduce((s,e)=>s+e.leaves,0);
   assessed=entries.reduce((s,e)=>s+e.assessed,0);
   value=assessed&&leaves?Math.round(entries.reduce((s,e)=>s+(e.value??0)*e.leaves,0)/leaves):null;
  }else{
   const raw=byId.get(id)?.progress_percent;
   value=typeof raw==='number'&&validProgress(raw)?raw:null;
   assessed=value===null?0:1;
   leaves=1;
  }
  const output={value,assessed,leaves};
  result.set(id,output);processing.delete(id);return output;
 };
 for(const t of tasks)score(t.id);
 return result;
}
export function executionSummary(tasks=[],productCode=null){
 const subset=tasks.filter(t=>!productCode||t.product_codes?.includes(productCode));
 const present=new Set(subset.map(t=>t.id));
 const parents=new Set(subset.filter(t=>t.parent_task_id&&present.has(t.parent_task_id)).map(t=>t.parent_task_id));
 const leaves=subset.filter(t=>!parents.has(t.id));
 let assessed=0,total=0;
 for(const t of leaves)if(typeof t.progress_percent==='number'&&validProgress(t.progress_percent)){total+=t.progress_percent;assessed++}
 return {value:leaves.length?Math.round(total/leaves.length):null,assessed,total:leaves.length};
}
export function auditMetrics(products=[]){
 const entries=products.filter(p=>p.totals&&Number.isFinite(Number(p.totals.score)));
 const avg=k=>entries.length?Math.round(entries.reduce((s,p)=>s+Number(p.totals[k]??0),0)/entries.length):null;
 return {score:avg('score'),implementation:avg('implementation'),readiness:avg('readiness'),audited:entries.length};
}
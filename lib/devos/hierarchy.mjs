// DELSA DevOS: canonical presentation hierarchy. Roadmap progress and Backlog tasks
// retain their separate sources of truth; Sprint is a task attribute, NOT a tree.
const priority=t=>({P0:0,P1:1,P2:2,P3:3})[t?.priority]??4;
const taskSort=(a,b)=>priority(a.task)-priority(b.task)||String(a.task?.task_key||'').localeCompare(String(b.task?.task_key||''));
const make=(kind,key,label,data={},children=[])=>({kind,key,label,data,children});
export function buildDevelopmentHierarchy(products=[],tasks=[]){
 const root=make('root','root:delsa','دلسا · نمای یکپارچهٔ توسعه');
 const platform=make('area','area:platform','هسته، زیرساخت و توسعه‌های عمومی',{scope:'platform'});
 const cross=make('area','area:cross_product','توسعه‌های مشترک بین محصولات',{scope:'cross_product'});
 const productsByCode=new Map(),featuresByCode=new Map(),phasesByCode=new Map(),taskNodes=new Map();
 for(const p of products){
  const product=make('product','product:'+p.code,p.name,{product:p});
  productsByCode.set(p.code,product);
  for(const phase of p.phases||[]){
   const id=String(phase.key||'p'+phase.number);
   const ph=make('phase',p.code+':phase:'+id,phase.name,{phase,product:p});
   product.children.push(ph);
   phasesByCode.set(p.code+':'+id,ph);
   for(const f of phase.features||[]){
    const leaf=make('feature',p.code+':feature:'+f.id,f.label,{feature:f,phase,product:p});
    ph.children.push(leaf);
    featuresByCode.set(p.code+':'+f.id,leaf);
   }
  }
  root.children.push(product);
 }
 // Missing Store catalog entries must never hide persisted work.
 for(const t of tasks){
  if(t.scope==='product'&&t.product_codes?.length===1&&!productsByCode.has(t.product_codes[0])){
   const code=t.product_codes[0];
   const product=make('product','product:'+code,code,{product:{code,name:code,phases:[],totals:null}});
   root.children.push(product);productsByCode.set(code,product);
  }
 }
 for(const task of tasks)taskNodes.set(task.id,make('task','task:'+task.id,task.title,{task}));
 const attach=(task)=>{
  const node=taskNodes.get(task.id);
  if(!node)return;
  // Ignore broken/cyclic legacy parents; do not lose or duplicate the task.
  const p=task.parent_task_id&&tasks.find(t=>t.id===task.parent_task_id);
  if(p&&p.id!==task.id&&taskNodes.has(p.id)&&p.scope===task.scope&&
    [...(p.product_codes||[])].sort().join('|')===[...(task.product_codes||[])].sort().join('|')){
   let current=p,visited=new Set([task.id]),cycle=false;
   while(current){
    if(visited.has(current.id)){cycle=true;break}
    visited.add(current.id);
    current=tasks.find(t=>t.id===current.parent_task_id);
   }
   if(!cycle){taskNodes.get(p.id).children.push(node);return}
  }
  if(task.scope==='platform'){platform.children.push(node);return}
  if(task.scope==='cross_product'){cross.children.push(node);return}
  const product=productsByCode.get(task.product_codes?.[0]);
  if(!product){platform.children.push(node);return}
  const ref=task.feature_ref||task.phase_ref;
  const target=featuresByCode.get(task.product_codes[0]+':'+ref)||phasesByCode.get(task.product_codes[0]+':'+ref);
  (target||product).children.push(node);
 };
 for(const t of tasks)attach(t);
 const sortTasks=node=>{
  const index=node.children.findIndex(x=>x.kind==='task');
  if(index>=0){
   const head=node.children.filter(x=>x.kind!=='task');
   const children=node.children.filter(x=>x.kind==='task').sort(taskSort);
   node.children=[...head,...children];
  }
  node.children.forEach(sortTasks);
 };
 if(platform.children.length)root.children.push(platform);
 if(cross.children.length)root.children.push(cross);
 sortTasks(root);
 return root;
}
export function filterDevelopmentHierarchy(node,{search='',status='',sprintId=''}={}){
 const term=String(search).trim().toLocaleLowerCase('fa-IR');
 if(!term&&!status&&!sprintId)return node;
 const visit=(n,inheritMatch=false)=>{
  const matched=inheritMatch||!term||[n.label,n.kind==='task'?n.data.task?.task_key:'',n.kind==='task'?n.data.task?.description:''].some(x=>String(x||'').toLocaleLowerCase('fa-IR').includes(term));
  if(n.kind==='task'){
   const task=n.data.task;
   const own=(matched&&(!status||task.status===status)&&(!sprintId||task.sprint_id===sprintId));
   const children=n.children.map(x=>visit(x,matched)).filter(Boolean);
   return own||children.length?{...n,children}:null;
  }
  const children=n.children.map(x=>visit(x,matched)).filter(Boolean);
  // Under a filtered timeline, hide empty features/phases/products; root stays.
  return n.kind==='root'||children.length?{...n,children}:null;
 };
 return visit(node)||{...node,children:[]};
}
export function hierarchyCounts(node){
 let tasks=0,features=0,phases=0,areas=0;
 function scan(n){
  if(n.kind==='task')tasks++;
  if(n.kind==='feature')features++;
  if(n.kind==='phase')phases++;
  if(n.kind==='product'||n.kind==='area')areas++;
  n.children.forEach(scan);
 }
 scan(node);
 return {tasks,features,phases,areas};
}
export function findTreeNode(root,key){
 if(root.key===key)return root;
 for(const child of root.children){const r=findTreeNode(child,key);if(r)return r}
 return null;
}

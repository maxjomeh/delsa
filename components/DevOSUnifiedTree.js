'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {ChevronDown,ChevronLeft,FolderTree,GitPullRequest,Plus,RefreshCw,Save,Link2,ShieldCheck,AlertTriangle,CheckCircle2,Search,Layers3} from 'lucide-react';
import {buildDevelopmentHierarchy,filterDevelopmentHierarchy,hierarchyCounts,findTreeNode} from '../lib/devos/hierarchy.mjs';
import {STATUSES,PRIORITIES,TYPES,WORKSTREAMS,EVIDENCE_KINDS,SCOPES} from '../lib/devos/contracts.mjs';
import './DevOSUnifiedTree.css';
import {progressByTask,executionSummary,auditMetrics} from '../lib/devos/progress.mjs';
import {productionEvidenceForTasks} from '../lib/devos/release-evidence.mjs';
const fa=x=>Number(x||0).toLocaleString('fa-IR');
const label=(list,id)=>list.find(x=>x[0]===id)?.[1]||id;
const taskCodes=t=>[...(t?.product_codes||[])].sort().join(',');
const isTask=n=>n?.kind==='task';
async function api(body,params={}){
 const u=new URL('/api/admin/devos',window.location.origin);
 Object.entries(params).forEach(([k,v])=>{if(v!==null&&v!==undefined&&v!=='')u.searchParams.set(k,String(v))});
 const res=await fetch(u.toString(),body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'}:{cache:'no-store'});
 const val=await res.json().catch(()=>({error:'invalid_server_response'}));
 if(!res.ok)throw Error(val.error||'ارتباط با DevOS برقرار نشد');
 return val;
}
function Donut({value,size=38,detail=''}) {
 const known=typeof value==='number'&&Number.isFinite(value);
 const n=known?Math.max(0,Math.min(100,Math.round(value))):0;
 const length=2*Math.PI*17;
 return <span className={'devu-donut'+(size>50?' devu-donut-large':'')}
  role="progressbar" aria-label={detail||'پیشرفت'} aria-valuemin={0} aria-valuemax={100}
  aria-valuenow={known?n:undefined} aria-valuetext={known?fa(n)+' درصد':'هنوز ارزیابی نشده'}
  title={(detail?detail+' · ':'')+(known?fa(n)+'٪':'درصد ثبت نشده')}
  style={{'--devu-donut-size':size+'px'}}>
  <svg viewBox="0 0 44 44" aria-hidden="true">
   <circle className="devu-donut-track" cx="22" cy="22" r="17" fill="none" strokeWidth="5"/>
   <circle className="devu-donut-fill" cx="22" cy="22" r="17" fill="none" strokeWidth="5"
    strokeDasharray={length} strokeDashoffset={length*(1-n/100)} strokeLinecap="round"/>
  </svg><b>{known?fa(n)+'٪':'—'}</b>
 </span>;
}
function TreeBranch({node,depth,open,onToggle,selected,onSelect,sprints,forceOpen,taskProgress,productionEvidence}){
 const hasChildren=node.children.length>0;
 const isOpen=forceOpen||open.has(node.key);
 const t=node.data.task,phase=node.data.phase,feature=node.data.feature,product=node.data.product;
 const pct=feature?.score??phase?.score??product?.totals?.score;
 const documented=t?taskProgress.get(t.id)?.value:pct;
 const sprint=sprints.find(x=>x.id===t?.sprint_id);
 const childTasks=node.children.filter(x=>x.kind==='task').length;
 const cls='devu-node devu-'+node.kind+(selected===node.key?' selected':'');
 return <div className="devu-branch">
  <div className={cls} style={{'--level':depth}}>
   <button type="button" className="devu-expand" onClick={()=>onToggle(node.key)} aria-label={isOpen?'بستن زیرمجموعه':'بازکردن زیرمجموعه'} aria-expanded={isOpen} disabled={!hasChildren}>
    {hasChildren?(isOpen?<ChevronDown size={15}/>:<ChevronLeft size={15}/>):<span className="devu-dot"/>}
   </button>
   <button type="button" className="devu-node-main" onClick={()=>{onSelect(node.key);if(hasChildren&&!isOpen)onToggle(node.key)}}>
    <span className="devu-type">{({root:'کل',area:'حوزه',product:'محصول',phase:'فاز',feature:'قابلیت',task:'تسک'})[node.kind]}</span>
    <strong title={node.label}>{node.label}</strong>
    {t&&<small className="devu-id" dir="ltr">{t.task_key}</small>}
    {t&&<span className={'devu-priority '+t.priority}>{t.priority}</span>}
    {t&&<span className="devu-status">{label(STATUSES,t.status)}</span>}
     {t&&productionEvidence.has(t.id)&&<span className="devu-prod-proof" title="شاهد انتشار دقیقاً برای نسخهٔ Production فعال ثبت شده">Production ✓</span>}
    {sprint&&<span className="devu-sprintcode">{sprint.code}</span>}
    {(t||pct!==null&&pct!==undefined)&&<Donut value={documented} size={38} detail={t?'پیشرفت مستند تسک':'امتیاز ممیزی'}/>}
    {childTasks>0&&<small className="devu-count">{fa(childTasks)} تسک مستقیم</small>}
   </button>
  </div>
  {hasChildren&&isOpen&&<div className="devu-children">
   {node.children.map(child=><TreeBranch key={child.key} node={child} depth={depth+1} open={open} onToggle={onToggle} selected={selected} onSelect={onSelect} sprints={sprints} forceOpen={forceOpen} taskProgress={taskProgress} productionEvidence={productionEvidence}/>)}
  </div>}
 </div>;
}
const initialCreate={title:'',description:'',priority:'P2',taskType:'improvement',workstream:'engineering',acceptance:'',status:'idea',sprintId:'',scope:'platform',productCodes:'',featureRef:'',parentId:null};
const initialEvidence={kind:'manual_test',verdict:'unknown',url:'',commitSha:'',deploymentId:'',notes:''};
export default function DevOSUnifiedTree({products=[],productionSha='',onReviewFeature,onAddFeature}){
 const [tasks,setTasks]=useState([]),[sprints,setSprints]=useState([]),[proof,setProof]=useState([]),[dependencies,setDependencies]=useState([]),[history,setHistory]=useState([]);
 const [total,setTotal]=useState(0),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[query,setQuery]=useState(''),[status,setStatus]=useState(''),[sprint,setSprint]=useState('');
 const [selected,setSelected]=useState('product:cima'),[open,setOpen]=useState(()=>new Set(['root:delsa','product:cima','cima:phase:p0']));
 const [create,setCreate]=useState(false),[form,setForm]=useState(initialCreate),[newSprint,setNewSprint]=useState(false),[sprintForm,setSprintForm]=useState({code:'',title:'',objective:''});
 const [evForm,setEvForm]=useState(initialEvidence),[showEvidence,setShowEvidence]=useState(false),[note,setNote]=useState(''),[moveParent,setMoveParent]=useState(''),[progressDraft,setProgressDraft]=useState('');
 const fetchAll=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const first=await api(null,{offset:0});
   // Bounded eager loading keeps the tree complete for ordinary portfolios.
   let rows=first.tasks||[],offset=rows.length;
   while(offset<(first.total||0)&&offset<500){
    const more=await api(null,{offset});
    if(!more.tasks?.length)break;
    rows=[...rows,...more.tasks];offset=rows.length;
   }
   setTasks(rows);setTotal(first.total||0);setSprints(first.sprints||[]);
   // Detail evidence is paginated by the API; fetch it for each page.
   const evidence=[...(first.evidence||[])],deps=[...(first.dependencies||[])];
   for(let page=100;page<rows.length;page+=100){
    const r=await api(null,{offset:page});
    evidence.push(...(r.evidence||[]));deps.push(...(r.dependencies||[]));
   }
   setProof(evidence);setDependencies(deps);
  }catch(e){setError(e.message)}
  finally{setLoading(false)}
 },[]);
 useEffect(()=>{fetchAll();const timer=setInterval(()=>{if(document.visibilityState==='visible')fetchAll()},300000);return()=>clearInterval(timer)},[fetchAll]);
 const fullTree=useMemo(()=>buildDevelopmentHierarchy(products,tasks),[products,tasks]);
 const taskProgress=useMemo(()=>progressByTask(tasks),[tasks]);
 const productionEvidence=useMemo(()=>productionEvidenceForTasks(tasks,proof,productionSha),[tasks,proof,productionSha]);
 const sid=sprints.find(x=>x.code===sprint)?.id||'';
 const tree=useMemo(()=>filterDevelopmentHierarchy(fullTree,{search:query,status,sprintId:sid}),[fullTree,query,status,sid]);
 const counts=useMemo(()=>hierarchyCounts(fullTree),[fullTree]);
 const current=findTreeNode(fullTree,selected);
 const task=current?.data?.task;
 const childTasks=task?tasks.filter(t=>t.parent_task_id===task.id):[];
 useEffect(()=>{setProgressDraft(task?.progress_percent==null?'':String(task.progress_percent))},[task?.id,task?.progress_percent]);
 const topMetrics=useMemo(()=>{
  const scopeProduct=current?.data?.product||(task?.scope==='product'?products.find(p=>p.code===task.product_codes?.[0]):null);
  const audited=scopeProduct?[scopeProduct]:products;
  const a=auditMetrics(audited);
  const e=executionSummary(tasks,scopeProduct?.code||null);
  return [
   {label:'پیشرفت کلی ممیزی',value:a.score,detail:scopeProduct?.name||'میانگین محصولات ممیزی‌شده'},
   {label:'میزان پیاده‌سازی',value:a.implementation,detail:'ارزیابی ساخت قابلیت‌ها'},
   {label:'آمادگی عملیاتی',value:a.readiness,detail:'بر پایهٔ شواهد معتبر'},
   {label:'اجرای تسک‌ها',value:e.value,detail:fa(e.assessed)+' از '+fa(e.total)+' تسک انتهایی ارزیابی‌شده'}
  ];
 },[current,task,products,tasks]);
 const toggle=useCallback(key=>setOpen(prev=>{const n=new Set(prev);if(n.has(key))n.delete(key);else n.add(key);return n}),[]);
 const choose=nodeKey=>{setSelected(nodeKey);setCreate(false);setShowEvidence(false);setNote('');setHistory([]);setMoveParent('');const t=findTreeNode(fullTree,nodeKey)?.data?.task;
  if(t)api(null,{history:t.id}).then(d=>setHistory(d.events||[])).catch(()=>{});
 };
 const act=async(body,message)=>{
  setSaving(true);setError('');setNotice('');
  try{const out=await api(body);setNotice(message);await fetchAll();return out}
  catch(e){setError(e.message);return null}
  finally{setSaving(false)}
 };
 const openCreation=(node=current)=>{
  const t=node?.data?.task,p=node?.data?.product,kind=node?.kind;
  const scope=t?.scope||node?.data?.scope||(p?'product':'platform');
  const codes=t?.product_codes||(scope==='product'?[p.code]:[]);
  setForm({...initialCreate,scope,productCodes:codes.join(','),featureRef:kind==='feature'?node.data.feature.id:kind==='phase'?String(node.data.phase.key||'p'+node.data.phase.number):(t?.feature_ref||t?.phase_ref||''),parentId:t?.id||null,
   sprintId:t?.sprint_id||''});
  setCreate(true);
 };
 const createTask=async e=>{
  e.preventDefault();
  const x={action:'create_task',title:form.title,description:form.description,scope:form.scope,
   productCodes:form.productCodes.split(/[,،\n]+/).map(s=>s.trim()).filter(Boolean),
   workstream:form.workstream,taskType:form.taskType,priority:form.priority,status:form.status,phaseRef:null,
   featureRef:form.featureRef||null,parentId:form.parentId||null,
   sprintId:form.sprintId||null,acceptanceCriteria:form.acceptance.split('\n').map(s=>s.trim()).filter(Boolean)};
  const saved=await act(x,'تسک در ساختار واحد ذخیره شد');
  if(saved?.task){setCreate(false);setSelected('task:'+saved.task.id)}
 };
 const changeTask=async(patch,message='تغییر در تاریخچه DevOS ثبت شد')=>{if(!task)return;return act({action:'update_task',id:task.id,revision:task.revision,patch},message)};
 const addEvidence=async e=>{e.preventDefault();if(!task)return;const r=await act({action:'add_evidence',id:task.id,...evForm},'شاهد به تسک افزوده شد');if(r){setEvForm(initialEvidence);setShowEvidence(false)}};
 const matchParents=tasks.filter(t=>t.id!==task?.id&&t.scope===task?.scope&&taskCodes(t)===taskCodes(task)&&t.id!==task?.parent_task_id);
 const taskProof=task?proof.filter(e=>e.task_id===task.id):[];
 const taskDeps=task?dependencies.filter(d=>d.task_id===task.id).map(d=>tasks.find(x=>x.id===d.depends_on_id)?.task_key||'تسک خارج از فهرست'):[];
 return <section className="devu-root" dir="rtl" aria-label="درخت یکپارچهٔ توسعهٔ دلسا">
  <header className="devu-top"><div><span className="devu-eyebrow"><FolderTree size={15}/> DELSA DEVOS / UNIFIED ROADMAP</span>
   <h2>نقشهٔ واحد توسعهٔ دلسا</h2><p>دلسا ← محصول یا حوزه ← فاز ← قابلیت ← تسک ← زیرتسک‌های نامحدود. اسپرینت فقط یک فیلتر زمانی است.</p></div>
   <div className="devu-top-actions"><button type="button" onClick={()=>fetchAll()} disabled={loading}><RefreshCw size={15}/> بروزرسانی</button>
   <button type="button" className="devu-primary" onClick={()=>openCreation()}><Plus size={15}/> ثبت توسعه</button></div>
  </header>
  {error&&<p role="alert" className="devu-alert devu-error"><AlertTriangle size={15}/>{error}</p>}
  {notice&&<p role="status" className="devu-alert"><CheckCircle2 size={15}/>{notice}</p>}
  {productionSha&&<p className="devu-release-notice"><ShieldCheck size={15}/> نسخهٔ فعال Production <b dir="ltr">{productionSha.slice(0,8)}</b> · {fa(productionEvidence.size)} تسک دارای شاهد انتشار دقیقاً در این نسخه · امتیاز آمادگی عملیاتی مستقل از انتشار است</p>}
  <div className="devu-metrics" aria-label="شاخص‌های درصدی توسعه">
   {topMetrics.map(k=><div key={k.label} className="devu-metric">
    <Donut value={k.value} size={72} detail={k.label}/>
    <div><strong>{k.label}</strong><small>{k.detail}</small></div>
   </div>)}
  </div>
  <div className="devu-tools">
   <label className="devu-search"><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="جست‌وجو در تمام سطوح..." aria-label="جست‌وجوی جامع"/></label>
   <label className="devu-filter"><select aria-label="فیلتر اسپرینت" value={sprint} onChange={e=>setSprint(e.target.value)}><option value="">همهٔ اسپرینت‌ها</option>{sprints.map(x=><option key={x.id} value={x.code}>{x.code} · {x.title}</option>)}</select></label>
   <label className="devu-filter"><select aria-label="فیلتر وضعیت تسک" value={status} onChange={e=>setStatus(e.target.value)}><option value="">تمام وضعیت‌ها</option>{STATUSES.map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
   <button type="button" onClick={()=>setNewSprint(v=>!v)}><Plus size={13}/> اسپرینت جدید</button>
  </div>
  {newSprint&&<form className="devu-mini-form" onSubmit={async e=>{e.preventDefault();const r=await act({action:'create_sprint',code:sprintForm.code,title:sprintForm.title,objective:sprintForm.objective,scope:'platform',productCodes:[],acceptanceCriteria:[]},'اسپرینت ثبت شد؛ تسک‌ها می‌توانند به آن متصل شوند');if(r)setNewSprint(false)}}>
   <input required maxLength={56} placeholder="شناسه (مثل DEV-S02)" value={sprintForm.code} onChange={e=>setSprintForm(s=>({...s,code:e.target.value.toUpperCase()}))}/>
   <input required maxLength={180} placeholder="عنوان" value={sprintForm.title} onChange={e=>setSprintForm(s=>({...s,title:e.target.value}))}/>
   <input maxLength={3000} placeholder="هدف اسپرینت" value={sprintForm.objective} onChange={e=>setSprintForm(s=>({...s,objective:e.target.value}))}/>
   <button disabled={saving} type="submit" className="devu-primary">ثبت</button>
  </form>}
  <div className="devu-layout">
   <div className="devu-tree-panel">
    <div className="devu-panel-head"><strong>ساختار توسعه</strong><small>{loading?'در حال همگام‌سازی…':total>tasks.length?'نمایش '+fa(tasks.length)+' از '+fa(total)+' تسک':'کل مسیر توسعه'}</small></div>
    <div className="devu-tree">
     <TreeBranch node={tree} depth={0} open={open} onToggle={toggle} selected={selected} onSelect={choose} sprints={sprints} forceOpen={Boolean(query.trim()||status||sprint)} taskProgress={taskProgress} productionEvidence={productionEvidence}/>
    </div>
    {total>tasks.length&&<p className="devu-hint">برای جلوگیری از بارگذاری سنگین، تنها ۵۰۰ تسک نخست نمایش داده می‌شوند. {fa(total-tasks.length)} تسک باقی مانده‌اند.</p>}
   </div>
   <aside className="devu-detail" aria-label="جزئیات گره انتخاب‌شده">
    <div className="devu-panel-head"><strong>جزئیات و اقدامات</strong><small>با انتخاب هر سطح، تنظیمات مرتبط نمایش داده می‌شود</small></div>
    {current?<div className="devu-detail-body">
     <div className="devu-tag">{({root:'دلسا',area:'حوزه توسعه',product:'محصول',phase:'فاز',feature:'قابلیت',task:'تسک اجرایی'})[current.kind]}</div>
     <h3>{current.label}</h3>
     {current.kind==='root'&&<p>نمای مرکزی همهٔ توسعه‌ها؛ محصولات و کارهای مستقل یا مشترک، در همین درخت دنبال می‌شوند.</p>}
     {current.kind==='area'&&<p>توسعه‌های غیرمحصولی یا مشترک، با تسک‌های چندسطحی و تاریخچهٔ مستقل.</p>}
     {current.kind==='product'&&<><p>{current.data.product?.totals?'پیشرفت ممیزی‌شدهٔ محصول: '+fa(current.data.product.totals.score)+'٪':'این محصول هنوز امتیاز ممیزی ندارد.'}</p>
      {current.data.product?.totals&&<div className="devu-submetrics"><span>ساخت {fa(current.data.product.totals.implementation)}٪</span><span>آمادگی عملیاتی {fa(current.data.product.totals.readiness)}٪</span></div>}
      <button type="button" onClick={()=>onAddFeature?.(current.data.product.code,'new')}><Plus size={14}/> تعریف فاز / قابلیت</button></>}
     {current.kind==='phase'&&<><p>وزن این فاز: {fa(current.data.phase.weight)}٪ · امتیاز ممیزی: {fa(current.data.phase.score)}٪</p>
      <button type="button" onClick={()=>onAddFeature?.(current.data.product.code,String(current.data.phase.key||'p'+current.data.phase.number))}><Plus size={14}/> افزودن قابلیت به فاز</button></>}
     {current.kind==='feature'&&<><div className="devu-submetrics"><span>ساخت: {fa(current.data.feature.implementation)}٪</span><span>آمادگی: {fa(current.data.feature.readiness)}٪</span><span>امتیاز: {fa(current.data.feature.score)}٪</span></div>
      <p>امتیاز ممیزیِ قابلیت مستقل از تعداد تسک‌های تکمیل‌شده است.</p>
      <button type="button" onClick={()=>onReviewFeature?.(current.data.feature,current.data.product.code)}><Save size={14}/> ثبت ارزیابی مستند</button>
      {!!current.data.feature.sourcePaths?.length&&<div className="devu-source">{current.data.feature.sourcePaths.slice(0,3).map(path=><small key={path} dir="ltr">{path}</small>)}</div>}
     </>}
     {task&&<>
      <p className="devu-task-meta"><b dir="ltr">{task.task_key}</b> · {label(TYPES,task.task_type)} · {task.priority}</p>
      <p>{task.description||'توضیح ثبت نشده است.'}</p>
      {productionEvidence.has(task.id)&&<p className="devu-release-notice"><ShieldCheck size={14}/> انتشار این تسک برای Commit فعالِ Production با شواهد مستقل ثبت شده است. این علامت، جایگزین آزمون عملکرد واقعی نیست.</p>}
      <label>وضعیت<select disabled={saving} value={task.status} onChange={e=>{const v=e.target.value;if(v==='blocked'){const reason=window.prompt('علت مسدودی را وارد کن');if(reason?.trim().length>=5)changeTask({status:v,blocker_reason:reason});return}changeTask({status:v})}}>{STATUSES.map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <label>اولویت<select disabled={saving} value={task.priority} onChange={e=>changeTask({priority:e.target.value})}>{PRIORITIES.map(k=><option key={k}>{k}</option>)}</select></label>
      <div className="devu-task-progress">
       <div className="devu-task-progress-heading"><strong>پیشرفت اجرایی مستند</strong><Donut value={taskProgress.get(task.id)?.value} size={45} detail="پیشرفت اجرایی"/></div>
       {childTasks.length?<p>درصد این تسک از {fa(childTasks.length)} زیرتسک آن محاسبه می‌شود. زیرتسک‌ها را باز کن و درصدشان را ثبت کن.</p>:
       <div className="devu-progress-edit"><input aria-label="درصد پیشرفت این تسک از ۰ تا ۱۰۰" type="number" min="0" max="100" step="1" placeholder="درصد: ۰ تا ۱۰۰" value={progressDraft} onChange={e=>setProgressDraft(e.target.value)} disabled={saving}/>
        <button type="button" disabled={saving||progressDraft!==''&&(!Number.isInteger(Number(progressDraft))||Number(progressDraft)<0||Number(progressDraft)>100)}
         onClick={()=>act({action:'set_progress',id:task.id,revision:task.revision,progress:progressDraft===''?null:Number(progressDraft)},'درصد پیشرفت مستند ذخیره شد')}>ثبت درصد</button>
       </div>}
       <small>تغییر این درصد، امتیاز آمادگی عملیاتی یا وضعیت انتشار را تغییر نمی‌دهد.</small>
      </div>
      <label>اسپرینت<select disabled={saving} value={task.sprint_id||''} onChange={e=>changeTask({sprint_id:e.target.value||null})}><option value="">بدون اسپرینت</option>{sprints.map(s=><option key={s.id} value={s.id}>{s.code} · {s.title}</option>)}</select></label>
      {task.scope==='product'&&!task.parent_task_id&&<label>اتصال به فاز / قابلیت<select disabled={saving} value={task.feature_ref||task.phase_ref||''} onChange={e=>act({action:'assign_feature',id:task.id,revision:task.revision,featureRef:e.target.value||null},'تسک به قابلیت متصل شد')}><option value="">بدون قابلیت</option>
       {products.filter(p=>p.code===task.product_codes?.[0]).flatMap(p=>p.phases.flatMap(ph=>[
        <option key={'phase-'+String(ph.key||'p'+ph.number)} value={String(ph.key||'p'+ph.number)}>فاز: {ph.name}</option>,
        ...ph.features.map(f=><option key={f.id} value={f.id}>{ph.name} / {f.label}</option>)
       ]))}</select></label>}
      <label>زیرتسکِ<select value={moveParent||task.parent_task_id||''} onChange={e=>setMoveParent(e.target.value)}><option value="">سطح اصلی حوزه / قابلیت</option>{matchParents.map(p=><option key={p.id} value={p.id}>{p.task_key} — {p.title}</option>)}</select></label>
      <button type="button" disabled={saving} onClick={()=>act({action:'move_task',id:task.id,revision:task.revision,parentId:moveParent||null},'جایگاه تسک در درخت تغییر کرد')}>تغییر جایگاه</button>
      <h4>معیارهای پذیرش</h4><ul>{(task.acceptance_criteria||[]).map((s,i)=><li key={i}>{s}</li>)}</ul>
      <label>یادداشت و تصمیم<textarea rows={2} value={note} maxLength={2000} onChange={e=>setNote(e.target.value)}/></label>
      <button disabled={!note.trim()||saving} type="button" onClick={async()=>{const r=await changeTask({notes:note},'دلیل تصمیم ثبت شد');if(r)setNote('')}}><Save size={14}/> ثبت در تاریخچه</button>
      <h4>وابستگی‌ها</h4><p>{taskDeps.length?taskDeps.join(' · '):'پیش‌نیازی ثبت نشده'}</p>
      <h4>شواهد و تاریخچه</h4>{taskProof.map(p=><p key={p.id} className="devu-proof">{label(EVIDENCE_KINDS,p.kind)} · {p.verdict}{p.url&&<a href={p.url} target="_blank" rel="noreferrer"> · لینک مدرک</a>}</p>)}
      <button type="button" onClick={()=>setShowEvidence(v=>!v)}><Link2 size={14}/> افزودن شاهد</button>
      {showEvidence&&<form className="devu-edit-form" onSubmit={addEvidence}>
       <select value={evForm.kind} onChange={e=>setEvForm(v=>({...v,kind:e.target.value}))}>{EVIDENCE_KINDS.map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
       <select value={evForm.verdict} onChange={e=>setEvForm(v=>({...v,verdict:e.target.value}))}><option value="unknown">نامشخص</option><option value="passed">موفق</option><option value="failed">ناموفق</option><option value="blocked">مسدود</option></select>
       <input type="url" placeholder="لینک مدرک HTTPS" value={evForm.url} onChange={e=>setEvForm(v=>({...v,url:e.target.value}))}/>
       <input placeholder="SHA (اختیاری)" dir="ltr" value={evForm.commitSha} onChange={e=>setEvForm(v=>({...v,commitSha:e.target.value}))}/>
       <input placeholder="Deployment ID (اختیاری)" value={evForm.deploymentId} onChange={e=>setEvForm(v=>({...v,deploymentId:e.target.value}))}/>
       <textarea placeholder="توضیحات مدرک" rows={2} value={evForm.notes} onChange={e=>setEvForm(v=>({...v,notes:e.target.value}))}/>
       <button className="devu-primary" disabled={saving} type="submit">ثبت شاهد</button>
      </form>}
      {history.slice(0,20).map(h=><p className="devu-event" key={h.id}>{new Date(h.occurred_at).toLocaleString('fa-IR')} · {h.action}</p>)}
     </>}
     <div className="devu-detail-actions"><button type="button" className="devu-primary" onClick={()=>openCreation(current)}><Plus size={14}/>{task?'ساخت زیرتسک':'افزودن تسک به این سطح'}</button></div>
     {create&&<form className="devu-edit-form" onSubmit={createTask}>
      <h4>تسک جدید در این شاخه</h4>
      <input required minLength={5} maxLength={240} placeholder="عنوان تسک" value={form.title} onChange={e=>setForm(v=>({...v,title:e.target.value}))}/>
      <textarea rows={2} placeholder="شرح و هدف" value={form.description} onChange={e=>setForm(v=>({...v,description:e.target.value}))}/>
      {!form.parentId&&<><label>محدوده<select value={form.scope} onChange={e=>setForm(v=>({...v,scope:e.target.value,productCodes:e.target.value==='platform'?'':v.productCodes}))}>{SCOPES.map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
       <label>کد محصولات<input value={form.productCodes} placeholder="cima,apu" onChange={e=>setForm(v=>({...v,productCodes:e.target.value}))}/></label></>}
      <label>نوع<select value={form.taskType} onChange={e=>setForm(v=>({...v,taskType:e.target.value}))}>{TYPES.map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <label>اولویت<select value={form.priority} onChange={e=>setForm(v=>({...v,priority:e.target.value}))}>{PRIORITIES.map(k=><option key={k}>{k}</option>)}</select></label>
      <label>حوزه<select value={form.workstream} onChange={e=>setForm(v=>({...v,workstream:e.target.value}))}>{WORKSTREAMS.map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <label>اسپرینت<select value={form.sprintId} onChange={e=>setForm(v=>({...v,sprintId:e.target.value}))}><option value="">بدون اسپرینت</option>{sprints.map(s=><option key={s.id} value={s.id}>{s.code} · {s.title}</option>)}</select></label>
      <textarea rows={3} placeholder="معیارهای پذیرش (هر خط یک مورد)" value={form.acceptance} onChange={e=>setForm(v=>({...v,acceptance:e.target.value}))}/>
      <div className="devu-form-actions"><button className="devu-primary" disabled={saving} type="submit"><Save size={14}/> ذخیره</button><button type="button" onClick={()=>setCreate(false)}>انصراف</button></div>
     </form>}
    </div>:<div className="devu-detail-body"><p>گره موردنظر را از درخت انتخاب کن.</p><button onClick={()=>choose('root:delsa')}>بازگشت به نمای کلی</button></div>}
   </aside>
  </div>
  <p className="devu-foot"><ShieldCheck size={15}/> درصد ساخت و آمادگی عملیاتی مستقل از پیشرفت اجرایی Sprint است. سبزشدن CI یا اتمام تسک، بدون تأیید واقعی Production امتیاز عملیاتی را تغییر نمی‌دهد.</p>
 </section>;
}

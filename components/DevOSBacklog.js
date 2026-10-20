'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {AlertTriangle,CheckCircle2,ChevronDown,ChevronUp,ClipboardList,GitPullRequest,Link2,Plus,RefreshCw,Save,ShieldCheck} from 'lucide-react';
import {STATUSES,PRIORITIES,WORKSTREAMS,TYPES,SCOPES,EVIDENCE_KINDS} from '../lib/devos/contracts.mjs';
import './DevOSBacklog.css';
const fa=n=>Number(n||0).toLocaleString('fa-IR');
const title=(items,key)=>items.find(x=>x[0]===key)?.[1]||key;
const empty={title:'',description:'',scope:'product',productCodes:'cima',workstream:'engineering',taskType:'improvement',priority:'P2',status:'idea',phaseRef:'',acceptance:'',sprintId:''};
const emptyEvidence={kind:'manual_test',verdict:'unknown',url:'',commitSha:'',deploymentId:'',notes:''};
async function api(body,filters={}){
 const u=new URL('/api/admin/devos',location.origin);
 Object.entries(filters).forEach(([k,v])=>{if(v!==''&&v!=null)u.searchParams.set(k,String(v))});
 const opts=body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'}:{cache:'no-store'};
 const response=await fetch(u.toString(),opts);
 const data=await response.json().catch(()=>({error:'invalid_response'}));
 if(!response.ok)throw Error(data.error||'ارتباط با DevOS برقرار نشد');
 return data;
}
export default function DevOSBacklog(){
 const [tasks,setTasks]=useState([]),[sprints,setSprints]=useState([]),[evidence,setEvidence]=useState([]),[deps,setDeps]=useState([]),[events,setEvents]=useState([]);
 const [sprintCode,setSprintCode]=useState('CIMA-S01'),[status,setStatus]=useState(''),[product,setProduct]=useState(''),[query,setQuery]=useState(''),[offset,setOffset]=useState(0),[total,setTotal]=useState(0);
 const [selected,setSelected]=useState(''),[form,setForm]=useState(empty),[newOpen,setNewOpen]=useState(false),[evOpen,setEvOpen]=useState(false),[evForm,setEvForm]=useState(emptyEvidence),[dependency,setDependency]=useState(''),[note,setNote]=useState('');
 const [expanded,setExpanded]=useState(true),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const activeSprint=sprints.find(s=>s.code===sprintCode),task=tasks.find(t=>t.id===selected);
 const counts=useMemo(()=>({blocked:tasks.filter(t=>t.status==='blocked').length,working:tasks.filter(t=>t.status==='in_progress').length,verified:tasks.filter(t=>t.status==='verified').length}),[tasks]);
 const load=useCallback(async(history='',quiet=false)=>{
  if(!quiet)setLoading(true);
  try{
   const result=await api(null,{sprint_code:sprintCode,status,product,q:query,offset,history});
   setTasks(result.tasks||[]);setSprints(result.sprints||[]);setEvidence(result.evidence||[]);setDeps(result.dependencies||[]);setTotal(result.total||0);
   if(history)setEvents(result.events||[]);
   setError('');
  }catch(e){setError(e.message)}
  finally{if(!quiet)setLoading(false)}
 },[sprintCode,status,product,query,offset]);
 useEffect(()=>{load();const t=setInterval(()=>{if(document.visibilityState==='visible')load('',true)},90000);return()=>clearInterval(t)},[load]);
 const sync=useCallback(async(quiet=false)=>{
  if(!quiet)setSaving(true);
  try{const result=await api({action:'sync_github'});if(!quiet)setSuccess(fa(result.created)+' شاهد Pull Request ثبت شد');if(result.created)await load('',true)}
  catch(e){if(!quiet)setError(e.message)}finally{if(!quiet)setSaving(false)}
 },[load]);
 useEffect(()=>{const t=setInterval(()=>{if(document.visibilityState==='visible')sync(true)},900000);return()=>clearInterval(t)},[sync]);
 const run=async(payload,message,history='')=>{
  setSaving(true);setError('');setSuccess('');
  try{await api(payload);setSuccess(message);await load(history);return true}
  catch(e){setError(e.message);return false}
  finally{setSaving(false)}
 };
 const createTask=async e=>{
  e.preventDefault();
  const codes=form.productCodes.split(/[,،\n]+/).map(x=>x.trim()).filter(Boolean);
  const data={action:'create_task',title:form.title,description:form.description,scope:form.scope,productCodes:codes,
   workstream:form.workstream,taskType:form.taskType,priority:form.priority,status:form.status,
   phaseRef:form.phaseRef||null,acceptanceCriteria:form.acceptance.split('\n').map(x=>x.trim()).filter(Boolean),
   sprintId:form.sprintId||(form.scope==='product'&&codes.length===1&&codes[0]==='cima'?activeSprint?.id:null)||null};
  if(await run(data,'تسک با شناسه دائمی ثبت شد')){setForm(empty);setNewOpen(false)}
 };
 const patch=async(p,changes)=>{if(await run({action:'update_task',id:p.id,revision:p.revision,patch:changes},'تغییر و تاریخچه ثبت شد',p.id))setNote('')};
 const select=p=>{
  if(selected===p.id){setSelected('');return}
  setSelected(p.id);setEvOpen(false);setNote('');setEvents([]);
  api(null,{history:p.id}).then(r=>setEvents(r.events||[])).catch(()=>{});
 };
 const addEvidence=async e=>{
  e.preventDefault();if(!task)return;
  if(await run({action:'add_evidence',id:task.id,...evForm},'شاهد ثبت شد',task.id)){setEvForm(emptyEvidence);setEvOpen(false)}
 };
 const selectedDeps=task?deps.filter(d=>d.task_id===task.id).map(d=>tasks.find(t=>t.id===d.depends_on_id)?.task_key||'پیش‌نیاز خارج از صفحه'):[];
 return <section className="devos-root" dir="rtl">
  <header className="devos-head"><div><span className="devos-eyebrow"><ClipboardList size={15}/> DELSA DevOS / Central Backlog</span>
   <h2>ایده‌ها، ارتقاها و تسک‌های توسعه</h2><p>تمام توسعه‌های محصولات، زیرساخت، امنیت و هستهٔ مشترک دلسا در یک مسیر قابل پیگیری.</p></div>
   <div className="devos-actions">
    <button type="button" onClick={()=>load()} disabled={loading}><RefreshCw size={16}/> بروزرسانی</button>
    <button type="button" onClick={()=>sync()} disabled={saving}><GitPullRequest size={16}/> همگام‌سازی PR</button>
    <button type="button" className="primary" onClick={()=>setNewOpen(v=>!v)}><Plus size={16}/> ثبت ایده / تسک</button>
    <button type="button" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded}>{expanded?<ChevronUp size={16}/>:<ChevronDown size={16}/>}</button>
   </div></header>
  {error&&<div className="devos-alert fail" role="alert"><AlertTriangle size={16}/>{error}</div>}
  {success&&<div className="devos-alert" role="status"><CheckCircle2 size={16}/>{success}</div>}
  {expanded&&<>
   <div className="devos-summary">
    <div><small>کل تسک‌های فیلترشده</small><strong>{fa(total)}</strong></div>
    <div><small>در حال توسعه (این صفحه)</small><strong>{fa(counts.working)}</strong></div>
    <div><small>مسدود (این صفحه)</small><strong>{fa(counts.blocked)}</strong></div>
    <div><small>تأیید عملیاتی (این صفحه)</small><strong>{fa(counts.verified)}</strong></div>
   </div>
   <div className="devos-filters">
    <label>اسپرینت<select value={sprintCode} onChange={e=>{setSprintCode(e.target.value);setOffset(0)}}><option value="">تمام اسپرینت‌ها</option>{sprints.map(s=><option key={s.id} value={s.code}>{s.code} — {s.title}</option>)}</select></label>
    <label>محصول / حوزه<select value={product} onChange={e=>{setProduct(e.target.value);setOffset(0)}}><option value="">همه</option><option value="cima">سیما</option><option value="apu">APU</option><option value="dorpin">دورپین</option><option value="site_builder">سایت‌ساز</option><option value="platform">هسته و پلتفرم</option></select></label>
    <label>وضعیت<select value={status} onChange={e=>{setStatus(e.target.value);setOffset(0)}}><option value="">همه وضعیت‌ها</option>{STATUSES.map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
    <label className="wide">جستجو<input type="search" placeholder="شناسه، عنوان یا کلیدواژه" value={query} onChange={e=>{setQuery(e.target.value);setOffset(0)}}/></label>
   </div>
   {activeSprint&&<div className="devos-sprint"><b>{activeSprint.title}</b><p>{activeSprint.objective}</p></div>}
   {newOpen&&<form className="devos-form" onSubmit={createTask}><h3>ثبت توسعه جدید</h3>
    <div className="devos-fields">
     <label className="wide">عنوان<input required minLength={5} maxLength={240} value={form.title} onChange={e=>setForm(s=>({...s,title:e.target.value}))}/></label>
     <label>محدوده<select value={form.scope} onChange={e=>setForm(s=>({...s,scope:e.target.value}))}>{SCOPES.map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
     <label>محصول‌ها (جداشده با کاما)<input value={form.productCodes} onChange={e=>setForm(s=>({...s,productCodes:e.target.value}))} placeholder="cima,apu"/></label>
     <label>نوع<select value={form.taskType} onChange={e=>setForm(s=>({...s,taskType:e.target.value}))}>{TYPES.map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
     <label>حوزه<select value={form.workstream} onChange={e=>setForm(s=>({...s,workstream:e.target.value}))}>{WORKSTREAMS.map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
     <label>اولویت<select value={form.priority} onChange={e=>setForm(s=>({...s,priority:e.target.value}))}>{PRIORITIES.map(k=><option key={k}>{k}</option>)}</select></label>
     <label>اسپرینت<select value={form.sprintId} onChange={e=>setForm(s=>({...s,sprintId:e.target.value}))}><option value="">بدون اسپرینت / اسپرینت سیما</option>{sprints.map(s=><option key={s.id} value={s.id}>{s.code}</option>)}</select></label>
     <label className="wide">توضیحات<textarea rows={2} value={form.description} onChange={e=>setForm(s=>({...s,description:e.target.value}))}/></label>
     <label className="wide">معیارهای پذیرش (هر مورد یک خط)<textarea rows={3} value={form.acceptance} onChange={e=>setForm(s=>({...s,acceptance:e.target.value}))}/></label>
    </div><button type="submit" className="primary" disabled={saving}><Save size={15}/> ذخیره تسک</button>
   </form>}
   {loading&&<p className="devos-muted">در حال دریافت Backlog...</p>}
   {!loading&&!tasks.length&&<p className="devos-muted">تسکی با فیلتر فعلی پیدا نشد.</p>}
   <div className="devos-list">{tasks.map(t=><article className="devos-task" key={t.id}>
    <button type="button" className="devos-task-head" onClick={()=>select(t)} aria-expanded={selected===t.id}>
     <span className="devos-key">{t.task_key}</span><span className="devos-task-name"><strong>{t.title}</strong><small>{title(TYPES,t.task_type)} · {title(WORKSTREAMS,t.workstream)} · {(t.product_codes||[]).join('، ')||'پلتفرم'}</small></span>
     <span className="devos-priority">{t.priority}</span><span className="devos-status">{title(STATUSES,t.status)}</span>
     {selected===t.id?<ChevronUp size={16}/>:<ChevronDown size={16}/>}
    </button>
    {selected===t.id&&<div className="devos-detail">
     <p>{t.description||'بدون توضیح'}</p><small>آخرین تغییر: {new Date(t.updated_at).toLocaleString('fa-IR')} · نسخه رکورد: {fa(t.revision)}</small>
     <h4>معیارهای پذیرش</h4><ul>{(t.acceptance_criteria||[]).map((c,i)=><li key={i}>{c}</li>)}</ul>
     <div className="devos-inline">
      <label>وضعیت<select value={t.status} disabled={saving} onChange={e=>{const value=e.target.value;if(value==='blocked'){const reason=prompt('علت مسدودی را بنویس');if(reason?.trim().length>=5)patch(t,{status:value,blocker_reason:reason});return}patch(t,{status:value})}}>{STATUSES.map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <label>اولویت<select value={t.priority} disabled={saving} onChange={e=>patch(t,{priority:e.target.value})}>{PRIORITIES.map(k=><option key={k}>{k}</option>)}</select></label>
     </div>
     <div className="devos-inline"><input placeholder="ثبت یادداشت یا دلیل تصمیم..." maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/><button type="button" disabled={saving||!note.trim()} onClick={()=>patch(t,{notes:note})}><Save size={14}/> ثبت یادداشت</button></div>
     {t.blocker_reason&&<p className="devos-warning">{t.blocker_reason}</p>}
     <h4>وابستگی‌ها</h4><p>{selectedDeps.length?selectedDeps.join('، '):'بدون پیش‌نیاز ثبت‌شده'}</p>
     <div className="devos-inline"><select aria-label="پیش‌نیاز" value={dependency} onChange={e=>setDependency(e.target.value)}><option value="">انتخاب پیش‌نیاز</option>{tasks.filter(x=>x.id!==t.id).map(x=><option key={x.id} value={x.id}>{x.task_key} — {x.title}</option>)}</select><button type="button" disabled={!dependency||saving} onClick={async()=>{if(await run({action:'add_dependency',id:t.id,dependsOnId:dependency},'وابستگی ثبت شد',t.id))setDependency('')}}><Link2 size={14}/> افزودن پیش‌نیاز</button></div>
     <div className="devos-inline"><h4>شواهد و انتشار</h4><button type="button" onClick={()=>setEvOpen(v=>!v)}><Plus size={14}/> شاهد جدید</button></div>
     {evidence.filter(e=>e.task_id===t.id).map(e=><div key={e.id} className="devos-evidence"><span>{title(EVIDENCE_KINDS,e.kind)} · {e.verdict}</span>{e.url&&<a href={e.url} target="_blank" rel="noreferrer">بازکردن شاهد</a>}<small>{e.notes}</small></div>)}
     {evOpen&&<form onSubmit={addEvidence} className="devos-form"><div className="devos-fields">
      <label>نوع<select value={evForm.kind} onChange={e=>setEvForm(s=>({...s,kind:e.target.value}))}>{EVIDENCE_KINDS.map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <label>نتیجه<select value={evForm.verdict} onChange={e=>setEvForm(s=>({...s,verdict:e.target.value}))}><option value="unknown">نامشخص</option><option value="passed">موفق</option><option value="failed">ناموفق</option><option value="blocked">مسدود</option></select></label>
      <label className="wide">لینک شاهد<input type="url" dir="ltr" value={evForm.url} onChange={e=>setEvForm(s=>({...s,url:e.target.value}))}/></label>
      <label>Commit SHA<input dir="ltr" value={evForm.commitSha} onChange={e=>setEvForm(s=>({...s,commitSha:e.target.value}))}/></label>
      <label>Deployment ID<input dir="ltr" value={evForm.deploymentId} onChange={e=>setEvForm(s=>({...s,deploymentId:e.target.value}))}/></label>
      <label className="wide">توضیح<input value={evForm.notes} onChange={e=>setEvForm(s=>({...s,notes:e.target.value}))}/></label>
     </div><button className="primary" type="submit" disabled={saving}>ذخیره شاهد</button></form>}
     <h4>تاریخچه تغییرات</h4><div className="devos-history">{events.filter(e=>e.task_id===t.id).map(e=><p key={e.id}>{new Date(e.occurred_at).toLocaleString('fa-IR')} · {e.action}</p>)}</div>
    </div>}
   </article>)}</div>
   <div className="devos-paging"><button type="button" disabled={!offset} onClick={()=>setOffset(s=>Math.max(0,s-100))}>قبلی</button><small>{fa(total)} تسک</small><button type="button" disabled={offset+100>=total} onClick={()=>setOffset(s=>s+100)}>بعدی</button></div>
   <p className="devos-foot"><ShieldCheck size={16}/> Build موفق به‌تنهایی پایان کار نیست؛ انتشار و تأیید عملیاتی باید شواهد جداگانه داشته باشند.</p>
  </>}
 </section>;
}

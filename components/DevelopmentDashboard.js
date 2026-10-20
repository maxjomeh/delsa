'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {Activity,AlertTriangle,ArrowUpLeft,BookOpen,CheckCircle2,ChevronDown,ChevronUp,Clock3,GitBranch,Layers3,Plus,RefreshCw,Save,ShieldCheck,TestTube2,X} from 'lucide-react';
import './DevelopmentDashboard.css';
const fa=n=>Number(n||0).toLocaleString('fa-IR',{maximumFractionDigits:1});
const short=x=>x?x.slice(0,8):'نامشخص';
const color=value=>value>=80?'high':value>=50?'middle':'low';
function Meter({value}){
 const n=Math.max(0,Math.min(100,Number(value||0)));
 return <div className="dev-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(n)}><span className={'dev-meter-fill '+color(n)} style={{width:n+'%'}}/></div>;
}
async function api(body){
 const response=await fetch('/api/admin/development',body?{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'
 }:{cache:'no-store'});
 const data=await response.json();
 if(!response.ok)throw Error(data.error||'خطا در دریافت گزارش توسعه');
 return data;
}
const empty={phaseTitle:'',label:'',sourcePaths:'',testPaths:'',phaseWeight:20,weight:10};
export default function DevelopmentDashboard(){
 const [data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [selected,setSelected]=useState('cima'),[expanded,setExpanded]=useState('p0'),[search,setSearch]=useState('');
 const [editing,setEditing]=useState(null),[scores,setScores]=useState({implementation:0,readiness:0,notes:''});
 const [addOpen,setAddOpen]=useState(false),[newItem,setNewItem]=useState(empty),[pickedPhase,setPickedPhase]=useState('new');
 const [saving,setSaving]=useState(false),[notice,setNotice]=useState('');
 const load=useCallback(async(sync=false)=>{
  setBusy(true);setError('');
  try{const result=await api(sync?{action:'sync'}:null);setData(result);}
  catch(e){
   setError(e.message||'ارتباط با سامانهٔ توسعه برقرار نشد.');
   // A rate limit or GitHub outage must not erase the last known assessment.
   if(sync){try{setData(await api(null));}catch{}}
  }finally{setBusy(false);}
 },[]);
 useEffect(()=>{
  let alive=true;
  load(true);
  const timer=setInterval(()=>{if(alive&&document.visibilityState==='visible')load(true)},300000);
  return()=>{alive=false;clearInterval(timer)};
 },[load]);
 const products=data?.products||[];
 const active=products.find(p=>p.code===selected)||products.find(p=>p.code==='cima')||products[0];
 const phases=active?.phases||[];
 const allFeatures=phases.reduce((n,p)=>n+p.features.length,0);
 const filtered=useMemo(()=>phases.map(p=>({...p,visible:p.features.filter(f=>!search.trim()||(f.label+' '+(f.reviewNote||'')+' '+(f.notes||'')).toLocaleLowerCase('fa-IR').includes(search.trim().toLocaleLowerCase('fa-IR')))})).filter(p=>!search.trim()||p.visible.length),[phases,search]);
 function edit(f){
  setEditing(f);setScores({implementation:f.implementation,readiness:f.readiness,notes:f.reviewNote||f.notes||''});
 }
 async function submitReview(e){
  e.preventDefault();if(!editing||!active)return;
  setSaving(true);setNotice('');setError('');
  try{
   const action=active.code==='cima'?'review_cima':'review_custom';
   await api({action,id:editing.id,productCode:active.code,implementation:Number(scores.implementation),
    readiness:Number(scores.readiness),notes:scores.notes});
   setEditing(null);setNotice('ممیزی با ذکر دلیل ثبت شد؛ تغییر صرف کد، معادل تست واقعی نیست.');
   await load(false);
  }catch(e){setError(e.message);}finally{setSaving(false);}
 }
 async function addFeature(e){
  e.preventDefault();if(!active||active.code==='cima')return;
  setSaving(true);setError('');setNotice('');
  const phase=phases.find(p=>String(p.key)===pickedPhase);
  const phaseKey=phase?String(phase.key):'phase_'+Date.now().toString(36);
  try{
   const featureKey='feature_'+Date.now().toString(36);
   const sourcePaths=newItem.sourcePaths.split(/[،,\n]/).map(s=>s.trim()).filter(Boolean);
   const testPaths=newItem.testPaths.split(/[،,\n]/).map(s=>s.trim()).filter(Boolean);
   await api({action:'add_feature',productCode:active.code,phaseKey,
    phaseTitle:phase?phase.name:newItem.phaseTitle,
    phaseWeight:phase?Number(phase.weight):Number(newItem.phaseWeight),
    featureKey,label:newItem.label,weight:Number(newItem.weight),sourcePaths,testPaths});
   setAddOpen(false);setNewItem(empty);setPickedPhase('new');setNotice('زیرقابلیت به نقشهٔ توسعهٔ محصول اضافه شد.');
   await load(false);
  }catch(e){setError(e.message);}finally{setSaving(false);}
 }
 return <section className="dev-root" dir="rtl" aria-label="داشبورد توسعه محصولات">
  <div className="dev-top">
   <div><span className="dev-kicker"><Layers3 size={15}/> DELSA PRODUCT ENGINEERING</span>
    <h2>رصد پیشرفت توسعهٔ محصولات</h2>
    <p>دادهٔ ممیزی، پوشش تست و نسخهٔ منتشرشده جدا ارزیابی می‌شوند. هر Deployment به‌تنهایی پیشرفت محسوب نمی‌شود.</p></div>
   <button className="dev-action" type="button" onClick={()=>load(true)} disabled={busy}>
    <RefreshCw size={16} className={busy?'dev-spin':''}/> {busy?'در حال همگام‌سازی…':'بررسی Production و GitHub'}</button>
  </div>
  {error&&<div className="dev-banner is-error" role="alert"><AlertTriangle size={17}/>{error}</div>}
  {notice&&<div className="dev-banner is-success" role="status"><CheckCircle2 size={17}/>{notice}</div>}
  {!data?<div className="dev-loading">{busy?'در حال دریافت داده‌های توسعه…':'گزارش توسعه در دسترس نیست.'}</div>:<>
   <div className="dev-release"><div className="dev-release-title"><GitBranch size={18}/><strong>وضعیت انتشار فعال</strong></div>
    <div className="dev-release-cells">
     <span><small>SHA نسخهٔ Production</small><b dir="ltr">{short(data.evidence.productionSha)}</b></span>
     <span><small>آزمون‌های CI</small><b>{data.evidence.ciState==='passed'?'موفق':data.evidence.ciState==='failed'?'ناموفق':data.evidence.ciState==='pending'?'در جریان':'تأیید نشده'}</b></span>
     <span><small>شواهد انتشار</small><b>{data.evidence.status==='verified_ci_and_release'?'قابل محاسبه':data.evidence.status==='baseline'?'مبنای ممیزی':'نیازمند بررسی'}</b></span>
     <span><small>تغییرات شناسایی‌شده</small><b>{fa(data.evidence.changedCount)} فایل</b></span>
    </div>
    <p>{data.evidence.status==='not_checked'?'برای ارزیابی نسخهٔ جدید روی «بررسی Production و GitHub» بزنید.':
      !data.evidence.productionSha?'شناسهٔ Commit این نسخه از متغیرهای امن Vercel در دسترس نیست؛ افزایش خودکار امتیاز متوقف است.':
      data.evidence.status==='baseline'?'این نسخه مبنای ممیزی ۲۰ اکتبر است؛ افزایش خودکار جدیدی ثبت نشده.':
      data.evidence.status==='verified_ci_and_release'?'کد تغییرکرده، تست مرتبط موجود و CI موفق بررسی شدند. برای پذیرش عملیاتی هنوز تست واقعی لازم است.':
      'GitHub یا CI تمام شواهد لازم را ارائه نکرده است؛ درصدهای عملیاتی بدون تأیید افزایش نمی‌یابند.'}</p>
    {data.evidence.productionSha&&<a href={'https://github.com/maxjomeh/delsa/commit/'+data.evidence.productionSha} target="_blank" rel="noreferrer">مشاهدهٔ Commit فعال <ArrowUpLeft size={13}/></a>}
   </div>
   <div className="dev-products" role="tablist" aria-label="انتخاب محصول">{products.map(p=><button type="button" role="tab" aria-selected={p.code===active?.code} key={p.code}
    onClick={()=>{setSelected(p.code);setExpanded(p.phases[0]?.key||'p0');setEditing(null);setSearch('');setAddOpen(false);}}
    className={'dev-product '+(p.code===active?.code?'is-selected':'')}>
    <span className="dev-product-head"><b>{p.name}</b><small>{p.published?'منتشرشده در فروشگاه':'غیرفعال در فروشگاه'}</small></span>
    {p.totals?<><strong>{fa(p.totals.score)}٪</strong><Meter value={p.totals.score}/></>:<><strong className="dev-unknown">بدون ممیزی</strong><span className="dev-none">نقشهٔ توسعه تعریف نشده است</span></>}
   </button>)}</div>
   {active&&<><div className="dev-overview">
    <div><span className="dev-kicker">گزارش محصول انتخاب‌شده</span><h3>{active.name}</h3>
     <p>{active.code==='cima'?'۷ فاز و ۷۲ زیرقابلیت مطابق سند رسمی CIMA Intelligence':active.tracked?'نقشهٔ توسعهٔ ثبت‌شده برای این محصول':'ابتدا فازها و زیرقابلیت‌های توسعهٔ این محصول را اضافه کنید.'}</p></div>
    <div className="dev-highlights">
     <div><small>پیشرفت وزنی</small><strong>{active.totals?fa(active.totals.score)+'٪':'—'}</strong><Meter value={active.totals?.score||0}/></div>
     <div><small>پیاده‌سازی</small><strong>{active.totals?fa(active.totals.implementation)+'٪':'—'}</strong><Meter value={active.totals?.implementation||0}/></div>
     <div><small>آمادگی عملیاتی</small><strong>{active.totals?fa(active.totals.readiness)+'٪':'—'}</strong><Meter value={active.totals?.readiness||0}/></div>
    </div>
   </div>
   <div className="dev-toolbar"><div><BookOpen size={16}/><span>{fa(phases.length)} فاز · {fa(allFeatures)} زیرقابلیت</span>
    {active.auditDate&&<small>مبنای ممیزی: {active.auditDate}</small>}</div>
    <input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="جست‌وجوی زیرقابلیت…" aria-label="جست‌وجوی زیرقابلیت"/>
    {active.code!=='cima'&&<button type="button" className="dev-action secondary" onClick={()=>setAddOpen(v=>!v)}><Plus size={16}/> افزودن معیار توسعه</button>}
   </div>
   {addOpen&&active.code!=='cima'&&<form className="dev-form" onSubmit={addFeature}>
    <h4>افزودن زیرقابلیت به {active.name}</h4><p>مسیر کد و تست در GitHub اختیاری است، اما بدون شواهد کافی درصد خودکار افزایش پیدا نمی‌کند.</p>
    <div className="dev-form-grid"><label>فاز<select value={pickedPhase} onChange={e=>setPickedPhase(e.target.value)}><option value="new">فاز جدید</option>{phases.map(p=><option key={p.key} value={p.key}>{p.name}</option>)}</select></label>
     {pickedPhase==='new'&&<><label>عنوان فاز<input required value={newItem.phaseTitle} onChange={e=>setNewItem(v=>({...v,phaseTitle:e.target.value}))} placeholder="مثلاً پایش و تحلیل"/></label>
     <label>سهم فاز در محصول<input required min="1" max="100" type="number" value={newItem.phaseWeight} onChange={e=>setNewItem(v=>({...v,phaseWeight:Number(e.target.value)}))}/></label></>}
     <label>عنوان زیرقابلیت<input required maxLength={240} value={newItem.label} onChange={e=>setNewItem(v=>({...v,label:e.target.value}))} placeholder="مثلاً همگام‌سازی موجودی"/></label>
     <label>وزن زیرقابلیت در فاز<input type="number" min="1" max="100" value={newItem.weight} onChange={e=>setNewItem(v=>({...v,weight:Number(e.target.value)}))}/></label>
     <label>مسیر فایل‌های مرتبط در GitHub<input dir="ltr" value={newItem.sourcePaths} onChange={e=>setNewItem(v=>({...v,sourcePaths:e.target.value}))} placeholder="app/api/example/route.js"/></label>
     <label>مسیر تست مرتبط<input dir="ltr" value={newItem.testPaths} onChange={e=>setNewItem(v=>({...v,testPaths:e.target.value}))} placeholder="tests/example.test.mjs"/></label></div>
    <div className="dev-form-actions"><button disabled={saving} type="submit" className="dev-action"><Save size={15}/> ذخیرهٔ معیار</button><button type="button" onClick={()=>setAddOpen(false)}>انصراف</button></div>
   </form>}
   {!phases.length?<div className="dev-empty"><Layers3 size={28}/><h4>هنوز ممیزی توسعه تعریف نشده است</h4><p>برای این محصول امتیاز حدسی نمایش داده نمی‌شود. با افزودن نخستین فاز و زیرقابلیت، رصد پیشرفت آن آغاز خواهد شد.</p></div>:
   <div className="dev-phases">{filtered.map(phase=><section className="dev-phase" key={phase.key||phase.number}>
    <button type="button" className="dev-phase-head" aria-expanded={expanded===String(phase.key||'p'+phase.number)} onClick={()=>setExpanded(v=>v===String(phase.key||'p'+phase.number)?'':String(phase.key||'p'+phase.number))}>
     <span className="dev-phase-count">{active.code==='cima'?'۰'+phase.number:fa(phases.indexOf(phase)+1)}</span>
     <span className="dev-phase-name"><strong>{phase.name}</strong><small>{fa(phase.features.length)} زیرقابلیت · سهم {fa(phase.weight)}٪</small></span>
     <span className="dev-phase-status"><strong>{fa(phase.score)}٪</strong><Meter value={phase.score}/></span>
     {expanded===String(phase.key||'p'+phase.number)?<ChevronUp size={17}/>:<ChevronDown size={17}/>}
    </button>
    {expanded===String(phase.key||'p'+phase.number)&&<div className="dev-phase-body">
     <div className="dev-legend"><span>زیرقابلیت / وزن</span><span>ساخت</span><span>عملیات</span><span>نهایی</span><span>مدرک و بررسی</span></div>
     {phase.visible.map(f=><div className="dev-feature" key={f.id}>
      <div className="dev-feature-name"><strong>{f.label}</strong><small>وزن {fa(f.weight)}٪ {f.autoVerified&&<em>· تغییر تأییدشده در نسخهٔ فعال</em>}</small></div>
      <span className="dev-data-cell">{fa(f.implementation)}٪</span><span className="dev-data-cell">{fa(f.readiness)}٪</span>
      <div className="dev-data-cell final"><b>{fa(f.score)}٪</b><Meter value={f.score}/></div>
      <div className="dev-feature-proof"><div>{f.sourcePaths?.slice(0,2).map(path=><a key={path} href={'https://github.com/maxjomeh/delsa/blob/'+(data.evidence.productionSha||data.baselineSha)+'/'+path} target="_blank" rel="noreferrer" title={path}>کد <ArrowUpLeft size={11}/></a>)}
       {f.testPaths?.slice(0,1).map(path=><a key={path} href={'https://github.com/maxjomeh/delsa/blob/'+(data.evidence.productionSha||data.baselineSha)+'/'+path} target="_blank" rel="noreferrer" title={path}>تست <ArrowUpLeft size={11}/></a>)}</div>
       <button type="button" onClick={()=>edit(f)}>ثبت ارزیابی</button>
      </div>
     </div>)}
     {phase.visible.length===0&&<p className="dev-empty-sub">موردی با این جست‌وجو پیدا نشد.</p>}
    </div>}
   </section>)}</div>}
   {editing&&<div className="dev-dialog-backdrop" role="presentation" onClick={()=>setEditing(null)}><form className="dev-dialog" role="dialog" aria-modal="true" aria-label="ثبت ممیزی زیرقابلیت" onClick={e=>e.stopPropagation()} onSubmit={submitReview}>
    <div className="dev-dialog-title"><div><small>ارزیابی مستند قابلیت</small><h4>{editing.label}</h4></div><button type="button" onClick={()=>setEditing(null)} aria-label="بستن"><X size={17}/></button></div>
    <p>این بخش یک تأیید انسانیِ مستند است. بدون بررسی واقعی Production، عدد آمادگی را افزایش ندهید.</p>
    <div className="dev-form-grid"><label>پیاده‌سازی (۰ تا ۱۰۰)<input type="number" min="0" max="100" value={scores.implementation} onChange={e=>setScores(s=>({...s,implementation:Number(e.target.value)}))}/></label>
     <label>آمادگی عملیاتی (۰ تا ۱۰۰)<input type="number" min="0" max="100" value={scores.readiness} onChange={e=>setScores(s=>({...s,readiness:Number(e.target.value)}))}/></label></div>
    <label className="dev-note">شواهد / دلیل تغییر<textarea required minLength={8} maxLength={2000} rows={4} value={scores.notes} onChange={e=>setScores(s=>({...s,notes:e.target.value}))} placeholder="نام تست، نتیجهٔ واقعی، لینک PR یا علت باقی‌ماندن نقص…"/></label>
    <div className="dev-form-actions"><button type="submit" className="dev-action" disabled={saving}><Save size={15}/> ثبت ارزیابی</button><button type="button" onClick={()=>setEditing(null)}>انصراف</button></div>
   </form></div>}
   <p className="dev-footnote"><ShieldCheck size={16}/> امتیاز هر فاز حاصل وزن زیرقابلیت‌هاست؛ ۴۵٪ ساخت و ۵۵٪ آمادگی عملیاتی. تأیید CI فقط امتیاز محدود شواهد فنی می‌دهد و جای تست واقعی، کیفیت ML یا تحویل پیام را نمی‌گیرد.</p>
   </>}
  </>}
 </section>;
}
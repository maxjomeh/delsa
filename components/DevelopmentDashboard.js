'use client';
import {useCallback,useEffect,useState} from 'react';
import {AlertTriangle,Activity,ArrowUpLeft,CheckCircle2,GitBranch,Layers3,RefreshCw,Save,ShieldCheck,X} from 'lucide-react';
import DevOSUnifiedTree from './DevOSUnifiedTree';
import './DevelopmentDashboard.css';
const fa=n=>Number(n||0).toLocaleString('fa-IR',{maximumFractionDigits:1});
const short=s=>s?s.slice(0,8):'نامشخص';
async function api(body){
 const response=await fetch('/api/admin/development',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'}:{cache:'no-store'});
 const data=await response.json().catch(()=>({error:'invalid_response'}));
 if(!response.ok)throw Error(data.error||'خطا در دریافت گزارش توسعه');
 return data;
}
const empty={phaseTitle:'',label:'',sourcePaths:'',testPaths:'',phaseWeight:20,weight:10};
export default function DevelopmentDashboard(){
 const [data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [editing,setEditing]=useState(null),[scores,setScores]=useState({implementation:0,readiness:0,notes:''});
 const [addOpen,setAddOpen]=useState(false),[newItem,setNewItem]=useState(empty),[productCode,setProductCode]=useState(''),[pickedPhase,setPickedPhase]=useState('new'),[saving,setSaving]=useState(false);
 const load=useCallback(async(sync=false)=>{
  setBusy(true);setError('');
  try{setData(await api(sync?{action:'sync'}:null))}
  catch(e){setError(e.message||'خطای ارتباط با سیستم ممیزی');if(sync){try{setData(await api(null))}catch{}}}
  finally{setBusy(false)}
 },[]);
 useEffect(()=>{load(true);const t=setInterval(()=>{if(document.visibilityState==='visible')load(true)},300000);return()=>clearInterval(t)},[load]);
 const products=data?.products||[];
 const target=products.find(p=>p.code===productCode);
 const phases=target?.phases||[];
 const selectedPhase=phases.find(p=>String(p.key||'p'+p.number)===pickedPhase);
 const addFeature=(code,phaseKey)=>{
  const p=products.find(p=>p.code===code);
  if(!p)return;
  if(code==='cima'){setNotice('فازهای اصلی سیما مطابق Blueprint ثابت هستند؛ برای توسعهٔ جدید، در همان گره تسک یا زیرتسک اضافه کن.');return}
  setProductCode(code);setPickedPhase(phaseKey||'new');setNewItem(empty);setAddOpen(true);setEditing(null);
 };
 const review=(feature,code)=>{
  setEditing({...feature,productCode:code});
  setScores({implementation:feature.implementation,readiness:feature.readiness,notes:feature.reviewNote||feature.notes||''});
  setAddOpen(false);
 };
 const saveReview=async event=>{
  event.preventDefault();if(!editing)return;
  setSaving(true);setError('');
  try{
   const action=editing.productCode==='cima'?'review_cima':'review_custom';
   await api({action,id:editing.id,productCode:editing.productCode,implementation:Number(scores.implementation),readiness:Number(scores.readiness),notes:scores.notes});
   setEditing(null);setNotice('ارزیابی مستند ثبت شد؛ امتیاز عملیات فقط با شاهد واقعی باید تغییر کند.');await load(false);
  }catch(e){setError(e.message)}finally{setSaving(false)}
 };
 const saveFeature=async event=>{
  event.preventDefault();if(!target||target.code==='cima')return;
  setSaving(true);setError('');
  try{
   const phaseKey=selectedPhase?String(selectedPhase.key||'p'+selectedPhase.number):'phase_'+Date.now().toString(36);
   const featureKey='feature_'+Date.now().toString(36);
   await api({action:'add_feature',productCode:target.code,phaseKey,phaseTitle:selectedPhase?selectedPhase.name:newItem.phaseTitle,
    phaseWeight:selectedPhase?Number(selectedPhase.weight):Number(newItem.phaseWeight),
    featureKey,label:newItem.label,weight:Number(newItem.weight),
    sourcePaths:newItem.sourcePaths.split(/[،,\n]/).map(s=>s.trim()).filter(Boolean),
    testPaths:newItem.testPaths.split(/[،,\n]/).map(s=>s.trim()).filter(Boolean)});
   setAddOpen(false);setNewItem(empty);setNotice('فاز یا قابلیت در همان درخت توسعه ثبت شد.');await load(false);
  }catch(e){setError(e.message)}finally{setSaving(false)}
 };
 return <section className="dev-root" dir="rtl" aria-label="مرکز توسعهٔ یکپارچهٔ دلسا">
  <div className="dev-top"><div><span className="dev-kicker"><Layers3 size={15}/> DELSA DEVELOPMENT SYSTEM</span>
   <h2>مرکز یکپارچهٔ توسعهٔ دلسا</h2><p>یک ساختار برای محصول، فاز، قابلیت، تسک و همهٔ زیرسطوح؛ Sprint تنها ابزار زمان‌بندی است.</p></div>
   <button className="dev-action" type="button" onClick={()=>load(true)} disabled={busy}><RefreshCw size={15}/> {busy?'در حال بررسی…':'به‌روزرسانی شواهد ممیزی'}</button>
  </div>
  {error&&<div className="dev-banner is-error" role="alert"><AlertTriangle size={17}/>{error}</div>}
  {notice&&<div className="dev-banner is-success" role="status"><CheckCircle2 size={17}/>{notice}</div>}
  {data?.evidence&&<div className="dev-release">
   <div className="dev-release-title"><GitBranch size={17}/><strong>منبع شواهد و نسخهٔ فعال</strong></div>
   <div className="dev-release-cells">
    <span><small>Production SHA</small><b dir="ltr">{short(data.evidence.productionSha)}</b></span>
    <span><small>CI</small><b>{data.evidence.ciState==='passed'?'موفق':data.evidence.ciState==='failed'?'ناموفق':data.evidence.ciState==='pending'?'در جریان':'تأیید نشده'}</b></span>
    <span><small>مبنای ممیزی</small><b>{data.evidence.status==='verified_ci_and_release'?'شواهد قابل محاسبه':data.evidence.status==='baseline'?'نسخهٔ مبنا':'نیازمند بررسی'}</b></span>
    <span><small>فایل‌های تغییرکرده</small><b>{fa(data.evidence.changedCount)}</b></span>
   </div>
   {data.evidence.productionSha&&<a target="_blank" rel="noreferrer" href={'https://github.com/maxjomeh/delsa/commit/'+data.evidence.productionSha}>مشاهدهٔ Commit <ArrowUpLeft size={12}/></a>}
  </div>}
  <DevOSUnifiedTree products={products} onReviewFeature={review} onAddFeature={addFeature}/>
  {Array.isArray(data?.telemetry)&&<details className="dev-telemetry"><summary className="dev-telemetry-head"><Activity size={15}/><strong>مشاهدهٔ شاخص‌های عملیاتی Supabase</strong><small>آمار رکوردها؛ نه نتیجهٔ تست واقعی</small></summary>
   <div className="dev-telemetry-grid">{data.telemetry.map(x=><div key={x.table}><small>{x.label}</small><strong>{x.count===null?'—':fa(x.count)}</strong></div>)}</div>
  </details>}
  {addOpen&&target&&<div className="dev-dialog-backdrop" role="presentation" onClick={()=>setAddOpen(false)}>
   <form className="dev-dialog" role="dialog" aria-modal="true" aria-label="ثبت قابلیت محصول" onClick={e=>e.stopPropagation()} onSubmit={saveFeature}>
    <div className="dev-dialog-title"><div><small>قابلیت جدید در درخت واحد</small><h4>{target.name}</h4></div><button type="button" onClick={()=>setAddOpen(false)} aria-label="بستن"><X size={17}/></button></div>
    <div className="dev-form-grid">
     <label>فاز<select value={pickedPhase} onChange={e=>setPickedPhase(e.target.value)}><option value="new">فاز جدید</option>{phases.map(p=><option value={String(p.key||'p'+p.number)} key={String(p.key||p.number)}>{p.name}</option>)}</select></label>
     {!selectedPhase&&<><label>عنوان فاز<input required maxLength={160} value={newItem.phaseTitle} onChange={e=>setNewItem(s=>({...s,phaseTitle:e.target.value}))}/></label>
      <label>سهم فاز (٪)<input required type="number" min="1" max="100" value={newItem.phaseWeight} onChange={e=>setNewItem(s=>({...s,phaseWeight:Number(e.target.value)}))}/></label></>}
     <label>عنوان قابلیت<input required maxLength={240} value={newItem.label} onChange={e=>setNewItem(s=>({...s,label:e.target.value}))}/></label>
     <label>وزن در فاز<input required type="number" min="1" max="100" value={newItem.weight} onChange={e=>setNewItem(s=>({...s,weight:Number(e.target.value)}))}/></label>
     <label>مسیر کد<input dir="ltr" value={newItem.sourcePaths} onChange={e=>setNewItem(s=>({...s,sourcePaths:e.target.value}))}/></label>
     <label>مسیر تست<input dir="ltr" value={newItem.testPaths} onChange={e=>setNewItem(s=>({...s,testPaths:e.target.value}))}/></label>
    </div><div className="dev-form-actions"><button type="submit" className="dev-action" disabled={saving}><Save size={15}/> ذخیره</button><button type="button" onClick={()=>setAddOpen(false)}>انصراف</button></div>
   </form>
  </div>}
  {editing&&<div className="dev-dialog-backdrop" role="presentation" onClick={()=>setEditing(null)}>
   <form className="dev-dialog" role="dialog" aria-modal="true" aria-label="ثبت ممیزی قابلیت" onClick={e=>e.stopPropagation()} onSubmit={saveReview}>
    <div className="dev-dialog-title"><div><small>ارزیابی مستند زیرقابلیت</small><h4>{editing.label}</h4></div><button type="button" onClick={()=>setEditing(null)} aria-label="بستن"><X size={17}/></button></div>
    <p>برای افزایش آمادگی عملیاتی، شواهد آزمون واقعی Production لازم است.</p>
    <div className="dev-form-grid">
     <label>پیاده‌سازی (٪)<input required type="number" min="0" max="100" value={scores.implementation} onChange={e=>setScores(s=>({...s,implementation:Number(e.target.value)}))}/></label>
     <label>آمادگی عملیاتی (٪)<input required type="number" min="0" max="100" value={scores.readiness} onChange={e=>setScores(s=>({...s,readiness:Number(e.target.value)}))}/></label>
    </div><label className="dev-note">شواهد و دلیل تغییر<textarea required minLength={8} maxLength={2000} rows={4} value={scores.notes} onChange={e=>setScores(s=>({...s,notes:e.target.value}))}/></label>
    <div className="dev-form-actions"><button type="submit" disabled={saving} className="dev-action"><Save size={15}/> ثبت ممیزی</button><button type="button" onClick={()=>setEditing(null)}>انصراف</button></div>
   </form>
  </div>}
  <p className="dev-footnote"><ShieldCheck size={16}/> امتیاز ممیزی (۴۵٪ پیاده‌سازی، ۵۵٪ آمادگی عملیاتی) از تکمیل تسک‌ها جداست و فقط بر اساس شواهد معتبر تغییر می‌کند.</p>
 </section>;
}

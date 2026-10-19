'use client';
import {useEffect,useState} from 'react';
import {BrainCircuit,Check,X,RotateCw,ChevronDown} from 'lucide-react';
import styles from './CustomerIntelligence.module.css';
const labels={phone:'شماره تماس',truck_model:'مدل کشنده',new_field:'پیشنهاد فیلد جدید'};
export default function LearningPanel({onRefresh}){
 const [items,setItems]=useState([]);
 const [expanded,setExpanded]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 useEffect(()=>{let active=true;fetch('/api/crm/learning',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(j=>{if(active&&j)setItems(j.suggestions||[]);}).catch(()=>{});return()=>{active=false;};},[]);
 const pending=items.filter(x=>x.status==='pending');
 async function act(payload){
  if(busy)return;setBusy(true);setError('');setNotice('');
  try{
   const r=await fetch('/api/crm/learning',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const j=await r.json();if(!r.ok)throw Error(j.error||'خطا در پردازش');
   setItems(j.suggestions||[]);
   setNotice(payload.action==='analyze'?Number(j.created||0).toLocaleString('fa-IR')+' پیشنهاد جدید ساخته شد.':'تصمیم شما ثبت شد.');
   if(payload.action!=='analyze')onRefresh?.();
  }catch(e){setError(e.message||'دوباره تلاش کنید.');}
  finally{setBusy(false);}
 }
 return <section className={styles.learnPanel} aria-label="یادگیری اطلاعات مشتری">
  <div className={styles.learnHead}><div><span><BrainCircuit size={19}/> الگوهای یادگیری سیما</span><p>استخراج اطلاعات از مکالمات و پیشنهاد فیلدهای جدید با ذکر منبع و امتیاز اطمینان</p></div>
   <button type="button" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded}><ChevronDown size={15}/> {pending.length.toLocaleString('fa-IR')} مورد بررسی</button>
  </div>
  {expanded&&<div className={styles.learnBody}>
   <button type="button" disabled={busy} onClick={()=>act({action:'analyze'})}><RotateCw size={15}/> {busy?'در حال تحلیل…':'تحلیل مجدد گفتگوهای ثبت‌شده'}</button>
   <p>اطلاعات پیشنهادی تا زمان تأیید قطعی نمی‌شوند. شماره تماس‌های بدون قرینهٔ کافی، نیازمند بررسی دستی هستند. این نسخه از قواعد توضیح‌پذیر استفاده می‌کند؛ مدل یادگیری عمیق هنوز فعال نیست.</p>
   {error&&<p role="alert">{error}</p>}
   {notice&&<p role="status">{notice}</p>}
   {pending.map(x=><article className={styles.learnItem} key={x.id}>
    <div><strong>{labels[x.kind]||x.kind}: {x.proposed_value}</strong><small>اطمینان: {(Number(x.confidence)*100).toLocaleString('fa-IR',{maximumFractionDigits:1})}٪ · پشتیبانی: {Number(x.support_count).toLocaleString('fa-IR')}</small><p>شاهد مکالمه: «{x.evidence_quote}»</p></div>
    <div><button disabled={busy||(x.kind==='phone'&&Number(x.confidence)<.9)} type="button" onClick={()=>act({action:'accept',id:x.id})}><Check size={14}/> تأیید</button><button disabled={busy} type="button" onClick={()=>act({action:'reject',id:x.id})}><X size={14}/> رد</button></div>
   </article>)}
   {!pending.length&&<p>پیشنهاد بررسی‌نشده‌ای وجود ندارد. می‌توانی تحلیل مکالمات را اجرا کنی.</p>}
  </div>}
 </section>;
}

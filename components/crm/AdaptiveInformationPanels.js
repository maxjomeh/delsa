'use client';
import {useEffect,useMemo,useState} from 'react';
import {profileValue,present} from './information';
import styles from './SimaWorkspace.module.css';
const n=x=>Number(x||0).toLocaleString('fa-IR');
const val=v=>Array.isArray(v)?v.join('، '):typeof v==='string'||typeof v==='number'?String(v):'';
export function CustomerFieldMatrix({customers,fields,states,onEditCustomer,onShowReview}){
 const [search,setSearch]=useState(''),[page,setPage]=useState(0);
 const active=fields.filter(f=>f.enabled&&(!f.key.startsWith('learned_')||!f.label.startsWith('اطلاعات '))).slice(0,35);
 const statesMap=useMemo(()=>new Map(states.map(s=>[s.customer_id+':'+s.field_id,s])),[states]);
 const rows=customers.filter(c=>(c.name+' '+c.phone+' '+(c.instagram||c.custom_fields?.social_username||'')).toLocaleLowerCase('fa-IR').includes(search.toLocaleLowerCase('fa-IR')));
 const result=rows.slice(page*40,(page+1)*40);
 return <section className={styles.panel}><h3>جدول اطلاعات مشتریان</h3>
 <p>فیلدهای اختصاصی برای تمام مشتریان نمایش داده می‌شوند. داده‌های پیشنهادی تا تأیید صاحب کسب‌وکار قطعی نیستند.</p>
 <div className={styles.toolbar}><input value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} placeholder="نام، شماره یا شناسهٔ مشتری…"/>
 <span>{n(rows.length)} مشتری · {n(active.length)} ستون فعال</span><button onClick={onShowReview}>بررسی اطلاعات پیشنهادی</button></div>
 <div style={{width:'100%',overflowX:'auto'}}><table style={{borderCollapse:'collapse',minWidth:'100%',width:'max-content'}}>
 <thead><tr><th>مشتری</th><th>تلفن</th><th>شناسهٔ شبکه</th>{active.map(f=><th key={f.id}>{f.label}</th>)}</tr></thead>
 <tbody>{result.map(c=><tr key={c.id}><td><button onClick={()=>onEditCustomer(c.id)}>{c.name}</button></td>
 <td dir="ltr">{c.phone||'—'}</td><td dir="ltr">{c.instagram||c.custom_fields?.social_username||'—'}</td>
 {active.map(f=>{const state=statesMap.get(c.id+':'+f.id),value=profileValue(c,f);
 return <td key={f.id} title={state?.source_quote||''} style={{padding:'9px 12px',borderBottom:'1px solid var(--line)',minWidth:130}}>
 {state?.status==='review'?<span style={{color:'var(--accent)'}}>منتظر تأیید</span>
 :present(value)?<span>{val(value)}{state?.status!=='confirmed'&&<small> · تأییدنشده</small>}</span>:'—'}</td>;})}</tr>)}</tbody></table></div>
 <div className={styles.toolbar}><button disabled={!page} onClick={()=>setPage(Math.max(0,page-1))}>قبلی</button>
 <span>{n(page+1)} / {n(Math.max(1,Math.ceil(rows.length/40)))}</span>
 <button disabled={(page+1)*40>=rows.length} onClick={()=>setPage(page+1)}>بعدی</button></div></section>;
}
export function LearningSuggestionPanel({customers,onRefresh}){
 const [items,setItems]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const names=useMemo(()=>new Map(customers.map(c=>[c.id,c.name])),[customers]);
 async function load(){const r=await fetch('/api/crm/learning',{cache:'no-store'}),j=await r.json();if(!r.ok)throw Error(j.error);setItems(j.proposals||[]);}
 useEffect(()=>{let active=true;fetch('/api/crm/learning',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(j=>{if(active&&j)setItems(j.proposals||[])}).catch(()=>{});return()=>{active=false}},[]);
 async function run(){
  setBusy(true);setError('');setNotice('');
  try{const r=await fetch('/api/crm/intelligence',{method:'POST'}),j=await r.json();
   if(!r.ok)throw Error(j.error);await load();
   setNotice(n(j.messagesAnalyzed)+' پیام بررسی شد؛ '+n((j.phoneProposals||0)+(j.fieldProposals||0))+' پیشنهاد جدید ثبت شد.');}
  catch(e){setError(e.message||'learning_failed');}finally{setBusy(false);}
 }
 async function review(item,action){
  setBusy(true);setError('');setNotice('');
  try{const r=await fetch('/api/crm/learning',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id,action})}),j=await r.json();
   if(!r.ok)throw Error(j.error);await load();await onRefresh?.();setNotice('تصمیم ثبت شد.');}
  catch(e){setError(e.message||'review_failed');}finally{setBusy(false);}
 }
 const pending=items.filter(x=>x.status==='pending');
 return <section className={styles.panel}><h3>یادگیری سیما از مکالمات</h3>
  <p>هر ۳۰ دقیقه استخراج شواهد صریح انجام می‌شود. برای تحلیل پرسش‌های تکراری در چت‌های قدیمی نیز این دکمه را بزن. هیچ فیلد یا مقداری بدون تأیید ثبت قطعی نمی‌شود.</p>
  <div className={styles.toolbar}><button disabled={busy} onClick={run}>{busy?'در حال پردازش…':'تحلیل چت‌های قدیمی و جدید'}</button><span>{n(pending.length)} پیشنهاد در انتظار</span></div>
  {error&&<p role="alert" className={styles.error}>{error}</p>}{notice&&<p role="status">{notice}</p>}
  <div className={styles.records}>{pending.map(x=><article key={x.id}><div>
  <strong>{({phone:'شماره تماس',truck_model:'مدل کشنده',new_field:'فیلد پیشنهادی'})[x.kind]||x.kind} · {x.proposed_value}</strong>
  <small>{names.get(x.customer_id)||'الگوی چند مشتری'} · پشتیبانی: {n(x.support_count)}</small>
  <blockquote>{x.evidence_quote}</blockquote>
  <small>امتیاز اولیهٔ شواهد {n(Math.round(Number(x.confidence)*100))} از ۱۰۰؛ هنوز کالیبره نشده است.</small>
  <div className={styles.actions}>
   {(x.kind==='phone'&&Number(x.confidence)>=.9||x.kind==='truck_model'||x.kind==='new_field'&&x.field_key==='truck_model'&&x.support_count>=3)&&<button disabled={busy} onClick={()=>review(x,'accept')}>تأیید</button>}
   <button disabled={busy} onClick={()=>review(x,'reject')}>رد</button></div>
  </div></article>)}{!pending.length&&<div className={styles.empty}>پیشنهاد بررسی‌نشده‌ای وجود ندارد.</div>}</div>
 </section>;
}

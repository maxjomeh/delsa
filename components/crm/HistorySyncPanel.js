'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {DatabaseZap,RefreshCw,Sparkles,CheckCircle2,AlertCircle} from 'lucide-react';
import styles from './HistorySyncPanel.module.css';

const sum=(jobs,key)=>(jobs||[]).reduce((n,j)=>n+Number(j[key]||0),0);
export default function HistorySyncPanel({onRefresh}){
 const [jobs,setJobs]=useState([]);
 const [loading,setLoading]=useState(true);
 const [running,setRunning]=useState(false);
 const [learning,setLearning]=useState(false);
 const [result,setResult]=useState(null);
 const [error,setError]=useState('');
 const cancelled=useRef(false);
 const onRefreshRef=useRef(onRefresh);onRefreshRef.current=onRefresh;
 const fetcher=useCallback(async(action)=>{
  const response=await fetch('/api/crm/zernio/history',action?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action}),cache:'no-store'}:{cache:'no-store'});
  const json=await response.json();
  if(!response.ok)throw new Error(json.error||'خطا در همگام‌سازی تاریخچه');
  setJobs(json.jobs||[]);return json.jobs||[];
 },[]);
 const train=useCallback(async()=>{
  setLearning(true);
  try{
   const r=await fetch('/api/crm/intelligence',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
   const info=await r.json();
   if(!r.ok)throw new Error(info.error||'یادگیری انجام نشد');
   if(!cancelled.current){setResult(info);await onRefreshRef.current?.();}
  }catch(e){if(!cancelled.current)setError(e.message);}finally{if(!cancelled.current)setLearning(false);}
 },[]);
 const runLoop=useCallback(async(first)=>{
  if(!first?.some(x=>x.status==='queued'||x.status==='running'||x.status==='error'))return;
  setRunning(true);
  let previous=0,current=first;
  for(let count=0;count<2500&&!cancelled.current;count++){
   if(!current.some(x=>x.status==='queued'||x.status==='running'))break;
   try{current=await fetcher('step');}
   catch(e){if(!cancelled.current)setError(e.message);break;}
   if(++previous%6===0&&!cancelled.current)await onRefreshRef.current?.();
   if(count%3===0)await new Promise(resolve=>setTimeout(resolve,250));
  }
  if(!cancelled.current){
   setRunning(false);
   await onRefreshRef.current?.();
   if(current.length&&current.every(x=>x.status==='complete'))await train();
  }
 },[fetcher,train]);
 useEffect(()=>{
  cancelled.current=false;
  (async()=>{
   try{
    let current=await fetcher();
    if(!current.length)current=await fetcher('start'); // First sweep begins automatically.
    if(!cancelled.current)await runLoop(current);
   }catch(e){if(!cancelled.current)setError(e.message);}
   finally{if(!cancelled.current)setLoading(false);}
  })();
  return()=>{cancelled.current=true;};
 },[fetcher,runLoop]);
 async function restart(){
  if(running||learning)return;
  setError('');setResult(null);
  try{const next=await fetcher('start');await runLoop(next);}catch(e){setError(e.message);}
 }
 const complete=jobs.length>0&&jobs.every(x=>x.status==='complete');
 return <div className={styles.panel}>
  <div className={styles.header}>
   <span className={styles.icon}><DatabaseZap size={21}/></span>
   <div><strong>حافظهٔ مکالمات سیما</strong><p>بازخوانی پیام‌های قدیمی و استخراج نیازها از تمام مکالمات قابل‌دسترسی</p></div>
   {complete?<span className={styles.done}><CheckCircle2 size={14}/> تکمیل</span>:running?<span className={styles.live}><RefreshCw size={14}/> در حال همگام‌سازی</span>:null}
  </div>
  <div className={styles.metrics}><span>گفت‌وگوهای بررسی‌شده <b>{sum(jobs,'completedConversations').toLocaleString('fa-IR')}</b></span><span>پیام‌های دریافت‌شده <b>{sum(jobs,'importedMessages').toLocaleString('fa-IR')}</b></span><span>حساب‌های اجتماعی <b>{jobs.length.toLocaleString('fa-IR')}</b></span></div>
  <div className={styles.actions}>
   <button type="button" disabled={running||loading||learning} onClick={restart}><RefreshCw size={15}/> بازخوانی دوبارهٔ تاریخچه</button>
   <button type="button" disabled={running||learning} onClick={()=>{setError('');train();}}><Sparkles size={15}/> یادگیری از چت‌ها</button>
  </div>
  {result&&<p className={styles.result}>تحلیل {result.messagesAnalyzed.toLocaleString('fa-IR')} پیام · {result.phoneUpdates.toLocaleString('fa-IR')} شمارهٔ تأییدشده از متن · {result.newFields.toLocaleString('fa-IR')} فیلد جدید · {result.extractions.toLocaleString('fa-IR')} مقدار پیشنهادی برای بررسی</p>}
  {error&&<p role="alert" className={styles.error}><AlertCircle size={14}/> {error==='no_social_accounts_in_profile'?'ابتدا اینستاگرام کسب‌وکار را در بخش «اتصال‌ها» وصل کنید.':error==='zernio_messages_permission_required'?'کلید Zernio باید مجوز Messages داشته باشد.':error}</p>}
  <small>پیام‌های قدیمی تا سقف قابل‌دسترسی Zernio بارگذاری می‌شوند. فیلدهای یادگرفته‌شده با شواهد پیام ساخته می‌شوند؛ اطلاعات نامطمئن در بخش «اطلاعات جدید» برای بررسی قرار می‌گیرند.</small>
 </div>;
}

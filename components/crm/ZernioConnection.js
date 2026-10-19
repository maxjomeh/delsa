'use client';
import {useEffect,useState} from 'react';
import styles from './SimaWorkspace.module.css';

export default function ZernioConnection(){
 const [data,setData]=useState(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [history,setHistory]=useState(null);
 const [syncing,setSyncing]=useState(false);

 async function reload(){
  setLoading(true);
  try{
   const response=await fetch('/api/crm/zernio',{cache:'no-store'});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||'دریافت اطلاعات اتصال ممکن نیست.');
   setData(result);
   setError('');
   return result;
  }catch(e){
   setError(e.message||'دریافت اطلاعات اتصال ممکن نیست.');
   return null;
  }finally{setLoading(false);}
 }

 useEffect(()=>{
  let active=true;
  const params=new URLSearchParams(window.location.search);
  const returning=params.get('sima_section')==='connections'&&
   (params.has('connected')||params.has('error')||params.has('accountId'));
  async function load(){
   const result=await reload();
   if(!active||!returning)return;
   const connected=result?.accounts?.some(a=>a.platform==='instagram'&&a.connected);
   if(connected)setNotice('اتصال اینستاگرام تأیید شد؛ پیج در فهرست حساب‌های کسب‌وکار شما نمایش داده می‌شود.');
   else if(params.has('error'))setNotice('اتصال تکمیل نشد؛ می‌توانید دوباره تلاش کنید.');
   else setNotice('از صفحهٔ تأیید بازگشتید. اگر پیج هنوز دیده نمی‌شود، کمی بعد وضعیت را به‌روزرسانی کنید.');
  }
  load();
  fetch('/api/crm/zernio/history').then(r=>r.ok?r.json():null).then(r=>{if(active&&r)setHistory(r.sync);}).catch(()=>{});
  return()=>{active=false;};
 },[]);

 async function connectInstagram(){
  setBusy(true);
  setError('');
  setNotice('');
  try{
   // The backend verifies the logged-in tenant and subscription, provisions a
   // tenant-specific profile, and generates the OAuth link in one click.
   const response=await fetch('/api/crm/zernio',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'connect',platform:'instagram'})
   });
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||'شروع اتصال انجام نشد.');
   const url=new URL(result.url);
   if(url.protocol!=='https:'||url.username||url.password)throw new Error('لینک احراز هویت معتبر نیست.');
   window.location.assign(url.toString());
  }catch(e){
   setError(e.message||'شروع اتصال انجام نشد.');
   setBusy(false);
  }
 }

 async function syncHistory(){
  if(syncing)return;
  setSyncing(true);setError('');setNotice('');
  try{
   for(let i=0;i<20;i++){
    const response=await fetch('/api/crm/zernio/history',{method:'POST',headers:{'Content-Type':'application/json'}});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'بازیابی مکالمات متوقف شد.');
    setHistory({status:result.done?'completed':'running',conversations_scanned:result.conversations,messages_discovered:result.messages});
    if(result.done){setNotice('تاریخچهٔ قابل دریافت با موفقیت بازیابی شد.');break;}
    if(i===19)setNotice('۲۰ صفحه بررسی شد؛ برای ادامه دوباره روی دکمه کلیک کنید.');
   }
  }catch(e){setError(e.message||'بازیابی موقتاً متوقف شد؛ مجدداً تلاش کنید.');}
  finally{setSyncing(false);}
 }
 const ready=data?.enabled===true&&data?.entitled===true;
 const instagram=data?.accounts?.filter(a=>a.platform==='instagram')||[];
 return <div className={styles.panel}>
  <h3>اتصال اینستاگرام کسب‌وکار</h3>
  <p>پیج کاری خود را مستقیماً از همین داشبورد وصل کنید. با تأیید شما در صفحهٔ رسمی اینستاگرام، حساب فقط به فضای کسب‌وکار شما در سیما مرتبط می‌شود. رمز اینستاگرام را از شما نمی‌گیریم.</p>
  {loading&&<p role="status">در حال بررسی وضعیت اتصال…</p>}
  {error&&<p className={styles.error} role="alert">{error}</p>}
  {notice&&<p role="status">{notice}</p>}
  {data&&!data.enabled&&<div className={styles.connection}><strong>اتصال موقتاً غیرفعال است</strong><span>مدیر دلسا در حال آماده‌سازی سرویس اتصال است.</span></div>}
  {data&&!data.entitled&&<p role="status">برای استفاده از اتصال اینستاگرام، اشتراک فعال سیما لازم است.</p>}
  {ready&&<>
   <div className={styles.actions}>
    <button type="button" onClick={connectInstagram} disabled={busy||loading}>
     {busy?'در حال انتقال به اینستاگرام…':'اتصال اینستاگرام'}
    </button>
    <button type="button" disabled={busy||loading} onClick={()=>reload()}>به‌روزرسانی وضعیت</button>
   </div>
   <section className={styles.connection} aria-label="بازیابی تاریخچه قدیمی اینستاگرام">
    <strong>بازیابی مکالمات قبل از اتصال</strong>
    <span>Zernio پیام‌های تاریخی را جدا از Webhook ارائه می‌کند. می‌توانید تمام صفحات قابل دسترسی را بدون ایجاد رکورد تکراری وارد سیما کنید.</span>
    <span>مکالمات بررسی‌شده: {Number(history?.conversations_scanned||0).toLocaleString('fa-IR')} · پیام‌های یافت‌شده: {Number(history?.messages_discovered||0).toLocaleString('fa-IR')}</span>
    <button type="button" disabled={syncing||loading||history?.status==='completed'} onClick={syncHistory}>{syncing?'در حال بازیابی…':history?.status==='completed'?'بازیابی تکمیل شد':'شروع / ادامه بازیابی چت‌های قدیمی'}</button>
    <small>برای جلوگیری از محدودیت درخواست‌ها، بازیابی مرحله‌ای است. سقف بازیابی قدیمی Meta معمولاً ۵۰۰ مکالمه و ۵۰۰ پیام اخیر هر مکالمه است.</small>
   </section>
   <div className={styles.records}>
    {instagram.map(a=><article key={a.id}><div><strong dir="ltr">@{a.username||'Instagram'}</strong><small>{a.connected?'متصل به سیما':a.needsReconnect?'نیاز به اتصال مجدد':'اتصال غیرفعال'}</small></div></article>)}
    {!instagram.length&&<p>هنوز پیجی به کسب‌وکار شما وصل نشده است. با دکمهٔ «اتصال اینستاگرام» شروع کنید.</p>}
   </div>
  </>}
  <small>اتصال برای پیج‌های حرفه‌ای Business یا Creator پشتیبانی می‌شود. پیام‌های جدید در CRM ثبت می‌شوند؛ بازیابی قدیمی از دکمهٔ بالا انجام می‌شود. هیچ پاسخ خودکاری بدون بررسی اطمینان ارسال نمی‌شود. اگر همین پیج را قبلاً از روش قدیمی متصل کرده‌اید، پیش از اتصال دوباره وضعیت آن را با پشتیبانی دلسا بررسی کنید.</small>
 </div>;
}

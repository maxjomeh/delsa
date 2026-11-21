'use client';
import {useI18n} from '../i18n/I18nProvider';
import {tx} from '../../lib/i18n/config';
import {useEffect,useState} from 'react';
import styles from './SimaWorkspace.module.css';

export default function ZernioConnection(){
 const {t,intl}=useI18n();
 const [data,setData]=useState(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');

 async function reload(){
  setLoading(true);
  try{
   const response=await fetch('/api/crm/zernio',{cache:'no-store'});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||t('دریافت اطلاعات اتصال ممکن نیست.'));
   setData(result);
   setError('');
   return result;
  }catch(e){
   setError(t(e.message)||t('دریافت اطلاعات اتصال ممکن نیست.'));
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
   if(connected)setNotice(t('اتصال اینستاگرام تأیید شد؛ پیج در فهرست حساب‌های کسب‌وکار شما نمایش داده می‌شود.'));
   else if(params.has('error'))setNotice(t('اتصال تکمیل نشد؛ می‌توانید دوباره تلاش کنید.'));
   else setNotice(t('از صفحهٔ تأیید بازگشتید. اگر پیج هنوز دیده نمی‌شود، کمی بعد وضعیت را به‌روزرسانی کنید.'));
  }
  load();
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
   if(!response.ok)throw new Error(result.error||t('شروع اتصال انجام نشد.'));
   const url=new URL(result.url);
   if(url.protocol!=='https:'||url.username||url.password)throw new Error(t('لینک احراز هویت معتبر نیست.'));
   window.location.assign(url.toString());
  }catch(e){
   setError(t(e.message)||t('شروع اتصال انجام نشد.'));
   setBusy(false);
  }
 }

 const ready=data?.enabled===true&&data?.entitled===true;
 const instagram=data?.accounts?.filter(a=>a.platform==='instagram')||[];
 return <div className={styles.panel}>
  <h3>{t('اتصال اینستاگرام کسب‌وکار')}</h3>
  <p>{t('پیج کاری خود را مستقیماً از همین داشبورد وصل کنید. با تأیید شما در صفحهٔ رسمی اینستاگرام، حساب فقط به فضای کسب‌وکار شما در سیما مرتبط می‌شود. رمز اینستاگرام را از شما نمی‌گیریم.')}</p>
  {loading&&<p role="status">{t('در حال بررسی وضعیت اتصال…')}</p>}
  {error&&<p className={styles.error} role="alert">{error}</p>}
  {notice&&<p role="status">{notice}</p>}
  {data&&!data.enabled&&<div className={styles.connection}><strong>{t('اتصال موقتاً غیرفعال است')}</strong><span>{t('مدیر دلسا در حال آماده‌سازی سرویس اتصال است.')}</span></div>}
  {data&&!data.entitled&&<p role="status">{t('برای استفاده از اتصال اینستاگرام، اشتراک فعال سیما لازم است.')}</p>}
  {ready&&<>
   <div className={styles.actions}>
    <button type="button" onClick={connectInstagram} disabled={busy||loading}>
     {busy?t('در حال انتقال به اینستاگرام…'):t('اتصال اینستاگرام')}
    </button>
    <button type="button" disabled={busy||loading} onClick={()=>reload()}>{t('به‌روزرسانی وضعیت')}</button>
   </div>
   <div className={styles.records}>
    {instagram.map(a=><article key={a.id}><div><strong dir="ltr">@{a.username||'Instagram'}</strong><small>{a.connected?t('متصل به سیما'):a.needsReconnect?t('نیاز به اتصال مجدد'):t('اتصال غیرفعال')}</small></div></article>)}
    {!instagram.length&&<p>{t('هنوز پیجی به کسب‌وکار شما وصل نشده است. با دکمهٔ «اتصال اینستاگرام» شروع کنید.')}</p>}
   </div>
  </>}
  <small>{t('اتصال برای پیج‌های حرفه‌ای Business یا Creator پشتیبانی می‌شود. این مرحله دریافت مجوز و اتصال حساب است؛ پیام‌های دریافتی Zernio برای پروندهٔ همان کسب‌وکار وارد سیما می‌شوند. ارسال پاسخ فقط با تأیید انسان از بخش «نیازمند پاسخ شما» انجام می‌شود؛ پاسخ خودکار AI غیرفعال است. اگر همین پیج را قبلاً از روش قدیمی متصل کرده‌اید، پیش از اتصال دوباره وضعیت آن را با پشتیبانی دلسا بررسی کنید.')}</small>
 </div>;
}

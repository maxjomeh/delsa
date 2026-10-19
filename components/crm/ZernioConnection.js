'use client';
import {useEffect,useState} from 'react';
import styles from './SimaWorkspace.module.css';

const platforms=[{id:'instagram',name:'اینستاگرام'},{id:'facebook',name:'فیسبوک'}];
export default function ZernioConnection(){
 const [data,setData]=useState(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState('');
 const [error,setError]=useState('');
 async function reload(){
  setLoading(true);
  try{
   const response=await fetch('/api/crm/zernio',{cache:'no-store'});
   const value=await response.json();
   if(!response.ok)throw new Error(value.error||'دریافت اطلاعات ممکن نیست.');
   setData(value);setError('');
  }catch(e){setError(e.message||'دریافت اطلاعات ممکن نیست.');}
  finally{setLoading(false);}
 }
 useEffect(()=>{reload();},[]);
 async function connect(platform){
  setBusy(platform);setError('');
  try{
   const response=await fetch('/api/crm/zernio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'connect',platform})});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||'اتصال انجام نشد.');
   const url=new URL(result.url);
   if(url.protocol!=='https:')throw new Error('نشانی اتصال معتبر نیست.');
   window.location.assign(url.toString());
  }catch(e){setError(e.message||'اتصال انجام نشد.');setBusy('');}
 }
 const ready=!!data?.enabled&&!!data?.entitled;
 return <div className={styles.panel}>
  <h3>اتصال چندکاناله با Zernio</h3>
  <p>برای هر کسب‌وکار، پروفایل جداگانه ساخته می‌شود. شما در صفحهٔ رسمی شبکهٔ اجتماعی دسترسی را تأیید می‌کنید؛ سیما رمز شبکهٔ اجتماعی را دریافت نمی‌کند.</p>
  <p>این اتصال در مرحلهٔ آزمایشی است. دریافت رویدادها پس از نصب زیرساخت سرور و فعال‌سازی Webhook آغاز می‌شود؛ پاسخ‌گویی خودکار در این مرحله فعال نیست.</p>
  {loading&&<p role="status">در حال بررسی Zernio…</p>}
  {error&&<p role="alert" className={styles.error}>{error}</p>}
  {data&&!data.enabled&&<div className={styles.connection}><strong>در انتظار پیکربندی توسط دلسا</strong><span>کلید امن جدید، دیتابیس و تنظیمات سرور هنوز باید توسط مدیر پروژه فعال شوند.</span></div>}
  {data&&!data.entitled&&<p role="status">برای اتصال حساب‌ها اشتراک فعال سیما لازم است.</p>}
  {ready&&<><div className={styles.actions}>{platforms.map(p=><button key={p.id} type="button" disabled={!!busy} onClick={()=>connect(p.id)}>{busy===p.id?'در حال آماده‌سازی…':`اتصال ${p.name}`}</button>)}<button type="button" disabled={!!busy||loading} onClick={reload}>به‌روزرسانی وضعیت</button></div>
   <div className={styles.records}>{data.accounts?.map(a=><article key={a.id}><div><strong dir="ltr">@{a.username||a.platform}</strong><small>{a.platform} · {a.connected?'متصل':a.needsReconnect?'نیازمند اتصال مجدد':'وضعیت اتصال نامشخص'}</small></div></article>)}{!data.accounts?.length&&<p>هنوز حساب اجتماعی به پروفایل کسب‌وکار متصل نشده است.</p>}</div>
  </>}
  <small>واتساپ بیزینس و تلگرام بعد از تکمیل مسیر اتصال ویژهٔ هر پلتفرم به این بخش اضافه می‌شوند. اطلاعات اعضای باشگاه مشتریان بین حساب‌ها به‌صورت خودکار یکی فرض نمی‌شود.</small>
 </div>;
}

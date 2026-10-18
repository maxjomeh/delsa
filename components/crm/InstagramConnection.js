'use client';
import {useEffect,useState} from 'react';
import {grantFor,isUsableConnection} from '../../lib/crm/channel-hub.mjs';
import styles from './SimaWorkspace.module.css';
import hub from './ChannelHub.module.css';

const resultNames={
 connected:'اتصال اینستاگرام ثبت شد و دسترسی سیما فعال شد. دریافت زنده پس از تأیید و پیکربندی Meta قابل آزمایش است.',
 permission_pending:'پیج متصل شد، اما اعطای مجوز سیما ذخیره نشد. وضعیت پایگاه داده را بررسی و مجوز را فعال کنید.',
 cancelled:'اتصال توسط شما لغو شد.',
 failed:'اتصال کامل نشد؛ تنظیمات برنامه و دسترسی پیج را بررسی کنید.',
 invalid_state:'زمان درخواست اتصال به پایان رسیده؛ دوباره شروع کنید.',
 login_required:'برای تکمیل اتصال، وارد حساب خود شوید.',
 subscription_required:'اشتراک فعال سیما لازم است.',
 unconfigured:'تنظیمات اتصال هنوز آماده نیست.'
};
export default function InstagramConnection(){
 const [data,setData]=useState(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 async function load(){
  try{
   const r=await fetch('/api/channels',{cache:'no-store'});
   const value=await r.json();
   if(!r.ok)throw new Error(value.error||'وضعیت اتصال دریافت نشد.');
   setData(value);
  }catch(e){setError(e.message||'وضعیت اتصال دریافت نشد.');}
 }
 useEffect(()=>{load();},[]);
 async function connectOrDisconnect(action,id){
  setBusy(true);setError('');setNotice('');
  try{
   const r=await fetch('/api/crm/instagram',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,id})});
   const value=await r.json();
   if(!r.ok)throw new Error(value.error||'عملیات انجام نشد.');
   if(value.url){
    const url=new URL(value.url);
    if(url.protocol!=='https:'||url.hostname!=='www.instagram.com')throw new Error('نشانی اتصال معتبر نیست.');
    window.location.assign(value.url);return;
   }
   await load();
   setNotice('اتصال با موفقیت قطع شد؛ دریافت پیام متوقف شده است.');
  }catch(e){setError(e.message||'اتصال انجام نشد.');}
  finally{setBusy(false);}
 }
 async function setGrant(connectionId,allowed){
  setBusy(true);setError('');setNotice('');
  try{
   const r=await fetch('/api/channels',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'set_grant',connectionId,serviceCode:'crm',allowed})});
   const value=await r.json();
   if(!r.ok)throw new Error(value.error||'تغییر مجوز انجام نشد.');
   await load();
   setNotice(allowed?'مجوز دریافت پیام برای سیما فعال شد.':'مجوز سیما لغو شد؛ دریافت پیام‌های جدید برای سیما متوقف می‌شود.');
  }catch(e){setError(e.message||'ذخیره مجوز انجام نشد.');}
  finally{setBusy(false);}
 }
 const result=typeof window!=='undefined'?new URLSearchParams(window.location.search).get('sima_connection'):null;
 return <section className={styles.panel}>
  <div className={hub.head}><div>
   <span className={hub.eyebrow}>DELSA CHANNEL HUB</span>
   <h3>مرکز اتصال کانال‌ها</h3>
   <p>حساب اینستاگرام را یک‌بار به دلسا متصل کنید و مشخص کنید کدام محصول اجازه دریافت پیام دارد.</p>
  </div><span className={hub.status}>Instagram · رسمی</span></div>
  {resultNames[result]&&<p role="status">{resultNames[result]}</p>}
  {error&&<p role="alert" className={styles.error}>{error}</p>}
  {notice&&<p role="status">{notice}</p>}
  {!data&&!error&&<p role="status">در حال بررسی اتصال…</p>}
  {data&&<>
   <div className={styles.connection}>
    <strong>{data.configured?'پیکربندی OAuth آماده است':'راه‌اندازی Meta Developer تکمیل نشده است'}</strong>
    <span>{data.configured?'اتصال نیازمند تأیید حساب حرفه‌ای اینستاگرام و مجوز رسمی است.':'برای اتصال واقعی باید App ID، مجوزها، Webhook و کلیدهای امن روی Vercel تنظیم شوند.'}</span>
   </div>
   <button disabled={busy||!data.configured||!data.crmEnabled} onClick={()=>connectOrDisconnect('connect')}>اتصال پیج اینستاگرام</button>
   {!data.crmEnabled&&<p className={hub.note}>فعال‌سازی اتصال سیما به اشتراک فعال این محصول نیاز دارد.</p>}
   <div className={styles.records}>
    {data.channels.map(c=>{
     const usable=isUsableConnection(c);
     const enabled=grantFor(data.grants,c.id,'crm');
     return <article key={c.id} className={hub.record}>
      <div><strong dir="ltr">@{c.username||'Instagram'}</strong>
       <small>{c.status==='disconnected'?'قطع‌شده':!usable?'نیازمند اتصال مجدد':'متصل به دلسا'}</small>
       {c.last_received_at&&<small>آخرین پیام دریافتی: {new Date(c.last_received_at).toLocaleString('fa-IR',{timeZone:'Asia/Tehran'})}</small>}
       <small>انقضای مجوز: {new Date(c.expires_at).toLocaleDateString('fa-IR',{timeZone:'Asia/Tehran'})}</small>
      </div>
      <div className={hub.permissions}>
       <span>سیما · دریافت پیام</span>
       <button type="button" disabled={busy||(!enabled&&(!usable||!data.crmEnabled))}
        aria-label={enabled?'لغو مجوز دریافت پیام سیما':'اعطای مجوز دریافت پیام سیما'}
        aria-pressed={enabled}
        className={enabled?hub.granted:hub.revoked}
        onClick={()=>setGrant(c.id,!enabled)}>{enabled?'مجاز · لغو دسترسی':'غیرفعال · فعال‌سازی'}</button>
       <small>دورپین: اتصال پیام‌ها در نسخه آینده، بدون دسترسی فعلی</small>
       {c.status!=='disconnected'&&<button type="button" disabled={busy} onClick={()=>connectOrDisconnect('disconnect',c.id)}>قطع کامل حساب</button>}
      </div>
     </article>;
    })}
    {!data.channels.length&&<div className={hub.empty}>هنوز پیجی به حساب شما متصل نشده است.</div>}
   </div>
   <p className={hub.note}>این مرحله فقط برای دریافت پیام‌های متنی جدید است. پاسخ خودکار، دسترسی دورپین به دایرکت، ورود تاریخچه قدیمی و خواندن فایل صوتی/تصویر فعال نشده‌اند. دریافت واقعی پس از تست رسمی Meta تأیید می‌شود.</p>
  </>}
 </section>;
}

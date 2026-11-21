'use client';
import {useI18n} from '../i18n/I18nProvider';
import {tx} from '../../lib/i18n/config';
import {useEffect,useState} from 'react';
import styles from './SimaWorkspace.module.css';
export default function InstagramConnection(){
 const {t,intl}=useI18n();
 const [data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function load(){try{const r=await fetch('/api/crm/instagram',{cache:'no-store'}),value=await r.json();if(!r.ok)throw new Error(value.error);setData(value);}catch(e){setError(t(e.message)||t('وضعیت اتصال دریافت نشد.'));}}
 useEffect(()=>{load();},[]);
 async function action(action,id){setBusy(true);setError('');try{const r=await fetch('/api/crm/instagram',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,id})}),value=await r.json();if(!r.ok)throw new Error(value.error);if(value.url){const url=new URL(value.url);if(url.protocol!=='https:'||url.hostname!=='www.instagram.com')throw new Error(t('نشانی اتصال معتبر نیست.'));window.location.assign(value.url);}else await load();}catch(e){setError(t(e.message)||t('اتصال انجام نشد.'));}finally{setBusy(false);}}
 const result=typeof window!=='undefined'?new URLSearchParams(window.location.search).get('sima_connection'):null;
 const resultNames={connected:t('پیج متصل شد؛ دریافت پیام‌های جدید آماده است.'),cancelled:t('اتصال توسط شما لغو شد.'),failed:t('اتصال کامل نشد؛ تنظیمات برنامه و دسترسی پیج را بررسی کنید.'),invalid_state:t('زمان درخواست اتصال پایان یافته؛ دوباره شروع کنید.'),login_required:t('برای تکمیل اتصال، وارد حساب خود شوید.'),subscription_required:t('اشتراک فعال سیما لازم است.'),unconfigured:t('تنظیمات اتصال هنوز آماده نیست.')};
 return <div className={styles.panel}><h3>{t('اتصال رسمی اینستاگرام')}</h3><p>{t('با اجازهٔ صاحب پیج حرفه‌ای، پیام‌های متنی جدید به پروندهٔ مخاطب متصل می‌شوند. رمز پیج در سیما دریافت نمی‌شود.')}</p>{resultNames[result]&&<p role="status">{resultNames[result]}</p>}{error&&<p role="alert" className={styles.error}>{error}</p>}
 {!data&&!error&&<p role="status">{t('بررسی وضعیت اتصال…')}</p>}
 {data&&<><div className={styles.connection}><strong>{data.configured?t('آمادهٔ اتصال پیج'):t('نیازمند تنظیم اتصال توسط دلسا')}</strong><span>{data.configured?t('با دکمهٔ زیر دسترسی پیج خود را تأیید کنید.'):t('تنظیمات برنامهٔ اینستاگرام هنوز ثبت نشده؛ دریافت دایرکت فعال نیست.')}</span></div><button disabled={busy||!data.configured} onClick={()=>action('connect')}>{t('اتصال پیج اینستاگرام')}</button><div className={styles.records}>{data.connections.map(c=>{const expired=new Date(c.expires_at)<=new Date();return <article key={c.id}><div><strong dir="ltr">@{c.username||'Instagram'}</strong><small>{c.status==='disconnected'?t('قطع شده'):expired?t('نیازمند اتصال دوباره'):t('متصل')}</small>{c.last_received_at&&<small>{t('آخرین دریافت:')} {new Date(c.last_received_at).toLocaleString(intl,{timeZone:'Asia/Tehran'})}</small>}<small>{t('اعتبار دسترسی تا')} {new Date(c.expires_at).toLocaleDateString('fa-IR',{timeZone:'Asia/Tehran'})}</small></div>{c.status!=='disconnected'&&<button disabled={busy} onClick={()=>action('disconnect',c.id)}>{t('قطع اتصال')}</button>}</article>;})}</div><p>{t('پاسخ‌گویی و پرسیدن سؤال به‌صورت خودکار، خواندن عکس و صدا و وارد کردن تاریخچهٔ قدیمی هنوز فعال نیستند. ثبت اطلاعات از پیام‌های صریح در بخش «اطلاعات جدید» انجام می‌شود.')}</p></>}
 </div>;
}

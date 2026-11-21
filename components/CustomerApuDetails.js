'use client';
import {useI18n} from './i18n/I18nProvider';
import {tx} from '../lib/i18n/config';
import {useEffect,useState} from 'react';
import ApuWorkspace from './ApuWorkspace';
const models={source_price:tx('قیمت از منبع'),usd_subscription:tx('اشتراک دلاری'),fixed_price:tx('قیمت ثابت')};
const types={maximum_change_percent:tx('سقف تغییر قیمت'),minimum_margin_percent:tx('حداقل حاشیه سود'),fixed_price:tx('قیمت ثابت'),custom:tx('قانون شخصی')};
const fields={name:tx('نام'),url:tx('لینک'),pricing_model:tx('مدل قیمت'),currency:tx('ارز'),subscription_amount:tx('مبلغ'),rule_type:tx('نوع قانون'),value:tx('مقدار / توضیح'),enabled:tx('وضعیت'),deleted_at:tx('حذف')};
const display=(key,v)=>v==null||v===''?'—':key==='enabled'?(v?tx('فعال'):tx('غیرفعال')):key==='pricing_model'?models[v]||v:key==='rule_type'?types[v]||v:key==='deleted_at'?tx('حذف‌شده'):String(v);
export default function CustomerApuDetails({customerId}){
 const {t,intl}=useI18n();
 const time=(d)=>new Date(d).toLocaleString(intl,{timeZone:'Asia/Tehran'});
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let alive=true,running=false;async function refresh(){if(running||document.visibilityState==='hidden')return;running=true;try{const r=await fetch('/api/admin/customer-details?customerId='+encodeURIComponent(customerId),{cache:'no-store'});const v=await r.json();if(!r.ok)throw Error(v.error);if(alive){setData(v);setError('')}}catch(e){if(alive)setError(e.message)}finally{running=false}}refresh();const timer=setInterval(refresh,5000);document.addEventListener('visibilitychange',refresh);return()=>{alive=false;clearInterval(timer);document.removeEventListener('visibilitychange',refresh)}},[customerId]);
 async function markRead(){const id=data?.history[0]?.id;if(!id)return;setBusy(true);try{const r=await fetch('/api/admin/customer-details',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customerId,action:'apu-seen',lastSeenId:id})});const v=await r.json();if(!r.ok)throw Error(v.error);setData(d=>({...d,lastSeenId:Math.max(d.lastSeenId,id)}));setError('')}catch(e){setError(e.message)}finally{setBusy(false)}}
 const unread=data?.history.filter(h=>h.id>data.lastSeenId).length||0;
 return <section className="detail-apu" aria-label={t('تنظیمات APU مشتری')}>
 <ApuWorkspace key={customerId} customerId={customerId} admin/>
 <div className="detail-heading"><h3>{t('تنظیمات APU مشتری')}</h3>{unread>0&&<span className="apu-new" role="status">{unread.toLocaleString(intl)}{unread===100?'+':''} {t('تغییر جدید')}</span>}</div>
 <p className="detail-empty">{t('اطلاعات ذخیره‌شدهٔ مشتری · به‌روزرسانی هر ۵ ثانیه')}</p>
 {error&&<p className="admin-form-error" role="alert">{error}</p>}
 {!data?<p>{t('در حال بارگذاری تنظیمات…')}</p>:<>
 <h4>{t('منابع قیمت (')}{data.sources.length.toLocaleString(intl)})</h4>
 {data.sources.length?data.sources.map(s=><article className="apu-setting" key={s.id}><div><strong>{s.name}</strong><span className={s.enabled?'apu-enabled':'detail-empty'}>{s.enabled?t('فعال'):t('غیرفعال')}</span></div>{s.url&&<a href={/^https?:\/\//i.test(s.url)?s.url:undefined} target="_blank" rel="noreferrer" dir="ltr">{s.url}</a>}<p>{t(models[s.pricing_model]||s.pricing_model)} · {s.currency==='USD'?t('دلار آمریکا'):t('تومان')}{s.subscription_amount!=null&&' · '+Number(s.subscription_amount).toLocaleString(intl)}</p></article>):<p className="detail-empty">{t('منبعی ثبت نشده است.')}</p>}
 <h4>{t('قوانین قیمت‌گذاری (')}{data.rules.length.toLocaleString(intl)})</h4>
 {data.rules.length?data.rules.map(r=><article className="apu-setting" key={r.id}><div><strong>{r.name}</strong><span className={r.enabled?'apu-enabled':'detail-empty'}>{r.enabled?t('فعال'):t('غیرفعال')}</span></div><small>{t(types[r.rule_type]||r.rule_type)}</small><p>{r.value}</p></article>):<p className="detail-empty">{t('قانونی ثبت نشده است.')}</p>}
 <div className="detail-heading"><h4>{t('تاریخچه تغییرات')}</h4>{unread>0&&<button type="button" disabled={busy} onClick={markRead}>{t('علامت‌گذاری به‌عنوان دیده‌شده')}</button>}</div>
 <p className="detail-empty">{t('۱۰۰ تغییر اخیر · زمان ایران · ثبت سابقه از زمان فعال‌سازی این بخش')}</p>
 <div className="apu-history">{data.history.length?data.history.map(h=><details key={h.id} className={h.id>data.lastSeenId?'apu-unread':''}><summary><span>{h.operation==='INSERT'?t('ثبت'):h.operation==='DELETE'?t('حذف'):t('ویرایش')} {h.entity==='apu_sources'?t('منبع'):t('قانون')} «{(h.after_data||h.before_data)?.name}»</span><time>{time(h.created_at)}</time></summary><small>{h.actor_id===customerId?t('توسط مشتری'):h.actor_id?t('توسط مدیر'):t('توسط سامانه')}</small><dl>{Object.entries(fields).filter(([key])=>key in (h.after_data||{})||key in (h.before_data||{})).filter(([key])=>h.operation!=='UPDATE'||JSON.stringify(h.before_data?.[key])!==JSON.stringify(h.after_data?.[key])).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{h.operation!=='INSERT'&&<span>{t('قبل:')} {t(display(key,h.before_data?.[key]))}</span>}{h.operation!=='DELETE'&&<span>{t('بعد:')} {t(display(key,h.after_data?.[key]))}</span>}</dd></div>)}</dl></details>):<p className="detail-empty">{t('هنوز تغییری ثبت نشده است.')}</p>}</div>
 </>}
 </section>
}

'use client';

import {useEffect,useRef,useState} from 'react';
import {Activity,CalendarDays,CheckCircle2,ChevronLeft,Database,Heart,MessageCircle,PackageCheck,Phone,Plus,ShoppingBag,Sparkles,UserRound} from 'lucide-react';
import {BrandName} from './home/BrandIcon';
import CustomerAvatar from './home/CustomerAvatar';
import styles from './CimaCustomerProfileDemo.module.css';
import {useI18n} from './i18n/I18nProvider';
import {tx} from '../lib/i18n/config';

const examples=[
 {id:'maryam',name:tx('مریم احمدی'),initial:tx('م'),channel:tx('اینستاگرام'),status:tx('مشتری فعال'),color:'orange',last:tx('امروز · ۱۰:۴۱'),
  fields:[[tx('شماره تماس'),'09124567890'],[tx('علاقه‌مندی'),tx('مراقبت پوست')],[tx('آخرین سفارش'),tx('۴۸۳۱')],[tx('روش ارسال'),tx('پست پیشتاز')]],
  details:[[tx('نوع پوست'),tx('خشک')],[tx('ترجیح خرید'),tx('محصول بدون عطر')]],
  events:[[tx('۱۰:۴۱'),tx('پیگیری وضعیت سفارش ۴۸۳۱'),'message'],[tx('۱۰:۳۴'),tx('ثبت شماره سفارش از مکالمه'),'ai'],[tx('دیروز'),tx('درخواست راهنمای انتخاب محصول'),'order']]},
 {id:'ali',name:tx('علی رضایی'),initial:tx('ع'),channel:tx('واتساپ'),status:tx('در انتظار بررسی'),color:'blue',last:tx('امروز · ۱۱:۱۴'),
  fields:[[tx('شماره تماس'),'09961234567'],[tx('علاقه‌مندی'),tx('تجهیزات دیجیتال')],[tx('مدل موردنظر'),'K7'],[tx('رنگ موردنظر'),tx('مشکی')]],
  details:[[tx('بودجه خرید'),tx('تا ۵ میلیون')],[tx('اولویت'),tx('موجودی سریع')]],
  events:[[tx('۱۱:۱۴'),tx('درخواست استعلام مدل K7 مشکی'),'message'],[tx('۱۱:۰۸'),tx('ثبت خودکار مدل موردنظر'),'ai'],[tx('هفته قبل'),tx('پرس‌وجو درباره شرایط ارسال'),'order']]},
 {id:'negar',name:tx('نگار محمدی'),initial:tx('ن'),channel:tx('بله'),status:tx('در مسیر خرید'),color:'purple',last:tx('امروز · ۱۲:۲۸'),
  fields:[[tx('شماره تماس'),'09012231654'],[tx('علاقه‌مندی'),tx('پوشاک')],[tx('وضعیت سبد'),tx('آماده تأیید')],[tx('کانال ارتباطی'),tx('بله')]],
  details:[[tx('سایز'),tx('مدیوم')],[tx('رنگ محبوب'),tx('سرمه‌ای')]],
  events:[[tx('۱۲:۲۸'),tx('تأیید آدرس ارسال در مکالمه'),'message'],[tx('۱۲:۲۰'),tx('تکمیل مشخصات سفارش'),'ai'],[tx('هفته قبل'),tx('پرس‌وجو درباره سایزبندی'),'order']]}
];
const eventIcons={message:MessageCircle,ai:Sparkles,order:ShoppingBag};
export default function CimaCustomerProfileDemo(){
 const {t,dir,intl}=useI18n();
 const [active,setActive]=useState(0),[step,setStep]=useState(0),[reduced,setReduced]=useState(false),[paused,setPaused]=useState(false);
 const rootRef=useRef(null);
 const resumeTimer=useRef(null);
 useEffect(()=>{
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  const update=()=>setReduced(media.matches);
  update();media.addEventListener?.('change',update);
  return()=>media.removeEventListener?.('change',update);
 },[]);
 useEffect(()=>{
  if(reduced){setStep(4);return}
  setStep(0);
  const timers=[550,1250,1900,2650].map((delay,index)=>window.setTimeout(()=>setStep(index+1),delay));
  return()=>timers.forEach(clearTimeout);
 },[active,reduced]);
 useEffect(()=>{
  if(reduced||paused)return;
  const timer=window.setTimeout(()=>setActive(current=>(current+1)%examples.length),7700);
  return()=>clearTimeout(timer);
 },[active,reduced,paused]);
 const customer=examples[active];
 const choose=index=>{setActive(index);setPaused(true);window.clearTimeout(resumeTimer.current);resumeTimer.current=window.setTimeout(()=>setPaused(false),10500)};
 useEffect(()=>()=>window.clearTimeout(resumeTimer.current),[]);
 return <div ref={rootRef} className={styles.showcase} dir={dir} onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)}>
  <div className={styles.story}>
   <div className={styles.storyLabel}><Sparkles size={14}/> {t('هر پیام، اطلاعات ارزشمندتر')}</div>
   <h3>{t('پروفایل مشتری،')}<br/><span>{t('همیشه کامل‌تر از قبل.')}</span></h3>
   <p>{t('اطلاعات تماس، نیازها، سابقه مکالمه و ویژگی‌های اختصاصی هر مشتری در یک پرونده جمع می‌شوند؛ بدون اینکه برای شناخت او بین پیام‌ها جست‌وجو کنی.')}</p>
   <div className={styles.storyStats}>
    <div><Database size={17}/><strong>{t('اطلاعات پویا')}</strong><small>{t('متناسب با هر کسب‌وکار')}</small></div>
    <div><Activity size={17}/><strong>{t('تاریخچه تعاملات')}</strong><small>{t('با زمینه هر مکالمه')}</small></div>
   </div>
   <div className={styles.switches} aria-label={t('انتخاب پروفایل نمونه')}>
    {examples.map((entry,i)=><button key={entry.id} type="button" className={styles.switch+' '+(active===i?styles.activeSwitch:'')} aria-pressed={active===i} onClick={()=>choose(i)}>{t(entry.name)}</button>)}
   </div>
   <small className={styles.demoNote}>{t('اطلاعات و مکالمه‌ها نمایشی‌اند و به مشتریان واقعی متصل نیستند.')}</small>
  </div>
  <div className={styles.cardWrap}>
   <div className={styles.ambient} aria-hidden="true"/>
   <div className={styles.card} key={customer.id}>
    <div className={styles.cardTop}><div className={styles.cardBrand}><span className={styles.onlineDot}/> DELSA CRM</div><span className={styles.cardTag}><UserRound size={12}/> {t('پرونده مشتری')}</span></div>
    <div className={styles.identity}>
     <span className={styles.profileAvatar}><CustomerAvatar name={customer.name} channel={customer.channel} size={62}/></span>
     <div className={styles.profileTitle}><strong>{t(customer.name)}</strong><small><BrandName name={t(customer.channel)} size={14}/><br/>{t(customer.last)}</small></div>
     <span className={styles.status}>{t(customer.status)}</span>
    </div>
    <div className={styles.fieldHeader}><span>{t('اطلاعات مشتری')}</span><span className={styles.fieldCount}>{t('{n} فیلد',{n:new Intl.NumberFormat(intl).format(customer.fields.length+customer.details.length)})}</span></div>
    <div className={styles.fields}>
     {customer.fields.map(([label,value],i)=><div className={styles.field+' '+(step>=1?styles.visible:'')} key={label} style={{'--delay':(i*95)+'ms'}}><small>{t(label)}</small>{label===tx('شماره تماس')?<b className={styles.phone} dir="ltr"><bdi>{value}</bdi></b>:label===tx('کانال ارتباطی')?<b><BrandName name={t(value)} size={16}/></b>:<b>{t(value)}</b>}</div>)}
    </div>
    <div className={styles.dynamicHeader+' '+(step>=2?styles.visible:'')}><span><Sparkles size={13}/> {t('فیلدهای اختصاصی')}</span><span className={styles.autoBadge}>{t('اطلاعات تکمیلی')}</span></div>
    <div className={styles.dynamic}>
     {customer.details.map(([label,value],i)=><div className={styles.dynamicField+' '+(step>=2?styles.visible:'')} key={label} style={{'--delay':(i*120)+'ms'}}><Plus size={12}/><span>{t(label)}</span><strong>{t(value)}</strong></div>)}
    </div>
    <div className={styles.historyTitle+' '+(step>=3?styles.visible:'')}><span><CalendarDays size={14}/> {t('آخرین تعاملات')}</span><small>{t('سابقه قابل پیگیری')}</small></div>
    <div className={styles.timeline}>
     {customer.events.map(([time,title,type],i)=>{const Icon=eventIcons[type];return <div className={styles.event+' '+(step>=3?styles.visible:'')} key={i} style={{'--delay':(i*145)+'ms'}}><span className={styles.eventIcon}><Icon size={12}/></span><span className={styles.eventText}>{t(title)}</span><small>{t(time)}</small></div>})}
    </div>
    <div className={styles.cardFooter+' '+(step>=4?styles.visible:'')}><span><CheckCircle2 size={13}/> {t('اطلاعات جدید به پرونده افزوده شد')}</span><span className={styles.cardEnd}>{t('پرونده یکپارچه')} <ChevronLeft size={14}/></span></div>
   </div>
  </div>
 </div>;
}

'use client';

import {useEffect,useRef,useState} from 'react';
import {Activity,CalendarDays,CheckCircle2,ChevronLeft,Database,Heart,MessageCircle,PackageCheck,Phone,Plus,ShoppingBag,Sparkles,UserRound} from 'lucide-react';
import styles from './CimaCustomerProfileDemo.module.css';

const examples=[
 {id:'maryam',name:'مریم احمدی',initial:'م',channel:'اینستاگرام',status:'مشتری فعال',color:'orange',last:'امروز · ۱۰:۴۱',
  fields:[['شماره تماس','۰۹۱۲••••۵۴۳۲'],['علاقه‌مندی','مراقبت پوست'],['آخرین سفارش','۴۸۳۱'],['روش ارسال','پست پیشتاز']],
  details:[['نوع پوست','خشک'],['ترجیح خرید','محصول بدون عطر']],
  events:[['۱۰:۴۱','پیگیری وضعیت سفارش ۴۸۳۱','message'],['۱۰:۳۴','ثبت شماره سفارش از مکالمه','ai'],['دیروز','درخواست راهنمای انتخاب محصول','order']]},
 {id:'ali',name:'علی رضایی',initial:'ع',channel:'واتساپ',status:'در انتظار بررسی',color:'blue',last:'امروز · ۱۱:۱۴',
  fields:[['شماره تماس','۰۹۳۵••••۱۹۶۰'],['علاقه‌مندی','تجهیزات دیجیتال'],['مدل موردنظر','K7'],['رنگ موردنظر','مشکی']],
  details:[['بودجه خرید','تا ۵ میلیون'],['اولویت','موجودی سریع']],
  events:[['۱۱:۱۴','درخواست استعلام مدل K7 مشکی','message'],['۱۱:۰۸','ثبت خودکار مدل موردنظر','ai'],['هفته قبل','پرس‌وجو درباره شرایط ارسال','order']]},
 {id:'negar',name:'نگار محمدی',initial:'ن',channel:'بله',status:'در مسیر خرید',color:'purple',last:'امروز · ۱۲:۲۸',
  fields:[['شماره تماس','۰۹۰۱••••۸۳۲۶'],['علاقه‌مندی','پوشاک'],['وضعیت سبد','آماده تأیید'],['کانال ارتباطی','بله']],
  details:[['سایز','مدیوم'],['رنگ محبوب','سرمه‌ای']],
  events:[['۱۲:۲۸','تأیید آدرس ارسال در مکالمه','message'],['۱۲:۲۰','تکمیل مشخصات سفارش','ai'],['هفته قبل','پرس‌وجو درباره سایزبندی','order']]}
];
const eventIcons={message:MessageCircle,ai:Sparkles,order:ShoppingBag};
export default function CimaCustomerProfileDemo(){
 const [active,setActive]=useState(0),[step,setStep]=useState(0),[reduced,setReduced]=useState(false),[paused,setPaused]=useState(false);
 const rootRef=useRef(null);
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
 const choose=index=>{setActive(index);setPaused(true)};
 return <div ref={rootRef} className={styles.showcase} dir="rtl" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)}>
  <div className={styles.story}>
   <div className={styles.storyLabel}><Sparkles size={14}/> هر پیام، اطلاعات ارزشمندتر</div>
   <h3>پروفایل مشتری،<br/><span>همیشه کامل‌تر از قبل.</span></h3>
   <p>اطلاعات تماس، نیازها، سابقه مکالمه و ویژگی‌های اختصاصی هر مشتری در یک پرونده جمع می‌شوند؛ بدون اینکه برای شناخت او بین پیام‌ها جست‌وجو کنی.</p>
   <div className={styles.storyStats}>
    <div><Database size={17}/><strong>اطلاعات پویا</strong><small>متناسب با هر کسب‌وکار</small></div>
    <div><Activity size={17}/><strong>تاریخچه تعاملات</strong><small>با زمینه هر مکالمه</small></div>
   </div>
   <div className={styles.switches} aria-label="انتخاب پروفایل نمونه">
    {examples.map((entry,i)=><button key={entry.id} type="button" className={styles.switch+' '+(active===i?styles.activeSwitch:'')} aria-pressed={active===i} onClick={()=>choose(i)}>{entry.name}</button>)}
   </div>
   <small className={styles.demoNote}>اطلاعات و مکالمه‌ها نمایشی‌اند و به مشتریان واقعی متصل نیستند.</small>
  </div>
  <div className={styles.cardWrap}>
   <div className={styles.ambient} aria-hidden="true"/>
   <div className={styles.card} key={customer.id}>
    <div className={styles.cardTop}><div className={styles.cardBrand}><span className={styles.onlineDot}/> DELSA CRM</div><span className={styles.cardTag}><UserRound size={12}/> پرونده مشتری</span></div>
    <div className={styles.identity}>
     <div className={styles.profileAvatar}>{customer.initial}</div>
     <div className={styles.profileTitle}><strong>{customer.name}</strong><small>{customer.channel} · {customer.last}</small></div>
     <span className={styles.status}>{customer.status}</span>
    </div>
    <div className={styles.fieldHeader}><span>اطلاعات مشتری</span><span className={styles.fieldCount}>{(customer.fields.length+customer.details.length).toLocaleString('fa-IR')} فیلد</span></div>
    <div className={styles.fields}>
     {customer.fields.map(([label,value],i)=><div className={styles.field+' '+(step>=1?styles.visible:'')} key={label} style={{'--delay':(i*95)+'ms'}}><small>{label}</small><b>{value}</b></div>)}
    </div>
    <div className={styles.dynamicHeader+' '+(step>=2?styles.visible:'')}><span><Sparkles size={13}/> فیلدهای اختصاصی</span><span className={styles.autoBadge}>اطلاعات تکمیلی</span></div>
    <div className={styles.dynamic}>
     {customer.details.map(([label,value],i)=><div className={styles.dynamicField+' '+(step>=2?styles.visible:'')} key={label} style={{'--delay':(i*120)+'ms'}}><Plus size={12}/><span>{label}</span><strong>{value}</strong></div>)}
    </div>
    <div className={styles.historyTitle+' '+(step>=3?styles.visible:'')}><span><CalendarDays size={14}/> آخرین تعاملات</span><small>سابقه قابل پیگیری</small></div>
    <div className={styles.timeline}>
     {customer.events.map(([time,title,type],i)=>{const Icon=eventIcons[type];return <div className={styles.event+' '+(step>=3?styles.visible:'')} key={i} style={{'--delay':(i*145)+'ms'}}><span className={styles.eventIcon}><Icon size={12}/></span><span className={styles.eventText}>{title}</span><small>{time}</small></div>})}
    </div>
    <div className={styles.cardFooter+' '+(step>=4?styles.visible:'')}><span><CheckCircle2 size={13}/> اطلاعات جدید به پرونده افزوده شد</span><span className={styles.cardEnd}>پرونده یکپارچه <ChevronLeft size={14}/></span></div>
   </div>
  </div>
 </div>;
}

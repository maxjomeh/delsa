'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {CheckCheck,ChevronLeft,Instagram,MessageCircle,ShieldCheck,Sparkles} from 'lucide-react';
import styles from './AnimatedCimaInbox.module.css';

const conversations=[
 {id:'instagram',name:'مریم احمدی',initial:'م',channel:'اینستاگرام',channelKey:'instagram',time:'همین الان',last:'شماره سفارش رو فرستادم',unread:2,
  messages:[
   {from:'customer',text:'سلام، سفارش من امروز ارسال می‌شه؟'},
   {from:'ai',text:'سلام مریم جان 🌱 شماره سفارش رو می‌فرمایید تا دقیق بررسی کنیم؟'},
   {from:'customer',text:'۴۸۳۱، ممنون'},
   {from:'ai',text:'ممنون، درخواست بررسی سفارش ۴۸۳۱ ثبت شد. بعد از تأیید وضعیت، همین‌جا خبر می‌دیم.'}
  ],status:'پاسخ هوشمند با بررسی وضعیت سفارش',review:true},
 {id:'whatsapp',name:'علی رضایی',initial:'ع',channel:'واتساپ',channelKey:'whatsapp',time:'۲ دقیقه',last:'رنگ مشکی هم موجوده؟',unread:1,
  messages:[
   {from:'customer',text:'سلام، مدل K7 رو دارید؟'},
   {from:'ai',text:'سلام! برای بررسی دقیق، رنگ موردنظرتون رو می‌فرمایید؟'},
   {from:'customer',text:'مشکی می‌خوام.'},
   {from:'ai',text:'متوجه شدم؛ موجودی مدل K7 مشکی رو بررسی می‌کنم تا اطلاعات دقیق بدم.'}
  ],status:'استعلام موجودی پیش از اعلام قطعی',review:true},
 {id:'bale',name:'نگار محمدی',initial:'ن',channel:'بله',channelKey:'bale',time:'۵ دقیقه',last:'لینک پرداخت رو می‌فرستید؟',unread:0,
  messages:[
   {from:'customer',text:'سلام، می‌خوام سفارشم رو نهایی کنم.'},
   {from:'ai',text:'حتماً! سبد خریدتون رو بررسی می‌کنم. آدرس ارسال همون آدرس قبلیه؟'},
   {from:'customer',text:'بله، همونه.'},
   {from:'ai',text:'خیلی هم خوب. بعد از تأیید نهایی سفارش، مسیر پرداخت براتون ارسال می‌شه.'}
  ],status:'تأیید سفارش قبل از پرداخت',review:true},
 {id:'telegram',name:'کیان شریفی',initial:'ک',channel:'تلگرام',channelKey:'telegram',time:'۹ دقیقه',last:'کد رهگیری رو می‌خواستم',unread:0,
  messages:[
   {from:'customer',text:'وقت بخیر، سفارشم ارسال شده؟'},
   {from:'ai',text:'وقت شما هم بخیر! شماره سفارشتون رو لطف می‌کنید؟'},
   {from:'customer',text:'۷۰۲۵'},
   {from:'ai',text:'درخواست پیگیری سفارش ۷۰۲۵ ثبت شد؛ بعد از تأیید اطلاعات ارسال، کد رهگیری اعلام می‌شه.'}
  ],status:'پیگیری ارسال بدون حدس اطلاعات',review:true},
 {id:'rubika',name:'سارا رحیمی',initial:'س',channel:'روبیکا',channelKey:'rubika',time:'۱۲ دقیقه',last:'سایز مناسب کدومه؟',unread:0,
  messages:[
   {from:'customer',text:'برای هدیه دنبال یه مدل مناسبم.'},
   {from:'ai',text:'با کمال میل راهنمایی‌تون می‌کنم. حدود بودجه و سلیقه طرف مقابل رو می‌گید؟'},
   {from:'customer',text:'حدود دو میلیون، رنگ‌های ساده.'},
   {from:'ai',text:'عالیه؛ بر اساس بودجه و رنگ دلخواهتون گزینه‌ها رو انتخاب می‌کنیم.'}
  ],status:'شناخت نیاز و پیشنهاد محصول',review:false}
];

export default function AnimatedCimaInbox(){
 const [activeId,setActiveId]=useState(conversations[0].id);
 const [cycle,setCycle]=useState(0);
 const [visible,setVisible]=useState(1);
 const [typing,setTyping]=useState(false);
 const [reduced,setReduced]=useState(false);
 const scrollRef=useRef(null);
 const active=useMemo(()=>conversations.find(c=>c.id===activeId)||conversations[0],[activeId]);
 useEffect(()=>{
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  const sync=()=>setReduced(media.matches);sync();
  media.addEventListener?.('change',sync);
  return()=>media.removeEventListener?.('change',sync);
 },[]);
 useEffect(()=>{
  const timeouts=[];
  const later=(fn,ms)=>{const t=window.setTimeout(fn,ms);timeouts.push(t)};
  setTyping(false);
  if(reduced){setVisible(active.messages.length);return()=>timeouts.forEach(clearTimeout)}
  setVisible(1);
  let index=1;
  const advance=()=>{
   if(index>=active.messages.length){
    later(()=>setActiveId(current=>{
     const pos=conversations.findIndex(c=>c.id===current);
     return conversations[(pos+1)%conversations.length].id;
    }),6700);
    return;
   }
   setTyping(true);
   later(()=>{
    index+=1;
    setVisible(index);
    setTyping(false);
    later(advance,1650);
   },850);
  };
  later(advance,1900);
  return()=>timeouts.forEach(clearTimeout);
 },[activeId,cycle,reduced,active]);
 useEffect(()=>{
  const el=scrollRef.current;
  if(el){el.scrollTo({top:el.scrollHeight,behavior:reduced?'auto':'smooth'});}
 },[visible,typing,activeId,reduced]);
 const select=id=>{if(id===activeId){setCycle(v=>v+1)}else setActiveId(id)};
 const complete=visible>=active.messages.length;
 return <section className={styles.frame} dir="rtl" aria-label="دموی تعاملی صندوق ورودی CIMA">
  <header className={styles.top}>
   <div className={styles.topTitle}><span className={styles.dot}/><strong>صندوق ورودی CIMA</strong><small>دموی تعاملی · پیام‌های نمونه</small></div>
   <span className={styles.logo}>DELSA</span>
  </header>
  <div className={styles.body}>
   <aside className={styles.inbox} aria-label="گفت‌وگوهای نمونه">
    <div className={styles.inboxLabel}><span>گفت‌وگوها</span><span>{conversations.length.toLocaleString('fa-IR')} مکالمه</span></div>
    <div className={styles.contacts}>
     {conversations.map(c=><button key={c.id} type="button" className={styles.contact+' '+(c.id===activeId?styles.selected:'')} aria-pressed={c.id===activeId} onClick={()=>select(c.id)}>
      <span className={styles.avatar}>{c.initial}</span>
      <span className={styles.contactCopy}><strong>{c.name}</strong><small>{c.last}</small><span className={styles.channel+' '+styles[c.channelKey]}>{c.channel}</span></span>
      <span className={styles.contactMeta}><small>{c.time}</small>{c.unread>0&&<b>{c.unread.toLocaleString('fa-IR')}</b>}</span>
     </button>)}
    </div>
    <p className={styles.inboxNote}><MessageCircle size={12}/> برای دیدن هر مکالمه روی آن بزنید</p>
   </aside>
   <div className={styles.chat}>
    <div className={styles.chatHeader}>
     <span className={styles.avatar}>{active.initial}</span>
     <span className={styles.person}><strong>{active.name}</strong><small><span className={styles.channel+' '+styles[active.channelKey]}>{active.channel}</span> · گفت‌وگوی نمونه</small></span>
     <span className={styles.chatStatus}><span className={styles.dot}/> فعال</span>
    </div>
    <div key={activeId+'-'+cycle} className={styles.messages} ref={scrollRef} aria-live="off">
     {active.messages.slice(0,visible).map((m,i)=><div key={i} className={styles.messageRow+' '+(m.from==='ai'?styles.aiRow:styles.customerRow)}>
      <div className={styles.bubble+' '+(m.from==='ai'?styles.aiBubble:styles.customerBubble)}>
       {m.from==='ai'&&<span className={styles.sender}><Sparkles size={11}/> دستیار دلسا</span>}
       <span>{m.text}</span>
       <span className={styles.receipt}>{m.from==='ai'?<CheckCheck size={11}/>:null} {String(10+i).padStart(2,'0')}:۳۴</span>
      </div>
     </div>)}
     {typing&&<div className={styles.messageRow+' '+styles.aiRow}><span className={styles.typing} aria-label="دستیار در حال تایپ"><i/><i/><i/></span></div>}
    </div>
    <div className={styles.insight}>
     {complete?<><div className={styles.insightTitle}><Sparkles size={13}/><strong>{active.review?'نیازمند بررسی انسانی':'پاسخ پیشنهادی آماده'}</strong></div><p>{active.status}</p><small><ShieldCheck size={12}/> نمونه نمایشی؛ هیچ پیامی ارسال نمی‌شود</small></>:<><div className={styles.insightTitle}><Sparkles size={13}/><strong>دستیار هوشمند فعال است</strong></div><p>در حال نمایش مرحله‌به‌مرحله مکالمه…</p></>}
    </div>
   </div>
  </div>
 </section>;
}

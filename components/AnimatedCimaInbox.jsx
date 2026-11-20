'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {CheckCheck,MessageCircle,ShieldCheck,Sparkles} from 'lucide-react';
import {BrandIcon} from './home/BrandIcon';
import CustomerAvatar from './home/CustomerAvatar';
import styles from './AnimatedCimaInbox.module.css';
import {useI18n} from './i18n/I18nProvider';
import {tx} from '../lib/i18n/config';

const conversations=[
 {id:'instagram',name:tx('مریم احمدی'),initial:tx('م'),channel:tx('اینستاگرام'),channelKey:'instagram',time:tx('همین الان'),last:tx('شماره سفارش رو فرستادم'),unread:2,
  messages:[
   {from:'customer',text:tx('سلام، سفارش من امروز ارسال می‌شه؟')},
   {from:'ai',text:tx('سلام مریم جان 🌱 شماره سفارش رو می‌فرمایید تا دقیق بررسی کنیم؟')},
   {from:'customer',text:tx('۴۸۳۱، ممنون')},
   {from:'ai',text:tx('ممنون، درخواست بررسی سفارش ۴۸۳۱ ثبت شد. بعد از تأیید وضعیت، همین‌جا خبر می‌دیم.')}
  ],status:tx('پاسخ هوشمند با بررسی وضعیت سفارش'),review:true},
 {id:'whatsapp',name:tx('علی رضایی'),initial:tx('ع'),channel:tx('واتساپ'),channelKey:'whatsapp',time:tx('۲ دقیقه'),last:tx('رنگ مشکی هم موجوده؟'),unread:1,
  messages:[
   {from:'customer',text:tx('سلام، مدل K7 رو دارید؟')},
   {from:'ai',text:tx('سلام! برای بررسی دقیق، رنگ موردنظرتون رو می‌فرمایید؟')},
   {from:'customer',text:tx('مشکی می‌خوام.')},
   {from:'ai',text:tx('متوجه شدم؛ موجودی مدل K7 مشکی رو بررسی می‌کنم تا اطلاعات دقیق بدم.')}
  ],status:tx('استعلام موجودی پیش از اعلام قطعی'),review:true},
 {id:'bale',name:tx('نگار محمدی'),initial:tx('ن'),channel:tx('بله'),channelKey:'bale',time:tx('۵ دقیقه'),last:tx('لینک پرداخت رو می‌فرستید؟'),unread:0,
  messages:[
   {from:'customer',text:tx('سلام، می‌خوام سفارشم رو نهایی کنم.')},
   {from:'ai',text:tx('حتماً! سبد خریدتون رو بررسی می‌کنم. آدرس ارسال همون آدرس قبلیه؟')},
   {from:'customer',text:tx('بله، همونه.')},
   {from:'ai',text:tx('خیلی هم خوب. بعد از تأیید نهایی سفارش، مسیر پرداخت براتون ارسال می‌شه.')}
  ],status:tx('تأیید سفارش قبل از پرداخت'),review:true},
 {id:'telegram',name:tx('کیان شریفی'),initial:tx('ک'),channel:tx('تلگرام'),channelKey:'telegram',time:tx('۹ دقیقه'),last:tx('کد رهگیری رو می‌خواستم'),unread:0,
  messages:[
   {from:'customer',text:tx('وقت بخیر، سفارشم ارسال شده؟')},
   {from:'ai',text:tx('وقت شما هم بخیر! شماره سفارشتون رو لطف می‌کنید؟')},
   {from:'customer',text:tx('۷۰۲۵')},
   {from:'ai',text:tx('درخواست پیگیری سفارش ۷۰۲۵ ثبت شد؛ بعد از تأیید اطلاعات ارسال، کد رهگیری اعلام می‌شه.')}
  ],status:tx('پیگیری ارسال بدون حدس اطلاعات'),review:true},
 {id:'rubika',name:tx('سارا رحیمی'),initial:tx('س'),channel:tx('روبیکا'),channelKey:'rubika',time:tx('۱۲ دقیقه'),last:tx('سایز مناسب کدومه؟'),unread:0,
  messages:[
   {from:'customer',text:tx('برای هدیه دنبال یه مدل مناسبم.')},
   {from:'ai',text:tx('با کمال میل راهنمایی‌تون می‌کنم. حدود بودجه و سلیقه طرف مقابل رو می‌گید؟')},
   {from:'customer',text:tx('حدود دو میلیون، رنگ‌های ساده.')},
   {from:'ai',text:tx('عالیه؛ بر اساس بودجه و رنگ دلخواهتون گزینه‌ها رو انتخاب می‌کنیم.')}
  ],status:tx('شناخت نیاز و پیشنهاد محصول'),review:false}
];

// Example conversation clocks. AI replies share the same minute as the incoming
// customer message; a customer may respond several minutes later.
// These are illustrative clocks, not live message receipts.
const demoClocks={
 instagram:[634,634,641,641],
 whatsapp:[668,668,674,674],
 bale:[740,740,748,748],
 telegram:[545,545,557,557],
 rubika:[990,990,1006,1006]
};
export default function AnimatedCimaInbox(){
 const {t,dir,intl}=useI18n();
 const nf=(n,grouping=true)=>new Intl.NumberFormat(intl,{useGrouping:grouping}).format(n);
 const demoClock=(conversationId,index)=>{
  const values=demoClocks[conversationId]||demoClocks.instagram;
  const minutes=values[Math.min(index,values.length-1)];
  return nf(Math.floor(minutes/60),false).padStart(2,nf(0))+':'+nf(minutes%60,false).padStart(2,nf(0));
 };
 const [activeId,setActiveId]=useState(conversations[0].id);
 const [cycle,setCycle]=useState(0);
 const [visible,setVisible]=useState(1);
 const [typing,setTyping]=useState(false);
 const [switching,setSwitching]=useState(false);
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
  setSwitching(false);
  if(reduced){setVisible(active.messages.length);return()=>timeouts.forEach(clearTimeout)}
  setVisible(1);
  let index=1;
  const advance=()=>{
   if(index>=active.messages.length){
    later(()=>{
     setSwitching(true);
     later(()=>setActiveId(current=>{
      const pos=conversations.findIndex(c=>c.id===current);
      return conversations[(pos+1)%conversations.length].id;
     }),520);
    },2250);
    return;
   }
   const nextFrom=active.messages[index].from;
   setTyping(true);
   later(()=>{
    index+=1;
    setVisible(index);
    setTyping(false);
    later(advance,active.messages[index]?.from==='ai'?320:2100);
   },nextFrom==='ai'?420:1050);
  };
  later(advance,active.messages[1]?.from==='ai'?320:2100);
  return()=>timeouts.forEach(clearTimeout);
 },[activeId,cycle,reduced,active]);
 useEffect(()=>{
  const el=scrollRef.current;
  if(!el)return;
  el.scrollTo({top:el.scrollHeight,behavior:reduced?'auto':'smooth'});
 },[visible,typing,activeId,reduced]);
 const select=id=>{setSwitching(true);window.setTimeout(()=>{if(id===activeId){setCycle(v=>v+1)}else setActiveId(id)},220)};
 const complete=visible>=active.messages.length;
 return <div className={styles.viewport}>
  <section className={styles.frame} dir={dir} aria-label={t('دموی تعاملی صندوق ورودی CIMA')}>
  <header className={styles.top}>
   <div className={styles.topTitle}><span className={styles.dot}/><strong>{t('صندوق ورودی CIMA')}</strong><small>{t('دموی تعاملی · پیام‌های نمونه')}</small></div>
   <span className={styles.logo}>DELSA</span>
  </header>
  <div className={styles.body+' '+(switching?styles.switching:'')}>
   <aside className={styles.inbox} aria-label={t('گفت‌وگوهای نمونه')}>
    <div className={styles.inboxLabel}><span>{t('گفت‌وگوها')}</span><span>{t('{n} مکالمه',{n:nf(conversations.length)})}</span></div>
    <div className={styles.contacts}>
     {conversations.map(c=><button key={c.id} type="button" className={styles.contact+' '+(c.id===activeId?styles.selected:'')} aria-pressed={c.id===activeId} onClick={()=>select(c.id)}>
      <CustomerAvatar name={c.name} channel={c.channel} size={44}/>
      <span className={styles.contactCopy}><strong><span className={styles.nameFull}>{t(c.name)}</span><span className={styles.nameFirst}>{t(c.name).split(' ')[0]}</span></strong><small>{t(c.last)}</small><span className={styles.channel+' '+styles[c.channelKey]}><BrandIcon name={c.channel} size={13}/>{t(c.channel)}</span></span>
      <span className={styles.contactMeta}><small><bdi dir="ltr">{demoClock(c.id,c.messages.length-1)}</bdi></small>{c.unread>0&&<b>{nf(c.unread)}</b>}</span>
     </button>)}
    </div>
    <p className={styles.inboxNote}><MessageCircle size={12}/> {t('برای دیدن هر مکالمه روی آن بزنید')}</p>
   </aside>
   <div className={styles.chat}>
    <div className={styles.chatHeader}>
     <CustomerAvatar name={active.name} channel={active.channel} size={44}/>
     <span className={styles.person}><strong>{t(active.name)}</strong><small><span className={styles.channel+' '+styles[active.channelKey]}><BrandIcon name={active.channel} size={13}/>{t(active.channel)}</span><span className={styles.sampleTag}> {t('· گفت‌وگوی نمونه')}</span></small></span>
     <span className={styles.chatStatus}><span className={styles.dot}/> {t('فعال')}</span>
    </div>
    <div key={cycle} className={styles.messages} ref={scrollRef} aria-live="off">
     {/* All conversations are mounted and stacked so the box is always as tall as the longest one
         (no layout shift while messages arrive); only received messages are visible. */}
     {conversations.map(c=>{const on=c.id===activeId;return <div key={c.id} className={styles.stackItem+(on?' '+styles.stackOn:'')} aria-hidden={!on}>
      {c.messages.map((m,i)=>{
       const shown=on&&i<visible,typingHere=on&&typing&&i===visible;
       return <div key={i} className={styles.messageRow+' '+(m.from==='ai'?styles.aiRow:styles.customerRow)+' '+(shown?styles.shown:styles.pending)+(typingHere?' '+styles.pendingTyping:'')}>
        <div className={styles.bubble+' '+(m.from==='ai'?styles.aiBubble:styles.customerBubble)}>
         {m.from==='ai'&&<span className={styles.sender}><Sparkles size={11}/> {t('دستیار دلسا')}</span>}
         <span>{t(m.text)}</span>
         <span className={styles.receipt}>{m.from==='ai'?<CheckCheck size={11}/>:null} <bdi dir="ltr">{demoClock(c.id,i)}</bdi></span>
        </div>
        {typingHere&&<span className={styles.typing+' '+styles.typingOverlay+' '+(m.from==='customer'?styles.customerTyping:styles.aiTyping)} role="status" aria-label={m.from==='customer'?tx('مشتری در حال تایپ است'):tx('دستیار دلسا در حال تایپ است')}><i/><i/><i/></span>}
       </div>})}
     </div>})}
    </div>
    <div className={styles.insight}>
     {/* every possible state is mounted and stacked, so the box height never changes */}
     <div className={styles.insightLayer+(complete?'':' '+styles.layerOn)} aria-hidden={complete}><div className={styles.insightTitle}><Sparkles size={13}/><strong>{t('دستیار هوشمند فعال است')}</strong></div><p>{t('در حال نمایش مرحله‌به‌مرحله مکالمه…')}</p></div>
     {conversations.map(c=>{const on=complete&&c.id===activeId;return <div key={c.id} className={styles.insightLayer+(on?' '+styles.layerOn:'')} aria-hidden={!on}><div className={styles.insightTitle}><Sparkles size={13}/><strong>{c.review?tx('نیازمند بررسی انسانی'):tx('پاسخ پیشنهادی آماده')}</strong></div><p>{t(c.status)}</p><small><ShieldCheck size={12}/> {t('نمونه نمایشی؛ هیچ پیامی ارسال نمی‌شود')}</small></div>})}
    </div>
   </div>
  </div>
 </section>
 </div>;
}

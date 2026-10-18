'use client';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import {ArrowUpLeft, Boxes, Bot, ChartNoAxesCombined, Layers3, ShoppingBag, Sparkles} from 'lucide-react';
import styles from './PremiumShowcase.module.css';

const modules=[
 {code:'APU',title:'قیمت‌گذاری هوشمند',desc:'قیمت‌ها را با قوانین کسب‌و‌کارت هماهنگ نگه دار.',icon:ChartNoAxesCombined,accent:'price'},
 {code:'DORPIN',title:'تأمین و فروش',desc:'از تأمین‌کننده تا ویترین فروشگاه، یک مسیر منسجم.',icon:ShoppingBag,accent:'supply'},
 {code:'CIMA',title:'ارتباط با مشتری',desc:'تعامل‌ها، اطلاعات و پیگیری‌ها در یک فضای یکپارچه.',icon:Bot,accent:'crm'},
 {code:'BUILDER',title:'سایت‌ساز',desc:'یک حضور آنلاین متفاوت، با طراحی اختصاصی.',icon:Layers3,accent:'builder'}
];
export default function PremiumShowcase({siteName='DELSA',title='سیستم‌های متصل. تجربه‌ای یکپارچه.',description='هر بخش کسب‌وکارت به دیگری متصل است؛ از فروش و قیمت‌گذاری تا ارتباط با مشتری.',isBrand=true,compact=false}){
 const reducedMotion=useReducedMotion();
 return <section className={`${styles.showcase} ${compact?styles.compact:''}`} dir="rtl" aria-label="نمایش راهکارهای هوشمند">
  <div className={styles.glow} aria-hidden="true"/>
  <div className={styles.inner}>
   <div className={styles.copy}>
    <span className={styles.eyebrow}><Sparkles size={15}/> {isBrand?'DELSA / DIGITAL COMMERCE':siteName+' / DIGITAL EXPERIENCE'}</span>
    <h2>{title}</h2>
    <p>{description}</p>
    {isBrand&&<Link href="/store" className={styles.action}>کشف محصولات دلسا <ArrowUpLeft size={18}/></Link>}
    {!isBrand&&<span className={styles.signature}><Boxes size={15}/> ساخته‌شده با استودیوی طراحی دلسا</span>}
   </div>
   <div className={styles.scene} aria-label="نمایشی از چهار قابلیت">
    <div className={styles.orbit} aria-hidden="true"/>
    <div className={styles.core}><span className={styles.coreMark}><Sparkles size={21}/></span><strong>{siteName}</strong><small>Connected Experience</small></div>
    <div className={styles.cards}>{modules.map(({code,title:label,desc,icon:Icon,accent},i)=><motion.article initial={reducedMotion?false:{opacity:0,y:28}} whileInView={{opacity:1,y:0}} viewport={{once:false,amount:0.18}} transition={{duration:0.65,delay:reducedMotion?0:i*0.08,ease:[0.22,1,0.36,1]}} className={`${styles.module} ${styles[accent]}`} key={code} style={{'--stagger':i}}>
     <span className={styles.icon}><Icon size={19}/></span><div><b>{isBrand?code:label}</b><small>{isBrand?label:desc}</small></div><span className={styles.status} aria-hidden="true"/>
    </motion.article>)}</div>
   </div>
  </div>
 </section>
}
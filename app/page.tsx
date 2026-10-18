import Link from 'next/link';
import {ArrowLeft,ArrowUpLeft,CheckCircle2,ChevronDown,ShieldCheck,Sparkles,RefreshCw,Workflow,MessagesSquare,Store,ShoppingCart,Globe2,Layers3} from 'lucide-react';
import ChatLaunch from '../components/ChatLaunch';
import PremiumShowcase from '../components/PremiumShowcase';
import s from './home-ecosystem.module.css';

const products=[
 {id:'apu',name:'APU',title:'قیمت‌گذاری و پایش هوشمند',detail:'مدیریت قیمت محصولات بر اساس منابع تأمین، نرخ ارز و قوانین شخصی فروشگاه؛ با امکان بازبینی تغییرات.',icon:RefreshCw,href:'/store',tag:'قیمت‌گذاری'},
 {id:'dorpin',name:'DorPin',title:'تأمین و فروش یکپارچه',detail:'مدیریت منابع کالا، مقایسه تأمین‌کنندگان و فراهم‌کردن مسیر همگام‌سازی قیمت و فروش.',icon:ShoppingCart,href:'/store',tag:'تأمین و فروش'},
 {id:'cima',name:'CIMA',title:'ارتباط با مشتری، هوشمندتر',detail:'مدیریت مکالمات، اطلاعات مشتری و فرایندهای پیگیری در یک فضای CRM قابل توسعه.',icon:MessagesSquare,href:'/store',tag:'CRM و ارتباطات'},
 {id:'builder',name:'Site Builder',title:'فروشگاه و وب‌سایت اختصاصی',detail:'قالب‌های قابل ویرایش، طراحی صفحات و مدیریت محصولات در یک محیط یکپارچه.',icon:Store,href:'/builder',tag:'ساخت وب‌سایت'}
];
const steps=[
 {number:'01',title:'محصولت را انتخاب کن',body:'هر سیستم برای یک نیاز طراحی شده؛ از قیمت‌گذاری تا ارتباط با مشتری.'},
 {number:'02',title:'فضای کارت را فعال کن',body:'پس از ثبت‌نام، محصول‌های فعال در داشبورد یکپارچه نمایش داده می‌شوند.'},
 {number:'03',title:'همه‌چیز را در یک‌جا مدیریت کن',body:'اطلاعات، تنظیمات و گزارش‌های سیستم‌های متصل را از پنل دلسا دنبال کن.'}
];
export const metadata={title:'دلسا | اکوسیستم هوشمند کسب‌وکار',description:'محصولات دلسا: APU، دورپین، سیما و سایت‌ساز؛ راهکارهای هوشمند برای قیمت‌گذاری، تأمین کالا، ارتباط با مشتری و ساخت فروشگاه.'};
export default function Home(){return <>
<header className="site-header floating-header wrap"><Link href="/" className="brand" aria-label="خانه دلسا"><img className="brand-mark" src="/delsa-mark.svg" alt=""/><span className="brand-word">DELSA</span></Link><nav aria-label="منوی اصلی"><a href="#products">محصولات</a><a href="#ecosystem">اکوسیستم دلسا</a><a href="#how">نحوه کار</a><Link href="/store">فروشگاه</Link><Link href="/pricing">تعرفه‌ها</Link></nav><Link className="mobile-store-link" href="/store">محصولات</Link><Link className="button small" href="/login">ورود به پنل <ArrowUpLeft size={17}/></Link></header>
<main>
<section className={s.hero}>
 <div className={s.heroGlow} aria-hidden="true"/>
 <div className={s.heroLayout}>
  <div className={s.heroCopy}>
   <span className={s.kicker}><Sparkles size={15}/> DELSA · BUSINESS AUTOMATION</span>
   <h1>یک دلسا.<br/><em>برای تمام کسب‌وکارت.</em></h1>
   <p>قیمت‌گذاری، تأمین کالا، ارتباط با مشتری و ساخت فروشگاه؛ ابزارهای هوشمندی که کنار هم، مسیر مدیریت کسب‌وکار را ساده‌تر می‌کنند.</p>
   <div className={s.heroActions}><Link href="#products" className={s.mainAction}>کشف محصولات <ArrowUpLeft size={19}/></Link><Link href="/signup" className={s.secondaryAction}>شروع با دلسا <ArrowLeft size={18}/></Link></div>
   <div className={s.trust}><span><ShieldCheck size={15}/> یک پنل مشترک</span><span><Layers3 size={15}/> محصولات ماژولار</span><span><Globe2 size={15}/> قابل توسعه</span></div>
  </div>
  <div className={s.heroVisual} aria-label="نمایش مفهومی چهار محصول دلسا">
   <div className={s.ring} aria-hidden="true"/>
   <div className={s.hub}><img src="/delsa-mark.svg" alt=""/><b>DELSA</b><small>SMART BUSINESS HUB</small></div>
   {products.map((p,i)=><div className={s.satellite} key={p.id} data-slot={i}><span className={s.satelliteIcon}><p.icon size={22}/></span><span><b>{p.name}</b><small>{p.tag}</small></span></div>)}
  </div>
 </div>
 <a className={s.scroll} href="#products" aria-label="مشاهده محصولات"><ChevronDown size={21}/></a>
</section>
<section id="products" className={s.products}>
 <div className={s.container}><div className={s.sectionHeader}><div><span className={s.eyebrow}>DELSA PRODUCTS</span><h2>برای هر بخش، یک ابزار هوشمند.</h2></div><p>محصول‌های دلسا مستقل انتخاب می‌شوند، اما در یک اکوسیستم مشترک کنار هم قرار می‌گیرند.</p></div>
 <div className={s.productGrid}>{products.map((p,i)=><article id={p.id} className={s.productCard} key={p.id}><div className={s.cardTop}><span className={s.productIcon}><p.icon size={23}/></span><span className={s.index}>0{i+1}</span></div><div><span className={s.productTag}>{p.name} / {p.tag}</span><h3>{p.title}</h3><p>{p.detail}</p></div><Link className={s.cardLink} href={p.href}>آشنایی و دریافت اطلاعات <ArrowUpLeft size={17}/></Link></article>)}</div>
 <p className={s.availabilityNote}>قابلیت‌ها و زمان فعال‌سازی هر سرویس به وضعیت ارائه و اشتراک آن بستگی دارد. برای مشاهده محصولات منتشرشده و تعرفه‌ها به فروشگاه مراجعه کنید.</p>
 </div>
</section>
<div id="ecosystem"><PremiumShowcase title="چهار راهکار، یک اکوسیستم یکپارچه." description="دلسا ابزارهای جداگانه را در یک تجربه منسجم کنار هم قرار می‌دهد؛ هر سیستم در جای خودش، با یک پنل مشترک برای کسب‌وکار شما." /></div>
<section id="how" className={s.how}><div className={s.container}><div className={s.sectionHeader}><div><span className={s.eyebrow}>HOW IT WORKS</span><h2>ساده شروع کن، هوشمند رشد کن.</h2></div><p>از انتخاب اولین محصول تا مدیریت چند سرویس، همه‌چیز حول نیاز کسب‌وکار تو طراحی می‌شود.</p></div><div className={s.steps}>{steps.map(x=><article key={x.number}><span>{x.number}</span><h3>{x.title}</h3><p>{x.body}</p></article>)}</div></div></section>
<section className={s.useCases}><div className={s.container}><div className={s.useCaseHead}><span className={s.eyebrow}>ONE PLATFORM, MULTIPLE WORKFLOWS</span><h2>محصولات دلسا کنار هم چه می‌کنند؟</h2><p>هر ابزار کار خودش را انجام می‌دهد؛ ترکیب آن‌ها امکان ساخت فرایندهای یکپارچه‌تر را فراهم می‌کند.</p></div><div className={s.useCaseGrid}><article><span><Workflow size={24}/></span><h3>از منبع کالا تا قیمت فروش</h3><p>دورپین اطلاعات منابع تأمین را مدیریت می‌کند و APU می‌تواند قوانین قیمت‌گذاری فروشگاه را اعمال کند.</p></article><article><span><MessagesSquare size={24}/></span><h3>از بازدیدکننده تا مشتری</h3><p>سایت‌ساز بستر فروش را فراهم می‌کند و سیما به مدیریت مکالمات و پیگیری مشتریان کمک می‌کند.</p></article></div></div></section>
<section className={s.faq}><div className={s.container}><span className={s.eyebrow}>FAQ</span><h2>پرسش‌های رایج</h2><details><summary>آیا برای استفاده از دلسا باید همه محصولات را تهیه کنم؟</summary><p>خیر. می‌توانی با سرویس متناسب با نیازت شروع کنی و بعداً محصولات دیگر را اضافه کنی.</p></details><details><summary>محصول‌های فعال من کجا نمایش داده می‌شوند؟</summary><p>پس از ورود، سرویس‌های فعال‌شده در داشبورد اختصاصی حساب نمایش داده می‌شوند.</p></details><details><summary>کدام محصولات برای خرید آماده‌اند؟</summary><p>آخرین فهرست سرویس‌های منتشرشده و شرایط فعال‌سازی در فروشگاه دلسا مشخص می‌شود.</p></details></div></section>
<section className={s.closing}><div className={s.container}><div><span className={s.eyebrow}>BUILD WITH DELSA</span><h2>برای قدم بعدی کسب‌وکارت آماده‌ای؟</h2><p>محصول مناسب خودت را پیدا کن و از یک پنل مشترک شروع کن.</p></div><div className={s.closeActions}><Link className={s.mainAction} href="/store">مشاهده محصولات <ArrowUpLeft size={18}/></Link><ChatLaunch/></div></div></section>
</main>
<footer className="wrap footer"><Link href="/" className="brand"><img className="brand-mark" src="/delsa-mark.svg" alt=""/><span className="brand-word">DELSA</span></Link><span>Digital Engagement Layer System Automation</span><Link href="/admin/login">ورود مدیر</Link></footer>
</>}

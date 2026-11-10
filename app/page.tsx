import './homepage-cima.css';
import Link from 'next/link';
import ChatLaunch from '../components/ChatLaunch';
import AnimatedCimaInbox from '../components/AnimatedCimaInbox';
import { ArrowLeft, ArrowUpLeft, Check, ChevronDown, CircleHelp, Layers3, MessageCircle, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';

const steps = [
  ['۱', 'نیاز مشتری را از گفت‌وگو بفهم', 'هوش مصنوعی دلسا منظور مشتری و زمینهٔ مکالمه را دنبال می‌کند؛ حتی وقتی انتخاب محصول در چند پیام شکل می‌گیرد.'],
  ['۲', 'انتخاب را به سفارش تبدیل کن', 'محصول، رنگ، سایز و تعداد در سبد خرید جمع می‌شوند و اطلاعات لازم برای ثبت سفارش دریافت می‌شود.'],
  ['۳', 'پرداخت تا ارسال را پیگیری کن', 'پرداخت، وضعیت سفارش و کد رهگیری به همان گفت‌وگو و پروندهٔ مشتری متصل می‌مانند.'],
];

const features = [
  ['پاسخ‌گویی هوشمند در گفت‌وگو', 'دلسا سؤال دربارهٔ محصول، قیمت، موجودی، ویژگی‌ها، ارسال و روش خرید را با توجه به اطلاعات کسب‌وکار پاسخ می‌دهد.', Sparkles],
  ['فهم انتخاب‌های چندمرحله‌ای', 'وقتی مشتری در چند پیام مدل، رنگ، سایز یا تعداد را مشخص می‌کند، انتخاب‌ها در زمینهٔ مکالمه دنبال می‌شوند.', MessageCircle],
  ['سبد خرید و ثبت سفارش', 'افزودن، حذف یا تغییر تعداد محصولات؛ سپس ثبت نام گیرنده، شماره تماس، نشانی و کد پستی.', Layers3],
  ['پرداخت و تطبیق فیش', 'هدایت به درگاه یا ارسال اطلاعات کارت‌به‌کارت؛ فیش دریافتی به سفارش مربوط وصل و برای رسیدگی قابل پیگیری می‌شود.', ShieldCheck],
  ['پرونده و شناخت مشتری', 'اطلاعات تماس، گفت‌وگوها، علاقه‌مندی‌ها، سفارش‌ها و پیگیری‌های قبلی در پروندهٔ مشتری کنار هم قرار می‌گیرند.', RefreshCw],
  ['پیگیری سفارش و تحلیل فروش', 'وضعیت سفارش و کد رهگیری به گفت‌وگو متصل است؛ پنل هم مکالمه‌ها، سفارش‌ها، پرداخت‌ها و تحلیل‌های فروش را نشان می‌دهد.', Check],
] as const;

export default function Home() { return <>
<header className="site-header floating-header wrap">
  <Link href="/" className="brand" aria-label="دلسا، خانه"><img className="brand-mark" src="/delsa-mark.svg" alt=""/><span className="brand-word">DELSA</span></Link>
  <nav aria-label="منوی اصلی"><a href="#cima">CIMA · CRM</a><a href="#how">نحوهٔ کار</a><a href="#channels">کانال‌ها</a><a href="#apu">APU</a><Link href="/store">فروشگاه</Link><Link href="/pricing">تعرفه</Link></nav>
  <Link className="mobile-store-link" href="/store">فروشگاه</Link><Link className="button small" href="/login">ورود به پنل <ArrowUpLeft size={17}/></Link>
</header>
<main>
<section className="delsa-cima-hero" aria-labelledby="delsa-hero-title" dir="rtl">
 <div className="delsa-cima-hero-layout wrap">
  <div className="delsa-cima-copy">
   <div className="delsa-cima-kicker"><span className="delsa-cima-live-dot"/> DELSA / CIMA · CRM هوشمند</div>
   <h1 id="delsa-hero-title">از اولین پیام<br/><span>تا فروش موفق.</span></h1>
   <p className="delsa-cima-lead">مکالمه‌های مشتری را به فروش تبدیل کن؛ از پاسخ‌گویی و انتخاب محصول تا ثبت سفارش و پیگیری، در یک پنل یکپارچه.</p>
   <div className="delsa-cima-actions"><Link href="/signup" className="delsa-cima-primary">شروع با CIMA <ArrowUpLeft size={18}/></Link><ChatLaunch/></div>
   <div className="delsa-cima-highlights"><span><MessageCircle size={16}/> مدیریت پیام‌ها</span><span><Layers3 size={16}/> سبد خرید و سفارش</span><span><ShieldCheck size={16}/> نظارت انسانی</span></div>
  </div>
  <div className="delsa-cima-visual" aria-label="نمونه نمایشی داشبورد گفت‌وگوهای CIMA">
    <AnimatedCimaInbox/>
  </div>
 </div>
 <a className="delsa-cima-next" href="#cima" aria-label="مشاهده قابلیت‌های CIMA"><ChevronDown size={20}/></a>
</section>

<section id="cima" className="wrap cima-intro">
  <div className="cima-section-heading"><span className="eyebrow">CIMA / CUSTOMER INTELLIGENCE & MESSAGING ASSISTANT</span><h2>CRM دلسا؛ از مکالمه<br/>تا مدیریت فروش.</h2><p>CIMA گفت‌وگوی مشتری را به مسیر فروش وصل می‌کند: از شناخت نیاز و معرفی محصول تا ساخت سبد خرید، دریافت اطلاعات سفارش، پرداخت و پیگیری ارسال. سابقهٔ مشتری و وضعیت هر سفارش هم در پنل دلسا در دسترس تیم است.</p></div>
  <div className="cima-feature-grid">{features.map(([title, copy, Icon])=><article className="cima-feature" key={title}><span><Icon size={19}/></span><h3>{title}</h3><p>{copy}</p></article>)}</div>
</section>

<section id="how" className="steps-section cima-steps"><div className="wrap"><div className="section-head"><div><span className="eyebrow">یک مسیر پیوسته برای فروش پیام‌محور</span><h2>از سؤال محصول تا کد رهگیری</h2></div><p>مکالمه، سفارش و سابقهٔ مشتری در یک مسیر کنار هم قرار می‌گیرند.</p></div><div className="steps-grid">{steps.map(([num,title,copy])=><article key={num}><span className="step-number">{num}</span><span className="step-spark"><Sparkles size={18}/></span><h3>{title}</h3><p>{copy}</p></article>)}</div><p className="cima-trust-note"><ShieldCheck size={16}/> هرجا تصمیم یا بررسی صاحب کسب‌وکار لازم باشد، گفت‌وگو از پنل برای رسیدگی انسانی در دسترس است.</p></div></section>

<section id="channels" className="wrap cima-channels"><div><span className="eyebrow">کانال‌های ارتباطی</span><h2>یک پنل برای پیام‌رسان‌های مختلف</h2><p>طبق معرفی سیستم دلسا، اتصال اینستاگرام، واتساپ، تلگرام، بله، ایتا، روبیکا و سروش آمادهٔ استفاده است؛ گفت‌وگوها از هر مسیر در فضای مشترک مدیریت می‌شوند.</p></div><div className="cima-channel-list"><span className="connected"><i/> اینستاگرام</span><span className="connected"><i/> واتساپ</span><span className="connected"><i/> تلگرام</span><span className="connected"><i/> بله</span><span className="connected"><i/> ایتا</span><span className="connected"><i/> روبیکا</span><span className="connected"><i/> سروش</span></div></section>

<section id="apu" className="wrap apu-story cima-apu-story"><div className="story-copy"><span className="eyebrow">یک محصول دیگر دلسا · APU</span><h2>قیمت‌ها را<br/>با دید باز مدیریت کن.</h2><p>APU قیمت محصول‌ها را با منابعی که تعریف می‌کنی مقایسه می‌کند و اختلاف‌های مهم را برای بازبینی نشان می‌دهد.</p><ul><li><Check/> مقایسهٔ قیمت با منابع مشخص</li><li><Check/> هشدار برای اختلاف‌های مهم</li><li><Check/> تأیید انسانی پیش از تغییر</li></ul><Link href="/signup" className="text-link">آشنایی با دلسا <ArrowLeft size={16}/></Link></div>
<div className="apu-demo"><div className="demo-head"><div className="demo-title"><span className="demo-icon"><RefreshCw size={16}/></span><div><b>پایش قیمت</b><small>فروشگاه نمونه · اجرای نمایشی</small></div></div><span className="live-tag"><i/> نمونهٔ رابط</span></div><div className="demo-stats"><div><small>محصول بررسی‌شده</small><b>۱۲۸</b></div><div><small>نیازمند بازبینی</small><b className="text-orange">۰۸</b></div><div><small>بدون تغییر</small><b>۱۲۰</b></div></div><div className="demo-line"><span>محصول</span><span>فروشگاه</span><span>منبع</span><span>وضعیت</span></div>{[['کرم آبرسان روزانه','۴۸۰٬۰۰۰','۵۱۵٬۰۰۰','بازبینی'],['شامپو بدون سولفات','۲۲۰٬۰۰۰','۲۲۸٬۰۰۰','تغییر جزئی'],['سرم ویتامین C','۳۹۰٬۰۰۰','۳۹۰٬۰۰۰','همسان']].map((x,i)=><div className="demo-line demo-product" key={x[0]}><span><b>{x[0]}</b><small>SKU-20{i+1}8</small></span><strong>{x[1]}</strong><strong>{x[2]}</strong><span className={'demo-status status-'+i}>{x[3]}</span></div>)}<div className="demo-foot"><CircleHelp size={14}/> اعداد این بخش نمونه‌اند.</div></div></section>

<section className="wrap faq"><div className="section-head"><div><span className="eyebrow">پاسخ روشن</span><h2>پرسش‌های CIMA</h2></div></div>
<details><summary>CIMA چه کاری برای تیم فروش انجام می‌دهد؟</summary><p>پیام‌ها را در مسیر فروش به هم وصل می‌کند: پاسخ به پرسش‌های محصول، ثبت انتخاب‌ها در سبد خرید، دریافت اطلاعات سفارش، پیگیری پرداخت و اطلاع‌رسانی وضعیت ارسال.</p></details>
<details><summary>اگر گفت‌وگو به تصمیم صاحب کسب‌وکار نیاز داشته باشد چه می‌شود؟</summary><p>صاحب کسب‌وکار یا همکار مجاز می‌تواند سابقهٔ مشتری را در پنل ببیند، پاسخ را بنویسد و ارتباط را ادامه دهد. پاسخ‌ها و اصلاح‌های تأییدشده نیز می‌توانند به بهبود پاسخ‌های بعدی کمک کنند.</p></details>
<details><summary>چه اطلاعاتی در پروندهٔ مشتری نگه‌داری می‌شود؟</summary><p>اطلاعات تماس، سابقهٔ گفت‌وگو، علاقه‌مندی‌ها، سفارش‌ها و پیگیری‌ها. اطلاعات متناسب با نوع کسب‌وکار مثل سایز، رنگ یا مدل خودرو هم قابل ثبت است.</p></details>
<details><summary>کدام پیام‌رسان‌ها به دلسا وصل می‌شوند؟</summary><p>طبق فایل معرفی سیستم، اتصال اینستاگرام، واتساپ، تلگرام، بله، ایتا، روبیکا و سروش آمادهٔ استفاده است.</p></details>
<details><summary>آیا پیگیری خودکار و تحلیل‌ها هم وجود دارد؟</summary><p>پنل، وضعیت مکالمه‌ها، سفارش‌ها و پرداخت‌ها را نشان می‌دهد و تحلیل‌های فروش و رفتار مشتری از قابلیت‌های فعلی‌اند. خودکارسازی پیگیری متناسب با وضعیت مشتری، در مسیر توسعهٔ سیستم است.</p></details>
<details><summary>APU چه جایگاهی در دلسا دارد؟</summary><p>APU یکی دیگر از محصولات دلساست و روی به‌روزرسانی قیمت تمرکز دارد؛ CIMA مدیریت مکالمه و فروش را پوشش می‌دهد.</p></details></section>

<section className="wrap closing"><div><span className="eyebrow">DELSA · CIMA</span><h2>هر گفت‌وگو را به شناخت بهتر مشتری تبدیل کن.</h2><p>برای دیدن فضای کاری دلسا حساب بساز یا تعرفه‌ها را بررسی کن.</p></div><div className="closing-actions"><Link className="button primary" href="/signup">شروع با CIMA <ArrowUpLeft size={19}/></Link><Link className="button" href="/pricing">دیدن تعرفه‌ها <ArrowLeft size={17}/></Link></div></section>
</main>
<footer className="wrap footer"><Link href="/" className="brand"><img className="brand-mark" src="/delsa-mark.svg" alt=""/><span className="brand-word">DELSA</span></Link><span>Digital Engagement Layer System Automation</span><Link href="/admin/login">ورود مدیر</Link></footer>
</> }

import Link from 'next/link';
import ChatLaunch from '../components/ChatLaunch';
import { ArrowLeft, ArrowUpLeft, Check, ChevronDown, CircleHelp, Layers3, MessageCircle, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';

const steps = [
  ['۱', 'پیام‌ها را یکجا ببین', 'گفت‌وگوهای کانال‌های متصل را در یک صندوق ورودی دنبال کن.'],
  ['۲', 'مشتری را با زمینه‌اش بشناس', 'تاریخچه تعامل و اطلاعات ثبت‌شده کنار همان گفت‌وگو نمایش داده می‌شود.'],
  ['۳', 'پاسخ را با اطمینان بررسی کن', 'پیشنهادهای هوش مصنوعی را بازبینی کن؛ موارد نامطمئن به صف بررسی انسانی می‌روند.'],
];

const features = [
  ['صندوق ورودی یکپارچه', 'گفت‌وگوها را در یک فضای کاری پیگیری کن؛ با وضعیت پیام و مسیر روشن برای پاسخ‌دادن.', MessageCircle],
  ['پروندهٔ واقعی مشتری', 'پیام‌ها و تعامل‌های قبلی کنار گفت‌وگوی تازه قرار می‌گیرند تا پاسخ با شناخت بهتری نوشته شود.', Layers3],
  ['هوش مصنوعی با نظارت انسان', 'CIMA پاسخ پیشنهادی می‌سازد. وقتی اطلاعات کافی نیست، پیام برای بررسی و ویرایش به صف انسانی می‌رود.', ShieldCheck],
];

export default function Home() { return <>
<header className="site-header floating-header wrap">
  <Link href="/" className="brand" aria-label="دلسا، خانه"><img className="brand-mark" src="/delsa-mark.svg" alt=""/><span className="brand-word">DELSA</span></Link>
  <nav aria-label="منوی اصلی"><a href="#cima">CIMA · CRM</a><a href="#how">نحوهٔ کار</a><a href="#channels">کانال‌ها</a><a href="#apu">APU</a><Link href="/store">فروشگاه</Link><Link href="/pricing">تعرفه</Link></nav>
  <Link className="mobile-store-link" href="/store">فروشگاه</Link><Link className="button small" href="/login">ورود به پنل <ArrowUpLeft size={17}/></Link>
</header>
<main>
<section className="cinematic-hero apu-hero cima-hero">
  <div className="apu-hero-art cima-hero-art" aria-label="پیش‌نمایش نمونهٔ صندوق ورودی و پروندهٔ مشتری CIMA">
    <div className="cima-board">
      <div className="cima-board-top"><span className="cima-live"><i/> محیط نمونه</span><b>صندوق ورودی CIMA</b><span className="cima-board-mark">DELSA</span></div>
      <div className="cima-board-body">
        <div className="cima-conversations">
          <div className="cima-search">جست‌وجوی مخاطب یا پیام</div>
          <div className="cima-conversation active"><span className="cima-avatar">م</span><span><b>مریم احمدی</b><small>برای ارسال سفارش چه زمانی…</small></span><i>۲ دقیقه</i></div>
          <div className="cima-conversation"><span className="cima-avatar alt">ع</span><span><b>علی رضایی</b><small>موجودی رنگ مشکی رو دارید؟</small></span><i>۱۸ دقیقه</i></div>
          <div className="cima-conversation"><span className="cima-avatar muted">ن</span><span><b>نگار محمدی</b><small>ممنون از راهنمایی شما</small></span><i>۱ ساعت</i></div>
          <div className="cima-channel-note"><MessageCircle size={14}/> اینستاگرام · گفت‌وگوی متصل</div>
        </div>
        <div className="cima-thread">
          <div className="cima-contact"><span className="cima-avatar">م</span><span><b>مریم احمدی</b><small>پروندهٔ مشتری · ۶ تعامل</small></span><span className="cima-contact-tag">مشتری</span></div>
          <div className="cima-message theirs">سلام، سفارش من امروز ارسال می‌شه؟</div>
          <div className="cima-message mine">شماره سفارش رو می‌فرمایید تا بررسی کنم؟</div>
          <div className="cima-message theirs">۴۸۲۱، ممنون</div>
          <div className="cima-draft"><div><Sparkles size={14}/><b>پاسخ پیشنهادی · نیازمند بررسی</b></div><p>ممنون مریم. وضعیت سفارش ۴۸۲۱ را بررسی می‌کنم و نتیجه را همین‌جا اطلاع می‌دهم.</p><span><ShieldCheck size={13}/> پیش از ارسال، بازبینی انسانی</span></div>
        </div>
      </div>
    </div>
  </div>
  <div className="cinematic-inner wrap">
    <div className="cinematic-label"><span className="cinematic-pulse"/> CIMA · CRM مکالمه‌محور دلسا</div>
    <h1 className="apu-headline">همهٔ گفت‌وگوها،<br/><em>یک شناخت از مشتری.</em></h1>
    <div className="cinematic-intro"><div><span className="cinematic-overline">از پیام تا رابطهٔ ماندگار.</span><p>CIMA پیام‌های مشتری را در یک فضای کاری جمع می‌کند، سابقهٔ تعامل را کنار گفت‌وگو می‌آورد و برای پاسخ‌گویی به تیم شما کمک می‌کند.</p></div>
      <div className="hero-actions"><Link className="button primary" href="/signup">شروع با CIMA <ArrowUpLeft size={19}/></Link><ChatLaunch/></div>
    </div>
    <div className="hero-proof"><span><MessageCircle size={16}/> صندوق گفت‌وگوها</span><span><Layers3 size={16}/> پروندهٔ مشتری</span><span><ShieldCheck size={16}/> بازبینی انسانی</span></div>
  </div>
  <a className="hero-scroll" href="#cima" aria-label="دیدن قابلیت‌های CIMA"><ChevronDown size={20}/></a>
</section>

<section id="cima" className="wrap cima-intro">
  <div className="cima-section-heading"><span className="eyebrow">CIMA / CUSTOMER INTELLIGENCE & MESSAGING ASSISTANT</span><h2>CRM دلسا؛ شناخت مشتری<br/>از دل گفت‌وگوها.</h2><p>CIMA فقط فهرست مخاطب‌ها نیست. پیام، سابقهٔ ارتباط و پاسخ بعدی را در یک مسیر به هم وصل می‌کند تا تیم بداند چه کسی پیام داده، قبلاً چه گفته و چه کاری باید انجام شود.</p></div>
  <div className="cima-feature-grid">{features.map(([title, copy, Icon])=><article className="cima-feature" key={title}><span><Icon size={19}/></span><h3>{title}</h3><p>{copy}</p></article>)}</div>
</section>

<section id="how" className="steps-section cima-steps"><div className="wrap"><div className="section-head"><div><span className="eyebrow">پاسخ‌گویی روشن و قابل‌کنترل</span><h2>پیام ورودی تا پاسخ، با زمینهٔ کامل</h2></div><p>CIMA به تیم کمک می‌کند سریع‌تر پاسخ دهد و کنترل گفتگو را حفظ کند.</p></div><div className="steps-grid">{steps.map(([num,title,copy])=><article key={num}><span className="step-number">{num}</span><span className="step-spark"><Sparkles size={18}/></span><h3>{title}</h3><p>{copy}</p></article>)}</div><p className="cima-trust-note"><ShieldCheck size={16}/> ارسال خودکار پاسخ در وضعیت فعلی خاموش است؛ پاسخ‌ها از مسیر انسانی بازبینی و ارسال می‌شوند.</p></div></section>

<section id="channels" className="wrap cima-channels"><div><span className="eyebrow">کانال‌های ارتباطی</span><h2>مکالمه‌ها در مسیر اتصال به یک CRM</h2><p>اتصال اینستاگرام در نسخهٔ فعلی؛ پشتیبانی از کانال‌های دیگر به‌صورت مرحله‌ای و بر اساس دسترسی API هر پیام‌رسان توسعه می‌یابد.</p></div><div className="cima-channel-list"><span className="connected"><i/> اینستاگرام · اتصال فعلی</span><span>واتساپ · در مسیر توسعه</span><span>تلگرام · در مسیر توسعه</span><span>بله · در مسیر توسعه</span><span>ایتا · در مسیر توسعه</span><span>روبیکا · در مسیر توسعه</span></div></section>

<section id="apu" className="wrap apu-story cima-apu-story"><div className="story-copy"><span className="eyebrow">یک محصول دیگر دلسا · APU</span><h2>قیمت‌ها را<br/>با دید باز مدیریت کن.</h2><p>APU قیمت محصول‌ها را با منابعی که تعریف می‌کنی مقایسه می‌کند و اختلاف‌های مهم را برای بازبینی نشان می‌دهد.</p><ul><li><Check/> مقایسهٔ قیمت با منابع مشخص</li><li><Check/> هشدار برای اختلاف‌های مهم</li><li><Check/> تأیید انسانی پیش از تغییر</li></ul><Link href="/signup" className="text-link">آشنایی با دلسا <ArrowLeft size={16}/></Link></div>
<div className="apu-demo"><div className="demo-head"><div className="demo-title"><span className="demo-icon"><RefreshCw size={16}/></span><div><b>پایش قیمت</b><small>فروشگاه نمونه · اجرای نمایشی</small></div></div><span className="live-tag"><i/> نمونهٔ رابط</span></div><div className="demo-stats"><div><small>محصول بررسی‌شده</small><b>۱۲۸</b></div><div><small>نیازمند بازبینی</small><b className="text-orange">۰۸</b></div><div><small>بدون تغییر</small><b>۱۲۰</b></div></div><div className="demo-line"><span>محصول</span><span>فروشگاه</span><span>منبع</span><span>وضعیت</span></div>{[['کرم آبرسان روزانه','۴۸۰٬۰۰۰','۵۱۵٬۰۰۰','بازبینی'],['شامپو بدون سولفات','۲۲۰٬۰۰۰','۲۲۸٬۰۰۰','تغییر جزئی'],['سرم ویتامین C','۳۹۰٬۰۰۰','۳۹۰٬۰۰۰','همسان']].map((x,i)=><div className="demo-line demo-product" key={x[0]}><span><b>{x[0]}</b><small>SKU-20{i+1}8</small></span><strong>{x[1]}</strong><strong>{x[2]}</strong><span className={'demo-status status-'+i}>{x[3]}</span></div>)}<div className="demo-foot"><CircleHelp size={14}/> اعداد این بخش نمونه‌اند.</div></div></section>

<section className="wrap faq"><div className="section-head"><div><span className="eyebrow">پاسخ روشن</span><h2>پرسش‌های CIMA</h2></div></div>
<details><summary>CIMA چه تفاوتی با CRM معمولی دارد؟</summary><p>CIMA روی مکالمه‌های مشتری متمرکز است: صندوق گفت‌وگو، سابقهٔ تعامل و پروندهٔ مشتری را کنار هم قرار می‌دهد و به تیم برای تهیهٔ پاسخ کمک می‌کند.</p></details>
<details><summary>آیا هوش مصنوعی خودش برای مشتری پیام می‌فرستد؟</summary><p>در وضعیت فعلی، ارسال خودکار خاموش است. پاسخ‌های پیشنهادی در اختیار اپراتور قرار می‌گیرند و موارد نامطمئن باید انسانی بررسی شوند.</p></details>
<details><summary>کدام کانال‌ها متصل هستند؟</summary><p>اتصال اینستاگرام در نسخهٔ فعلی در دسترس است. اتصال واتساپ، تلگرام، بله، ایتا و روبیکا به‌صورت مرحله‌ای توسعه می‌یابد.</p></details>
<details><summary>APU چه جایگاهی در دلسا دارد؟</summary><p>APU محصول دیگری از دلساست که برای پایش و مقایسهٔ قیمت طراحی شده؛ CIMA در صفحهٔ اصلی، محصول محوری ارتباط با مشتری است.</p></details></section>

<section className="wrap closing"><div><span className="eyebrow">DELSA · CIMA</span><h2>هر گفت‌وگو را به شناخت بهتر مشتری تبدیل کن.</h2><p>برای دیدن فضای کاری دلسا حساب بساز یا تعرفه‌ها را بررسی کن.</p></div><div className="closing-actions"><Link className="button primary" href="/signup">شروع با CIMA <ArrowUpLeft size={19}/></Link><Link className="button" href="/pricing">دیدن تعرفه‌ها <ArrowLeft size={17}/></Link></div></section>
</main>
<footer className="wrap footer"><Link href="/" className="brand"><img className="brand-mark" src="/delsa-mark.svg" alt=""/><span className="brand-word">DELSA</span></Link><span>Digital Engagement Layer System Automation</span><Link href="/admin/login">ورود مدیر</Link></footer>
</> }

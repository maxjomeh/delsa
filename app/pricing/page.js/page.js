import './pricing.css';
import Link from 'next/link';
import {ArrowLeft, ArrowUpLeft, Check, CircleHelp, Sparkles} from 'lucide-react';

export const metadata={
  title:'پلن‌ها و اشتراک | دلسا',
  description:'پلن مناسب برای یکپارچه‌سازی پیام‌ها، سفارش‌ها و فرایند فروش کسب‌وکار شما.',
};

const plans=[
  {
    id:'trial',
    label:'برای آشنایی',
    name:'آزمایشی',
    price:'رایگان',
    note:'دسترسی به محیط نمایشی دلسا',
    description:'جریان کار را ببین و با بخش‌های اصلی پنل آشنا شو.',
    features:['پیش‌نمایش داشبورد','مشاهده‌ی جریان پیام تا سفارش','اطلاعات نمونه برای بررسی'],
    cta:'ورود به محیط آزمایشی',
    href:'/dashboard',
  },
  {
    id:'business',
    label:'برای شروع فروش یکپارچه',
    name:'کسب‌وکار',
    price:'متناسب با نیاز',
    note:'قیمت نهایی پس از تعیین دامنه‌ی راه‌اندازی',
    description:'برای کسب‌وکارهایی که می‌خواهند پیام‌ها، کالاها و سفارش‌ها را در یک مسیر جمع کنند.',
    features:['کانال‌های پیام‌رسانِ فعال‌شده','صندوق پیام و پیگیری مشتری','کاتالوگ، موجودی و مدیریت سفارش','راهنمای راه‌اندازی اولیه'],
    cta:'بررسی محیط دلسا',
    href:'/dashboard',
    popular:true,
  },
  {
    id:'custom',
    label:'برای جریان‌های خاص',
    name:'سازمانی',
    price:'استعلام قیمت',
    note:'بر اساس کانال‌ها و نیازهای اختصاصی',
    description:'برای تیم‌هایی که اتصال‌ها یا گردش‌کار سفارشی می‌خواهند.',
    features:['بررسی اتصال‌های موردنیاز','طراحی گردش‌کار متناسب','برنامه‌ی راه‌اندازی و پشتیبانی','بررسی APU و اتصال فروشگاه'],
    cta:'مشاهده‌ی پیش‌نمایش',
    href:'/dashboard',
  },
];

const questions=[
  ['آیا می‌توانم بدون پرداخت دلسا را ببینم؟','بله. محیط آزمایشی برای بررسی پنل در دسترس است؛ داده‌ها و اتصال‌های آن نمونه‌اند.'],
  ['قیمت پلن‌ها چطور تعیین می‌شود؟','قیمت‌گذاری نهایی به دامنه‌ی راه‌اندازی، کانال‌های موردنیاز و حجم کار بستگی دارد. مبلغ و شرایط نهایی باید پیش از فعال‌سازی به شما اعلام شود.'],
  ['آیا پرداخت آنلاین و تمدید خودکار فعال است؟','هنوز نه. این صفحه پیش‌نمایش پلن‌هاست و پرداخت اشتراک تا زمان اتصال سرویس پرداخت و تکمیل تنظیمات فعال نمی‌شود.'],
  ['چه کانال‌هایی در نسخه‌ی اولیه هدف‌گذاری شده‌اند؟','بله، ایتا، روبیکا و سروش در برنامه‌ی نسخه‌ی اولیه هستند. فعال‌شدن هر اتصال نیازمند راه‌اندازی جداگانه‌ی دسترسی و سرویس آن است.'],
];

export default function PricingPage(){
  return <main className="pricing-page">
    <header className="pricing-header wrap">
      <Link href="/" className="brand" aria-label="دلسا، صفحه‌ی اصلی"><img className="brand-mark" src="/delsa-mark.svg" alt=""/><span className="brand-word">DELSA</span></Link>
      <nav aria-label="منوی صفحه"><Link href="/#systems">سیستم‌ها</Link><Link href="/#workflow">نحوه‌ی کار</Link><Link href="/dashboard">داشبورد آزمایشی</Link></nav>
    </header>
    <section className="pricing-hero wrap">
      <span className="eyebrow"><Sparkles size={16}/> پلن‌های دلسا</span>
      <h1>از یک تجربه‌ی آزمایشی،<br/><em>تا فروش یکپارچه.</em></h1>
      <p>پلن مناسب را بر اساس کانال‌ها و فرایندهای کسب‌وکارت انتخاب کن. قیمت و امکانات پلن‌های پولی پس از نهایی‌شدن دامنه‌ی راه‌اندازی اعلام می‌شود.</p>
      <div className="pricing-promise"><span><Check size={16}/> شروع با محیط آزمایشی</span><span><Check size={16}/> راه‌اندازی متناسب با نیاز</span><span><CircleHelp size={16}/> بدون پرداخت در این پیش‌نمایش</span></div>
    </section>
    <section className="pricing-grid wrap" aria-label="پلن‌های اشتراک">
      {plans.map(plan=><article key={plan.id} className={`pricing-card${plan.popular?' pricing-card-featured':''}`}>
        {plan.popular&&<span className="pricing-ribbon">پیشنهاد برای شروع</span>}
        <div className="pricing-card-top"><span className="pricing-label">{plan.label}</span><span className="pricing-mark"><img src="/delsa-mark.svg" alt=""/></span></div>
        <h2>{plan.name}</h2>
        <p className="pricing-description">{plan.description}</p>
        <div className="pricing-amount">{plan.price}</div>
        <p className="pricing-note">{plan.note}</p>
        <ul>{plan.features.map(feature=><li key={feature}><Check size={17}/>{feature}</li>)}</ul>
        <Link className={`button${plan.popular?' primary':''} pricing-cta`} href={plan.href}>{plan.cta}<ArrowUpLeft size={18}/></Link>
      </article>)}
    </section>
    <p className="pricing-disclaimer wrap">این صفحه برای نمایش تجربه‌ی پلن‌هاست؛ ثبت اشتراک، دریافت وجه و تمدید خودکار هنوز فعال نیست.</p>
    <section className="pricing-faq wrap">
      <div className="pricing-faq-heading"><span className="eyebrow">سؤال‌های متداول</span><h2>قبل از شروع، بدان.</h2><p>اگر برای انتخاب مسیر مناسب مطمئن نیستی، اول محیط آزمایشی را ببین.</p><Link href="/dashboard" className="text-button">بازکردن داشبورد آزمایشی <ArrowLeft size={17}/></Link></div>
      <div className="pricing-questions">{questions.map(([question,answer])=><details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div>
    </section>
    <footer className="pricing-footer wrap"><Link href="/" className="brand"><img className="brand-mark" src="/delsa-mark.svg" alt=""/><span className="brand-word">DELSA</span></Link><span>Digital Engagement Layer System Automation</span><Link href="/">بازگشت به صفحه‌ی اصلی <ArrowLeft size={15}/></Link></footer>
  </main>;
}

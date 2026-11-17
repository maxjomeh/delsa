import './home.css';
import '@fontsource/vazirmatn/800.css';
import Link from 'next/link';
import { ArrowLeft, ArrowUpLeft, Check } from 'lucide-react';
import HomeHeader from '../components/home/HomeHeader';
import Hero from '../components/home/Hero';
import Marquee from '../components/home/Marquee';
import Stats from '../components/home/Stats';
import Reveal from '../components/home/Reveal';
import Bento from '../components/home/Bento';
import Steps from '../components/home/Steps';
import ChannelOrbit from '../components/home/ChannelOrbit';
import PriceLive from '../components/home/PriceLive';
import Faq, { type QA } from '../components/home/Faq';
import Zdog3D from '../components/home/Zdog3D';
import CimaCustomerProfileDemo from '../components/CimaCustomerProfileDemo';

const faq: QA[] = [
  ['CIMA چه کاری برای تیم فروش انجام می‌دهد؟', 'پیام‌ها را در مسیر فروش به هم وصل می‌کند: پاسخ به پرسش‌های محصول، ثبت انتخاب‌ها در سبد خرید، دریافت اطلاعات سفارش، پیگیری پرداخت و اطلاع‌رسانی وضعیت ارسال.'],
  ['اگر گفت‌وگو به تصمیم صاحب کسب‌وکار نیاز داشته باشد چه می‌شود؟', 'صاحب کسب‌وکار یا همکار مجاز می‌تواند سابقهٔ مشتری را در پنل ببیند، پاسخ را بنویسد و ارتباط را ادامه دهد. پاسخ‌ها و اصلاح‌های تأییدشده نیز می‌توانند به بهبود پاسخ‌های بعدی کمک کنند.'],
  ['چه اطلاعاتی در پروندهٔ مشتری نگه‌داری می‌شود؟', 'اطلاعات تماس، سابقهٔ گفت‌وگو، علاقه‌مندی‌ها، سفارش‌ها و پیگیری‌ها. اطلاعات متناسب با نوع کسب‌وکار مثل سایز، رنگ یا مدل خودرو هم قابل ثبت است.'],
  ['کدام پیام‌رسان‌ها به دلسا وصل می‌شوند؟', 'طبق فایل معرفی سیستم، اتصال اینستاگرام، واتساپ، تلگرام، بله، ایتا، روبیکا و سروش آمادهٔ استفاده است.'],
  ['آیا پیگیری خودکار و تحلیل‌ها هم وجود دارد؟', 'پنل، وضعیت مکالمه‌ها، سفارش‌ها و پرداخت‌ها را نشان می‌دهد و تحلیل‌های فروش و رفتار مشتری از قابلیت‌های فعلی‌اند. خودکارسازی پیگیری متناسب با وضعیت مشتری، در مسیر توسعهٔ سیستم است.'],
  ['APU چه جایگاهی در دلسا دارد؟', 'APU یکی دیگر از محصولات دلساست و روی به‌روزرسانی قیمت تمرکز دارد؛ CIMA مدیریت مکالمه و فروش را پوشش می‌دهد.'],
];

export default function Home() {
  return (
    <>
      <div className="hx">
        <HomeHeader />
        <main>
          <Hero />

          <div className="hx-marquee-sec">
            <p className="hx-marquee-label">یک پنل برای همهٔ پیام‌رسان‌های مشتری‌هایت</p>
            <Marquee />
          </div>

          <section id="cima" className="hx-sec">
            <div className="hx-wrap">
              <Reveal className="hx-center hx-cima-head">
                <span className="hx-eyebrow"><i /> CIMA · Customer Intelligence &amp; Messaging Assistant</span>
                <h2 className="hx-h2">CRM دلسا؛ از مکالمه<br /><span className="hx-grad">تا مدیریت فروش.</span></h2>
                <p className="hx-lead">CIMA گفت‌وگوی مشتری را به مسیر فروش وصل می‌کند: از شناخت نیاز و معرفی محصول تا ساخت سبد خرید، دریافت اطلاعات سفارش، پرداخت و پیگیری ارسال. سابقهٔ مشتری و وضعیت هر سفارش هم در پنل دلسا در دسترس تیم است.</p>
              </Reveal>
              <Reveal>
                <div className="hx-frame"><CimaCustomerProfileDemo /></div>
              </Reveal>
              <Bento />
              <Stats />
            </div>
          </section>

          <section id="how" className="hx-sec hx-steps-sec hx-inv">
            <div className="hx-wrap">
              <Reveal className="hx-center">
                <span className="hx-eyebrow"><i /> یک مسیر پیوسته برای فروش پیام‌محور</span>
                <h2 className="hx-h2">از سؤال محصول<br /><span className="hx-grad">تا کد رهگیری</span></h2>
                <p className="hx-lead">مکالمه، سفارش و سابقهٔ مشتری در یک مسیر کنار هم قرار می‌گیرند.</p>
              </Reveal>
              <Steps />
            </div>
          </section>

          <section id="channels" className="hx-sec">
            <div className="hx-wrap hx-ch-grid">
              <Reveal>
                <span className="hx-eyebrow"><i /> کانال‌های ارتباطی</span>
                <h2 className="hx-h2">یک پنل برای<br /><span className="hx-grad">پیام‌رسان‌های مختلف</span></h2>
                <p className="hx-lead">طبق معرفی سیستم دلسا، اتصال اینستاگرام، واتساپ، تلگرام، بله، ایتا، روبیکا و سروش آمادهٔ استفاده است؛ گفت‌وگوها از هر مسیر در فضای مشترک مدیریت می‌شوند.</p>
              </Reveal>
              <Reveal delay={0.12}><ChannelOrbit /></Reveal>
            </div>
          </section>

          <section id="apu" className="hx-sec hx-alt">
            <div className="hx-wrap hx-apu-grid">
              <Reveal className="hx-apu-copy">
                <span className="hx-eyebrow"><i /> یک محصول دیگر دلسا · APU</span>
                <h2 className="hx-h2">قیمت‌ها را<br /><span className="hx-grad">با دید باز مدیریت کن.</span></h2>
                <p className="hx-lead">APU قیمت محصول‌ها را با منابعی که تعریف می‌کنی مقایسه می‌کند و اختلاف‌های مهم را برای بازبینی نشان می‌دهد.</p>
                <ul>
                  <li><span><Check size={14} /></span> مقایسهٔ قیمت با منابع مشخص</li>
                  <li><span><Check size={14} /></span> هشدار برای اختلاف‌های مهم</li>
                  <li><span><Check size={14} /></span> تأیید انسانی پیش از تغییر</li>
                </ul>
                <Link href="/signup" className="hx-link">آشنایی با دلسا <ArrowLeft size={16} /></Link>
              </Reveal>
              <Reveal delay={0.1}><PriceLive /></Reveal>
            </div>
          </section>

          <section className="hx-sec">
            <div className="hx-wrap">
              <Reveal className="hx-center">
                <span className="hx-eyebrow"><i /> پاسخ روشن</span>
                <h2 className="hx-h2">پرسش‌های <span className="hx-grad">CIMA</span></h2>
              </Reveal>
              <Faq items={faq} />
            </div>
          </section>

          <section className="hx-sec" style={{ paddingBlock: 'clamp(30px,5vw,60px) 0' }}>
            <div className="hx-wrap">
              <Reveal>
                <div className="hx-cta hx-inv">
                  <div className="hx-cta-copy">
                    <span className="hx-eyebrow"><i /> DELSA · CIMA</span>
                    <h2>هر گفت‌وگو را به <span className="hx-grad">شناخت بهتر مشتری</span> تبدیل کن.</h2>
                    <p>برای دیدن فضای کاری دلسا حساب بساز یا تعرفه‌ها را بررسی کن.</p>
                    <div className="hx-actions">
                      <Link className="hx-btn hx-btn-primary" href="/signup">شروع با CIMA <ArrowUpLeft size={18} /></Link>
                      <Link className="hx-btn" href="/pricing">دیدن تعرفه‌ها <ArrowLeft size={17} /></Link>
                    </div>
                  </div>
                  <Zdog3D />
                </div>
              </Reveal>
            </div>
          </section>
        </main>

        <footer className="hx-footer hx-inv">
          <div className="hx-wrap hx-foot-grid">
            <div className="hx-foot-about">
              <Link href="/" className="hx-brand"><img src="/delsa-mark.svg" alt="" width={34} height={34} />DELSA</Link>
              <p>Digital Engagement Layer System Automation</p>
            </div>
            <div><h4>محصولات</h4><a href="#cima">CIMA · CRM</a><a href="#apu">APU</a><Link href="/store">فروشگاه</Link></div>
            <div><h4>دلسا</h4><a href="#how">نحوهٔ کار</a><a href="#channels">کانال‌ها</a><Link href="/pricing">تعرفه</Link></div>
            <div><h4>حساب</h4><Link href="/login">ورود به پنل</Link><Link href="/signup">ساخت حساب</Link><Link href="/admin/login">ورود مدیر</Link></div>
          </div>
        </footer>
      </div>
    </>
  );
}

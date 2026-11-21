import '../home.css';
import '@fontsource/vazirmatn/800.css';
import Link from '../../components/i18n/Link';
import { getI18n } from '../../lib/i18n/server';
import { ArrowLeft, ArrowUpLeft, Check } from 'lucide-react';
import HomeHeader from '../../components/home/HomeHeader';
import SiteFooter from '../../components/home/SiteFooter';
import Hero from '../../components/home/Hero';
import Marquee from '../../components/home/Marquee';
import Stats from '../../components/home/Stats';
import Reveal from '../../components/home/Reveal';
import Bento from '../../components/home/Bento';
import Steps from '../../components/home/Steps';
import ChannelOrbit from '../../components/home/ChannelOrbit';
import PriceLive from '../../components/home/PriceLive';
import Faq, { type QA } from '../../components/home/Faq';
import Zdog3D from '../../components/home/Zdog3D';
import { BrandText } from '../../components/home/BrandIcon';
import CimaCustomerProfileDemo from '../../components/CimaCustomerProfileDemo';

export default async function Home() {
  const { t } = await getI18n();
  const faq: QA[] = [
    [t('CIMA چه کاری برای تیم فروش انجام می‌دهد؟'), t('پیام‌ها را در مسیر فروش به هم وصل می‌کند: پاسخ به پرسش‌های محصول، ثبت انتخاب‌ها در سبد خرید، دریافت اطلاعات سفارش، پیگیری پرداخت و اطلاع‌رسانی وضعیت ارسال.')],
    [t('اگر گفت‌وگو به تصمیم صاحب کسب‌وکار نیاز داشته باشد چه می‌شود؟'), t('صاحب کسب‌وکار یا همکار مجاز می‌تواند سابقهٔ مشتری را در پنل ببیند، پاسخ را بنویسد و ارتباط را ادامه دهد. پاسخ‌ها و اصلاح‌های تأییدشده نیز می‌توانند به بهبود پاسخ‌های بعدی کمک کنند.')],
    [t('چه اطلاعاتی در پروندهٔ مشتری نگه‌داری می‌شود؟'), t('اطلاعات تماس، سابقهٔ گفت‌وگو، علاقه‌مندی‌ها، سفارش‌ها و پیگیری‌ها. اطلاعات متناسب با نوع کسب‌وکار مثل سایز، رنگ یا مدل خودرو هم قابل ثبت است.')],
    [t('کدام پیام‌رسان‌ها به دلسا وصل می‌شوند؟'), t('طبق فایل معرفی سیستم، اتصال اینستاگرام، واتساپ، تلگرام، بله، ایتا، روبیکا و سروش آمادهٔ استفاده است.')],
    [t('آیا پیگیری خودکار و تحلیل‌ها هم وجود دارد؟'), t('پنل، وضعیت مکالمه‌ها، سفارش‌ها و پرداخت‌ها را نشان می‌دهد و تحلیل‌های فروش و رفتار مشتری از قابلیت‌های فعلی‌اند. خودکارسازی پیگیری متناسب با وضعیت مشتری، در مسیر توسعهٔ سیستم است.')],
    [t('APU چه جایگاهی در دلسا دارد؟'), t('APU یکی دیگر از محصولات دلساست و روی به‌روزرسانی قیمت تمرکز دارد؛ CIMA مدیریت مکالمه و فروش را پوشش می‌دهد.')],
  ];
  return (
    <>
      <div className="hx">
        <HomeHeader />
        <main>
          <Hero />

          <div className="hx-marquee-sec">
            <p className="hx-marquee-label">{t('یک پنل برای همهٔ پیام‌رسان‌های مشتری‌هایت')}</p>
            <Marquee />
          </div>

          <section id="cima" className="hx-sec">
            <div className="hx-wrap">
              <Reveal className="hx-center hx-cima-head">
                <span className="hx-eyebrow"><i /> CIMA · Customer Intelligence &amp; Messaging Assistant</span>
                <h2 className="hx-h2">{t('CRM دلسا؛ از مکالمه')}<br /><span className="hx-grad">{t('تا مدیریت فروش.')}</span></h2>
                <p className="hx-lead">{t('CIMA گفت‌وگوی مشتری را به مسیر فروش وصل می‌کند: از شناخت نیاز و معرفی محصول تا ساخت سبد خرید، دریافت اطلاعات سفارش، پرداخت و پیگیری ارسال. سابقهٔ مشتری و وضعیت هر سفارش هم در پنل دلسا در دسترس تیم است.')}</p>
              </Reveal>
              <Reveal>
                <div className="hx-frame"><CimaCustomerProfileDemo /></div>
              </Reveal>
              <Bento />
              <Stats />
            </div>
          </section>

          <section id="how" className="hx-sec hx-steps-sec hx-alt">
            <div className="hx-wrap">
              <Reveal className="hx-center">
                <span className="hx-eyebrow"><i /> {t('یک مسیر پیوسته برای فروش پیام‌محور')}</span>
                <h2 className="hx-h2">{t('از سؤال محصول')}<br /><span className="hx-grad">{t('تا کد رهگیری')}</span></h2>
                <p className="hx-lead">{t('مکالمه، سفارش و سابقهٔ مشتری در یک مسیر کنار هم قرار می‌گیرند.')}</p>
              </Reveal>
              <Steps />
            </div>
          </section>

          <section id="channels" className="hx-sec">
            <div className="hx-wrap hx-ch-grid">
              <Reveal>
                <span className="hx-eyebrow"><i /> {t('کانال‌های ارتباطی')}</span>
                <h2 className="hx-h2">{t('یک پنل برای')}<br /><span className="hx-grad">{t('پیام‌رسان‌های مختلف')}</span></h2>
                <p className="hx-lead"><BrandText text={t('طبق معرفی سیستم دلسا، اتصال اینستاگرام، واتساپ، تلگرام، بله، ایتا، روبیکا و سروش آمادهٔ استفاده است؛ گفت‌وگوها از هر مسیر در فضای مشترک مدیریت می‌شوند.')} size={19} /></p>
              </Reveal>
              <Reveal delay={0.12}><ChannelOrbit /></Reveal>
            </div>
          </section>

          <section id="apu" className="hx-sec hx-alt">
            <div className="hx-wrap hx-apu-grid">
              <Reveal className="hx-apu-copy">
                <span className="hx-eyebrow"><i /> {t('یک محصول دیگر دلسا · APU')}</span>
                <h2 className="hx-h2">{t('قیمت‌ها را')}<br /><span className="hx-grad">{t('با دید باز مدیریت کن.')}</span></h2>
                <p className="hx-lead">{t('APU قیمت محصول‌ها را با منابعی که تعریف می‌کنی مقایسه می‌کند و اختلاف‌های مهم را برای بازبینی نشان می‌دهد.')}</p>
                <ul>
                  <li><span><Check size={14} /></span> {t('مقایسهٔ قیمت با منابع مشخص')}</li>
                  <li><span><Check size={14} /></span> {t('هشدار برای اختلاف‌های مهم')}</li>
                  <li><span><Check size={14} /></span> {t('تأیید انسانی پیش از تغییر')}</li>
                </ul>
                <Link href="/signup" className="hx-link">{t('آشنایی با دلسا')} <ArrowLeft size={16} /></Link>
              </Reveal>
              <Reveal delay={0.1}><PriceLive /></Reveal>
            </div>
          </section>

          <section className="hx-sec">
            <div className="hx-wrap">
              <Reveal className="hx-center">
                <span className="hx-eyebrow"><i /> {t('پاسخ روشن')}</span>
                <h2 className="hx-h2">{t('پرسش‌های')} <span className="hx-grad">CIMA</span></h2>
              </Reveal>
              <Faq items={faq} />
            </div>
          </section>

          <section className="hx-sec" style={{ paddingBlock: 'clamp(30px,5vw,60px) 0' }}>
            <div className="hx-wrap">
              <Reveal>
                <div className="hx-cta">
                  <div className="hx-cta-copy">
                    <span className="hx-eyebrow"><i /> DELSA · CIMA</span>
                    <h2>{t('هر گفت‌وگو را به')} <span className="hx-grad">{t('شناخت بهتر مشتری')}</span> {t('تبدیل کن.')}</h2>
                    <p>{t('برای دیدن فضای کاری دلسا حساب بساز یا تعرفه‌ها را بررسی کن.')}</p>
                    <div className="hx-actions">
                      <Link className="hx-btn hx-btn-primary" href="/signup">{t('شروع با CIMA')} <ArrowUpLeft size={18} /></Link>
                      <Link className="hx-btn" href="/pricing">{t('دیدن تعرفه‌ها')} <ArrowLeft size={17} /></Link>
                    </div>
                  </div>
                  <Zdog3D />
                </div>
              </Reveal>
            </div>
          </section>
        </main>

        <SiteFooter />
      </div>
    </>
  );
}

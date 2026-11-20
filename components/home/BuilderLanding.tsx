'use client';

import Link from '../i18n/Link';
import { createContext, useContext } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { createTranslator } from '../../lib/i18n/config';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpLeft, BookOpen, Check, Layers3, MonitorSmartphone, MousePointerClick, Moon, Package, Palette, Rocket, ShoppingBag, Smartphone, Sparkles, UsersRound, Wand2, Monitor } from 'lucide-react';
import HomeHeader from './HomeHeader';
import SiteFooter from './SiteFooter';
import Reveal from './Reveal';
import TiltCard from './TiltCard';
import ScaledSite from './ScaledSite';
import BuilderTemplateArt from '../BuilderTemplateArt';
import { starter, templates, FREE_BUILDER_ENABLED } from '../../lib/site-builder';
import { industries } from '../../lib/builder-industries';
import '../../app/home.css';
import '../../app/pages.css';
import '../../app/builder-landing.css';

// Template, industry and starter copy live in the "site" dictionary (server-loaded for this page).
const SiteMsg = createContext<{ messages: Record<string, string>; st: (s: string) => string }>({ messages: {}, st: (s) => s });
const useSite = () => useContext(SiteMsg);

const HERO_CYCLE = ['zarrin', 'shab', 'jashn', 'mehr', 'bagh', 'noor'];
const SWATCHES = ['#ff5a1f', '#7c3aed', '#2563eb', '#0f766e', '#a33c57', '#53763c', '#b96943', '#de432b'];

function spot(e: React.PointerEvent<HTMLElement>) {
  if (e.pointerType === 'touch') return;
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--sx', `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty('--sy', `${e.clientY - r.top}px`);
}

/** True on phone-width screens (decided after mount, so server and first client render agree). */
function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(max-width: 640px)');
    const sync = () => setNarrow(m.matches);
    sync();
    m.addEventListener('change', sync);
    return () => m.removeEventListener('change', sync);
  }, []);
  return narrow;
}

/** Browser-window chrome around a live template preview. */
function BrowserFrame({ children, url = 'delsaai.ir/s/your-brand' }: { children: React.ReactNode; url?: string }) {
  return (
    <div className="bl-browser">
      <div className="bl-bar" aria-hidden="true">
        <span className="bl-dots"><i /><i /><i /></span>
        <span className="bl-url" dir="ltr">{url}</span>
      </div>
      {children}
    </div>
  );
}

function HeroPreview() {
  const { t, locale } = useI18n();
  const { messages, st } = useSite();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const narrow = useNarrow();
  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setI((v) => (v + 1) % HERO_CYCLE.length), 5200);
    return () => window.clearInterval(timer);
  }, [paused]);
  const id = HERO_CYCLE[i];
  const doc = useMemo(() => starter(id, t('کسب‌وکار شما'), 'general', locale, messages), [id, locale, messages, t]);
  const meta = templates.find((x: any) => x.id === id);
  return (
    <div className="bl-stage" onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
      <div className="hx-chip a" aria-hidden="true"><span className="ic"><MousePointerClick size={19} /></span><span><b>{t('ویرایشگر بصری')}</b><small>{t('بکش، بنویس، منتشر کن')}</small></span></div>
      {narrow ? (
        <div key={id} className="bl-swap bl-phone-solo"><div className="bl-phone"><ScaledSite doc={doc} messages={messages} width={390} ratio="9 / 16" /></div></div>
      ) : (
        <BrowserFrame>
          <div key={id} className="bl-swap"><ScaledSite doc={doc} messages={messages} /></div>
        </BrowserFrame>
      )}
      <div className="hx-chip c" aria-hidden="true"><span className="ic"><Palette size={19} /></span><span><b>{t('رنگ برند تو')}</b><small>{t('در همهٔ قالب‌ها')}</small></span></div>
      <div className="bl-dots-nav" role="tablist" aria-label={t('نمونه قالب‌ها')}>
        {HERO_CYCLE.map((tid, n) => (
          <button key={tid} type="button" role="tab" aria-selected={n === i} aria-label={t('قالب {name}', { name: st(templates.find((x: any) => x.id === tid)?.name ?? '') })} className={n === i ? 'on' : ''} onClick={() => setI(n)} />
        ))}
      </div>
      <p className="bl-cap" aria-live="polite">{meta ? st(meta.name) : ''} {t('· نمونهٔ زندهٔ قالب')}</p>
    </div>
  );
}

function Studio() {
  const { t, locale } = useI18n();
  const { messages, st } = useSite();
  const [industry, setIndustry] = useState('general');
  const [template, setTemplate] = useState('mehr');
  const [color, setColor] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const narrow = useNarrow();
  useEffect(() => setMobile(narrow), [narrow]);
  const stageRef = useRef<HTMLDivElement>(null);
  const ind: any = industries.find((x: any) => x.id === industry) ?? industries[0];
  const suggested: string[] = ind.templates;
  const ordered = useMemo(
    () => [...templates].sort((a: any, b: any) => Number(suggested.includes(b.id)) - Number(suggested.includes(a.id))),
    [suggested],
  );
  const base = useMemo(() => starter(template, t('کسب‌وکار شما'), industry, locale, messages), [template, industry, locale, messages, t]);
  const doc = useMemo(() => ({ ...base, color: color ?? base.color }), [base, color]);
  const meta: any = templates.find((x: any) => x.id === template);

  function pickIndustry(id: string) {
    setIndustry(id);
    const next: any = industries.find((x: any) => x.id === id);
    if (next && !next.templates.includes(template)) setTemplate(next.templates[0]);
  }
  function pickTemplate(id: string) {
    setTemplate(id);
    if (window.matchMedia('(max-width: 1000px)').matches) stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="bl-studio">
      <div className="bl-controls">
        <div className="bl-group">
          <h3>{t('۱. صنف کسب‌وکارت')}</h3>
          <div className="bl-chips" role="group" aria-label={t('صنف کسب‌وکار')}>
            {industries.map((x: any) => (
              <button key={x.id} type="button" aria-pressed={industry === x.id} onClick={() => pickIndustry(x.id)}>{st(x.name)}</button>
            ))}
          </div>
          <p className="bl-hint">{st(ind.description)}</p>
        </div>
        <div className="bl-group">
          <h3>{t('۲. قالب')}</h3>
          <div className="bl-tpls" role="group" aria-label={t('قالب‌ها')}>
            {ordered.map((tpl: any) => (
              <button key={tpl.id} type="button" className="bl-tpl" aria-pressed={template === tpl.id} onClick={() => pickTemplate(tpl.id)}>
                <BuilderTemplateArt template={tpl.id} name={st(tpl.name)} compact />
                <strong>{st(tpl.name)}{industry !== 'general' && suggested.includes(tpl.id) ? ' ★' : ''}</strong>
              </button>
            ))}
          </div>
        </div>
        <div className="bl-group">
          <h3>{t('۳. رنگ برند')}</h3>
          <div className="bl-swatches" role="group" aria-label={t('رنگ برند')}>
            <button type="button" className="bl-sw auto" aria-pressed={color === null} onClick={() => setColor(null)}>{t('رنگ قالب')}</button>
            {SWATCHES.map((c) => (
              <button key={c} type="button" className="bl-sw" aria-label={t('رنگ {c}', { c })} aria-pressed={color === c} style={{ ['--c' as string]: c }} onClick={() => setColor(c)} />
            ))}
          </div>
        </div>
      </div>

      <div className="bl-viewer" ref={stageRef}>
        <div className="bl-viewbar">
          <div>
            <strong>{meta ? st(meta.name) : ''}</strong>
            <small>{meta ? st(meta.description) : ''}</small>
          </div>
          <div className="bl-seg" role="group" aria-label={t('نوع نمایش')}>
            <button type="button" aria-pressed={!mobile} onClick={() => setMobile(false)}><Monitor size={16} /> {t('دسکتاپ')}</button>
            <button type="button" aria-pressed={mobile} onClick={() => setMobile(true)}><Smartphone size={16} /> {t('موبایل')}</button>
          </div>
        </div>
        <BrowserFrame>
          {mobile ? (
            <div className="bl-phone-wrap"><div className="bl-phone"><ScaledSite key={'m' + template} doc={doc} messages={messages} width={390} ratio="9 / 17" /></div></div>
          ) : (
            <div key={'d' + template} className="bl-swap"><ScaledSite doc={doc} messages={messages} /></div>
          )}
        </BrowserFrame>
        <div className="bl-cta-row">
          <Link className="hx-btn hx-btn-primary" href="/signup">{t('با همین قالب شروع کن')} <ArrowUpLeft size={18} /></Link>
          <Link className="hx-btn" href="/builder/demo">{t('ویرایشگر را امتحان کن')} <ArrowLeft size={17} /></Link>
        </div>
      </div>
    </div>
  );
}

const makeFeatures = (t: (s: string, v?: Record<string, string | number>) => string, nf: (n: number) => string) => [
  { icon: <MousePointerClick size={20} />, title: t('ویرایشگر بصری'), copy: t('بخش‌ها را بچین، متن و تصویر را عوض کن و ظاهر دسکتاپ و موبایل را جدا تنظیم کن؛ با پیش‌نمایش لحظه‌ای.'), wide: true, tag: t('بدون کدنویسی') },
  { icon: <ShoppingBag size={20} />, title: t('فروشگاه کامل'), copy: t('محصول ساده و متغیر، موجودی، سبد خرید، سفارش، کوپن تخفیف و ارسال؛ همه در یک پنل.'), tag: t('محصول تا سفارش') },
  { icon: <Layers3 size={20} />, title: t('{templates} قالب، {industries} صنف', { templates: nf(templates.length), industries: nf(industries.length) }), copy: t('پوشاک، کتاب، کالای دیجیتال، قطعات خودرو و فروشگاه عمومی؛ با فیلدها و فیلترهای مخصوص هر صنف.'), tag: t('هر قالب یک هویت') },
  { icon: <BookOpen size={20} />, title: t('ویژهٔ کتاب‌فروشی'), copy: t('نویسنده، مترجم، ناشر، کتاب هفته و مقایسهٔ ویرایش‌ها؛ با جلد شناور در قالب سینمایی.'), wide: true, tag: t('نمونه: قالب تحریریه') },
  { icon: <Wand2 size={20} />, title: t('حرکت و انیمیشن'), copy: t('سه سطح حرکت: ساده، متعادل و سینمایی؛ و احترام به تنظیم «کاهش حرکت» دستگاه.'), tag: t('زنده و روان') },
  { icon: <UsersRound size={20} />, title: t('دفتر مشتریان مستقل'), copy: t('اطلاعات مشتریان هر فروشگاه جدا از فروشگاه‌های دیگر می‌ماند و از پنل قابل پیگیری است.'), tag: t('هر فروشگاه جدا') },
  { icon: <Moon size={20} />, title: t('تم روشن و تیره'), copy: t('هر قالب با رنگ برند تو در هر دو تم خوانا می‌ماند؛ متن‌ها و دکمه‌ها کنتراست مناسب دارند.'), tag: t('خوانا در هر تم') },
];

const makeSteps = (t: (s: string, v?: Record<string, string | number>) => string, nf: (n: number) => string) => [
  { n: nf(1), icon: <Rocket size={20} />, title: t('حساب بساز'), copy: t('ثبت‌نام رایگان است و چند دقیقه بیشتر زمان نمی‌برد.') },
  { n: nf(2), icon: <Palette size={20} />, title: t('قالب و رنگ را انتخاب کن'), copy: t('صنف خودت را بگو تا قالب‌های مناسب‌تر اول فهرست بیایند.') },
  { n: nf(3), icon: <Package size={20} />, title: t('محصولات را اضافه کن'), copy: t('تصویر، قیمت و گزینه‌ها را وارد کن و ظاهر صفحه‌ها را بچین.') },
  { n: nf(4), icon: <MonitorSmartphone size={20} />, title: t('منتشر کن'), copy: t('سایتت روی آدرس delsaai.ir/s/نام-تو در دسترس مشتری‌هاست.') },
];

export default function BuilderLanding({ siteMessages }: { siteMessages?: Record<string, string> }) {
  const { t, locale, intl } = useI18n();
  const nf = (n: number) => new Intl.NumberFormat(intl).format(n);
  const features = makeFeatures(t, nf);
  const steps = makeSteps(t, nf);
  const messages = siteMessages ?? {};
  const site = useMemo(() => ({ messages, st: createTranslator(locale, messages, { quiet: true }) }), [locale, messages]);
  return (
    <SiteMsg.Provider value={site}>
    <div className="hx bl">
      <HomeHeader home={false} />
      <main>
        <section className="hx-hero bl-hero">
          <div className="hx-aurora" aria-hidden="true"><i className="hx-blob a" /><i className="hx-blob b" /><i className="hx-blob c" /></div>
          <div className="hx-grid" aria-hidden="true" />
          <div className="hx-wrap hx-hero-inner">
            <div className="hx-copy">
              <span className="hx-eyebrow"><i /> {t('سایت‌ساز و فروشگاه‌ساز دلسا')}</span>
              <h1 className="hx-h1">
                <span className="hx-line">{t('خانهٔ آنلاین')}</span>
                <span className="hx-line"><span className="hx-grad">{t('کسب‌وکار تو.')}</span></span>
              </h1>
              <p className="hx-lead">
                {FREE_BUILDER_ENABLED
                  ? t('رایگان شروع کن؛ تا ۱۰ محصول فعال در هر فروشگاه، با طراحی و انتشار سایت از پنل خودت.')
                  : t('سایت و فروشگاهت را بساز؛ محصولات، سفارش‌ها و مشتریان را از پنل خودت مدیریت کن.')}
              </p>
              <div className="hx-actions">
                <Link className="hx-btn hx-btn-primary" href="/signup">{t('ساخت حساب دلسا')} <ArrowUpLeft size={18} /></Link>
                <Link className="hx-btn" href="#studio">{t('قالب‌ها را ببین')} <ArrowLeft size={17} /></Link>
              </div>
              <ul className="bl-checks">
                <li><Check size={16} /> {t('ویرایشگر بصری')}</li>
                <li><Check size={16} /> {t('انتشار صفحات')}</li>
                <li><Check size={16} /> {t('دفتر مشتریان مستقل')}</li>
              </ul>
            </div>
            <HeroPreview />
          </div>
        </section>

        <section className="hx-sec hx-alt" id="studio">
          <div className="hx-wrap">
            <Reveal className="hx-center">
              <span className="hx-eyebrow"><i /> {t('استودیوی زنده')}</span>
              <h2 className="hx-h2">{t('قالبت را')} <span className="hx-grad">{t('همین‌جا')}</span> {t('امتحان کن.')}</h2>
              <p className="hx-lead">{t('صنف، قالب و رنگ برندت را انتخاب کن و ببین سایتت چطور به نظر می‌رسد؛ در نمای دسکتاپ و موبایل.')}</p>
            </Reveal>
            <Studio />
          </div>
        </section>

        <section className="hx-sec" id="features">
          <div className="hx-wrap">
            <Reveal className="hx-center">
              <span className="hx-eyebrow"><i /> {t('امکانات')}</span>
              <h2 className="hx-h2">{t('از طراحی تا')} <span className="hx-grad">{t('مدیریت فروش')}</span>.</h2>
            </Reveal>
            <div className="hx-bento">
              {features.map((f, i) => (
                <Reveal key={f.title} className={'hx-card-wrap' + (f.wide ? ' s2' : '')} delay={(i % 3) * 0.07}>
                  <TiltCard as="article" className={'hx-card hx-tilt bl-feature'} onPointerMove={spot}>
                    <span className="bl-ico" aria-hidden="true">{f.icon}</span>
                    <h3>{f.title}</h3>
                    <p>{f.copy}</p>
                    <span className="hx-tag"><Sparkles size={13} /> {f.tag}</span>
                  </TiltCard>
                </Reveal>
              ))}
            </div>
            <p className="hx-demo-note bl-note">{t('پرداخت فعلاً دستی یا هنگام تحویل است؛ اتصال درگاه آنلاین، دامنهٔ اختصاصی و اجرای اتوماسیون‌ها هنوز فعال نیست.')}</p>
          </div>
        </section>

        <section className="hx-sec hx-alt">
          <div className="hx-wrap">
            <Reveal className="hx-center">
              <span className="hx-eyebrow"><i /> {t('شروع سریع')}</span>
              <h2 className="hx-h2">{t('چهار قدم تا')} <span className="hx-grad">{t('سایت آنلاین')}</span>.</h2>
            </Reveal>
            <ol className="bl-steps">
              {steps.map((s, i) => (
                <li key={s.n}>
                  <Reveal delay={i * 0.08}>
                    <div className="bl-step">
                      <span className="bl-step-n">{s.n}</span>
                      <span className="bl-ico" aria-hidden="true">{s.icon}</span>
                      <h3>{s.title}</h3>
                      <p>{s.copy}</p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="hx-sec" style={{ paddingBlock: 'clamp(30px,5vw,60px) clamp(64px,8vw,112px)' }}>
          <div className="hx-wrap">
            <Reveal>
              <div className="hx-cta bl-cta">
                <div className="hx-cta-copy">
                  <span className="hx-eyebrow"><i /> {t('DELSA · سایت‌ساز')}</span>
                  <h2>{t('فروشگاهت را')} <span className="hx-grad">{t('امروز')}</span> {t('آنلاین کن.')}</h2>
                  <p>{t('حساب بساز، قالب را انتخاب کن و اولین محصولت را منتشر کن.')}</p>
                  <div className="hx-actions">
                    <Link className="hx-btn hx-btn-primary" href="/signup">{t('ساخت حساب دلسا')} <ArrowUpLeft size={18} /></Link>
                    <Link className="hx-btn" href="/builder/demo">{t('امتحان ویرایشگر')} <ArrowLeft size={17} /></Link>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
    </SiteMsg.Provider>
  );
}

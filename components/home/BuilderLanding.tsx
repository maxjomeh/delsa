'use client';

import Link from 'next/link';
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
import { fa } from './fa';
import '../../app/home.css';
import '../../app/pages.css';
import '../../app/builder-landing.css';

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
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const narrow = useNarrow();
  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setInterval(() => setI((v) => (v + 1) % HERO_CYCLE.length), 5200);
    return () => window.clearInterval(t);
  }, [paused]);
  const id = HERO_CYCLE[i];
  const doc = useMemo(() => starter(id, 'کسب‌وکار شما', 'general'), [id]);
  const meta = templates.find((t: any) => t.id === id);
  return (
    <div className="bl-stage" onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
      <div className="hx-chip a" aria-hidden="true"><span className="ic"><MousePointerClick size={19} /></span><span><b>ویرایشگر بصری</b><small>بکش، بنویس، منتشر کن</small></span></div>
      {narrow ? (
        <div key={id} className="bl-swap bl-phone-solo"><div className="bl-phone"><ScaledSite doc={doc} width={390} ratio="9 / 16" /></div></div>
      ) : (
        <BrowserFrame>
          <div key={id} className="bl-swap"><ScaledSite doc={doc} /></div>
        </BrowserFrame>
      )}
      <div className="hx-chip c" aria-hidden="true"><span className="ic"><Palette size={19} /></span><span><b>رنگ برند تو</b><small>در همهٔ قالب‌ها</small></span></div>
      <div className="bl-dots-nav" role="tablist" aria-label="نمونه قالب‌ها">
        {HERO_CYCLE.map((t, n) => (
          <button key={t} type="button" role="tab" aria-selected={n === i} aria-label={`قالب ${templates.find((x: any) => x.id === t)?.name}`} className={n === i ? 'on' : ''} onClick={() => setI(n)} />
        ))}
      </div>
      <p className="bl-cap" aria-live="polite">{meta?.name} · نمونهٔ زندهٔ قالب</p>
    </div>
  );
}

function Studio() {
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
  const base = useMemo(() => starter(template, 'کسب‌وکار شما', industry), [template, industry]);
  const doc = useMemo(() => ({ ...base, color: color ?? base.color }), [base, color]);
  const meta: any = templates.find((t: any) => t.id === template);

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
          <h3>۱. صنف کسب‌وکارت</h3>
          <div className="bl-chips" role="group" aria-label="صنف کسب‌وکار">
            {industries.map((x: any) => (
              <button key={x.id} type="button" aria-pressed={industry === x.id} onClick={() => pickIndustry(x.id)}>{x.name}</button>
            ))}
          </div>
          <p className="bl-hint">{ind.description}</p>
        </div>
        <div className="bl-group">
          <h3>۲. قالب</h3>
          <div className="bl-tpls" role="group" aria-label="قالب‌ها">
            {ordered.map((t: any) => (
              <button key={t.id} type="button" className="bl-tpl" aria-pressed={template === t.id} onClick={() => pickTemplate(t.id)}>
                <BuilderTemplateArt template={t.id} compact />
                <strong>{t.name}{industry !== 'general' && suggested.includes(t.id) ? ' ★' : ''}</strong>
              </button>
            ))}
          </div>
        </div>
        <div className="bl-group">
          <h3>۳. رنگ برند</h3>
          <div className="bl-swatches" role="group" aria-label="رنگ برند">
            <button type="button" className="bl-sw auto" aria-pressed={color === null} onClick={() => setColor(null)}>رنگ قالب</button>
            {SWATCHES.map((c) => (
              <button key={c} type="button" className="bl-sw" aria-label={`رنگ ${c}`} aria-pressed={color === c} style={{ ['--c' as string]: c }} onClick={() => setColor(c)} />
            ))}
          </div>
        </div>
      </div>

      <div className="bl-viewer" ref={stageRef}>
        <div className="bl-viewbar">
          <div>
            <strong>{meta?.name}</strong>
            <small>{meta?.description}</small>
          </div>
          <div className="bl-seg" role="group" aria-label="نوع نمایش">
            <button type="button" aria-pressed={!mobile} onClick={() => setMobile(false)}><Monitor size={16} /> دسکتاپ</button>
            <button type="button" aria-pressed={mobile} onClick={() => setMobile(true)}><Smartphone size={16} /> موبایل</button>
          </div>
        </div>
        <BrowserFrame>
          {mobile ? (
            <div className="bl-phone-wrap"><div className="bl-phone"><ScaledSite key={'m' + template} doc={doc} width={390} ratio="9 / 17" /></div></div>
          ) : (
            <div key={'d' + template} className="bl-swap"><ScaledSite doc={doc} /></div>
          )}
        </BrowserFrame>
        <div className="bl-cta-row">
          <Link className="hx-btn hx-btn-primary" href="/signup">با همین قالب شروع کن <ArrowUpLeft size={18} /></Link>
          <Link className="hx-btn" href="/builder/demo">ویرایشگر را امتحان کن <ArrowLeft size={17} /></Link>
        </div>
      </div>
    </div>
  );
}

const features = [
  { icon: <MousePointerClick size={20} />, title: 'ویرایشگر بصری', copy: 'بخش‌ها را بچین، متن و تصویر را عوض کن و ظاهر دسکتاپ و موبایل را جدا تنظیم کن؛ با پیش‌نمایش لحظه‌ای.', wide: true, tag: 'بدون کدنویسی' },
  { icon: <ShoppingBag size={20} />, title: 'فروشگاه کامل', copy: 'محصول ساده و متغیر، موجودی، سبد خرید، سفارش، کوپن تخفیف و ارسال؛ همه در یک پنل.', tag: 'محصول تا سفارش' },
  { icon: <Layers3 size={20} />, title: `${fa(templates.length)} قالب، ${fa(industries.length)} صنف`, copy: 'پوشاک، کتاب، کالای دیجیتال، قطعات خودرو و فروشگاه عمومی؛ با فیلدها و فیلترهای مخصوص هر صنف.', tag: 'هر قالب یک هویت' },
  { icon: <BookOpen size={20} />, title: 'ویژهٔ کتاب‌فروشی', copy: 'نویسنده، مترجم، ناشر، کتاب هفته و مقایسهٔ ویرایش‌ها؛ با جلد شناور در قالب سینمایی.', wide: true, tag: 'نمونه: قالب تحریریه' },
  { icon: <Wand2 size={20} />, title: 'حرکت و انیمیشن', copy: 'سه سطح حرکت: ساده، متعادل و سینمایی؛ و احترام به تنظیم «کاهش حرکت» دستگاه.', tag: 'زنده و روان' },
  { icon: <UsersRound size={20} />, title: 'دفتر مشتریان مستقل', copy: 'اطلاعات مشتریان هر فروشگاه جدا از فروشگاه‌های دیگر می‌ماند و از پنل قابل پیگیری است.', tag: 'هر فروشگاه جدا' },
  { icon: <Moon size={20} />, title: 'تم روشن و تیره', copy: 'هر قالب با رنگ برند تو در هر دو تم خوانا می‌ماند؛ متن‌ها و دکمه‌ها کنتراست مناسب دارند.', tag: 'خوانا در هر تم' },
];

const steps = [
  { n: '۱', icon: <Rocket size={20} />, title: 'حساب بساز', copy: 'ثبت‌نام رایگان است و چند دقیقه بیشتر زمان نمی‌برد.' },
  { n: '۲', icon: <Palette size={20} />, title: 'قالب و رنگ را انتخاب کن', copy: 'صنف خودت را بگو تا قالب‌های مناسب‌تر اول فهرست بیایند.' },
  { n: '۳', icon: <Package size={20} />, title: 'محصولات را اضافه کن', copy: 'تصویر، قیمت و گزینه‌ها را وارد کن و ظاهر صفحه‌ها را بچین.' },
  { n: '۴', icon: <MonitorSmartphone size={20} />, title: 'منتشر کن', copy: 'سایتت روی آدرس delsaai.ir/s/نام-تو در دسترس مشتری‌هاست.' },
];

export default function BuilderLanding() {
  return (
    <div className="hx bl">
      <HomeHeader home={false} />
      <main>
        <section className="hx-hero bl-hero">
          <div className="hx-aurora" aria-hidden="true"><i className="hx-blob a" /><i className="hx-blob b" /><i className="hx-blob c" /></div>
          <div className="hx-grid" aria-hidden="true" />
          <div className="hx-wrap hx-hero-inner">
            <div className="hx-copy">
              <span className="hx-eyebrow"><i /> سایت‌ساز و فروشگاه‌ساز دلسا</span>
              <h1 className="hx-h1">
                <span className="hx-line">خانهٔ آنلاین</span>
                <span className="hx-line"><span className="hx-grad">کسب‌وکار تو.</span></span>
              </h1>
              <p className="hx-lead">
                {FREE_BUILDER_ENABLED
                  ? 'رایگان شروع کن؛ تا ۱۰ محصول فعال در هر فروشگاه، با طراحی و انتشار سایت از پنل خودت.'
                  : 'سایت و فروشگاهت را بساز؛ محصولات، سفارش‌ها و مشتریان را از پنل خودت مدیریت کن.'}
              </p>
              <div className="hx-actions">
                <Link className="hx-btn hx-btn-primary" href="/signup">ساخت حساب دلسا <ArrowUpLeft size={18} /></Link>
                <Link className="hx-btn" href="#studio">قالب‌ها را ببین <ArrowLeft size={17} /></Link>
              </div>
              <ul className="bl-checks">
                <li><Check size={16} /> ویرایشگر بصری</li>
                <li><Check size={16} /> انتشار صفحات</li>
                <li><Check size={16} /> دفتر مشتریان مستقل</li>
              </ul>
            </div>
            <HeroPreview />
          </div>
        </section>

        <section className="hx-sec hx-alt" id="studio">
          <div className="hx-wrap">
            <Reveal className="hx-center">
              <span className="hx-eyebrow"><i /> استودیوی زنده</span>
              <h2 className="hx-h2">قالبت را <span className="hx-grad">همین‌جا</span> امتحان کن.</h2>
              <p className="hx-lead">صنف، قالب و رنگ برندت را انتخاب کن و ببین سایتت چطور به نظر می‌رسد؛ در نمای دسکتاپ و موبایل.</p>
            </Reveal>
            <Studio />
          </div>
        </section>

        <section className="hx-sec" id="features">
          <div className="hx-wrap">
            <Reveal className="hx-center">
              <span className="hx-eyebrow"><i /> امکانات</span>
              <h2 className="hx-h2">از طراحی تا <span className="hx-grad">مدیریت فروش</span>.</h2>
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
            <p className="hx-demo-note bl-note">پرداخت فعلاً دستی یا هنگام تحویل است؛ اتصال درگاه آنلاین، دامنهٔ اختصاصی و اجرای اتوماسیون‌ها هنوز فعال نیست.</p>
          </div>
        </section>

        <section className="hx-sec hx-alt">
          <div className="hx-wrap">
            <Reveal className="hx-center">
              <span className="hx-eyebrow"><i /> شروع سریع</span>
              <h2 className="hx-h2">چهار قدم تا <span className="hx-grad">سایت آنلاین</span>.</h2>
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
                  <span className="hx-eyebrow"><i /> DELSA · سایت‌ساز</span>
                  <h2>فروشگاهت را <span className="hx-grad">امروز</span> آنلاین کن.</h2>
                  <p>حساب بساز، قالب را انتخاب کن و اولین محصولت را منتشر کن.</p>
                  <div className="hx-actions">
                    <Link className="hx-btn hx-btn-primary" href="/signup">ساخت حساب دلسا <ArrowUpLeft size={18} /></Link>
                    <Link className="hx-btn" href="/builder/demo">امتحان ویرایشگر <ArrowLeft size={17} /></Link>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

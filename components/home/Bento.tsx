'use client';

import type { PointerEvent, ReactNode } from 'react';
import { Activity, CreditCard, Layers3, MessageCircle, RefreshCw, ShoppingBag, Sparkles, UserRound } from 'lucide-react';
import Reveal from './Reveal';
import { useI18n } from '../i18n/I18nProvider';
import { tx } from '../../lib/i18n/config';
import TiltCard from './TiltCard';
import CustomerAvatar from './CustomerAvatar';

function spot(e: PointerEvent<HTMLElement>) {
  if (e.pointerType === 'touch') return;
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--sx', `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty('--sy', `${e.clientY - r.top}px`);
}

type Feature = { title: string; copy: string; wide?: boolean; visual: ReactNode; icon: ReactNode };

const makeFeatures = (t: (s: string, v?: Record<string, string | number>) => string): Feature[] => [
  {
    title: t('پاسخ‌گویی هوشمند در گفت‌وگو'),
    copy: t('دلسا سؤال دربارهٔ محصول، قیمت، موجودی، ویژگی‌ها، ارسال و روش خرید را با توجه به اطلاعات کسب‌وکار پاسخ می‌دهد.'),
    wide: true,
    icon: <Sparkles size={18} />,
    visual: (
      <div className="hx-vis-chat">
        <div className="hx-b cu">{t('سلام، مدل K7 رو دارید؟')}</div>
        <div className="hx-b ai"><em>{t('دستیار دلسا')}</em>{t('سلام! رنگ موردنظرتون رو می‌فرمایید؟')}<span className="hx-dots"><i /><i /><i /></span></div>
      </div>
    ),
  },
  {
    title: t('فهم انتخاب‌های چندمرحله‌ای'),
    copy: t('وقتی مشتری در چند پیام مدل، رنگ، سایز یا تعداد را مشخص می‌کند، انتخاب‌ها در زمینهٔ مکالمه دنبال می‌شوند.'),
    icon: <MessageCircle size={18} />,
    visual: (
      <div className="hx-flow"><span>{t('مدل K7')}</span><em /><span>{t('مشکی')}</span><em /><span>{t('۱ عدد')}</span></div>
    ),
  },
  {
    title: t('سبد خرید و ثبت سفارش'),
    copy: t('افزودن، حذف یا تغییر تعداد محصولات؛ سپس ثبت نام گیرنده، شماره تماس، نشانی و کد پستی.'),
    icon: <Layers3 size={18} />,
    visual: (
      <div className="hx-cart">
        <div><b>{t('محصول نمونه')}</b><s>{t('×۱')}</s></div>
        <div><b>{t('محصول نمونه')}</b><s>{t('×۲')}</s></div>
        <span className="hx-bar" style={{ display: 'block' }}><i /></span>
      </div>
    ),
  },
  {
    title: t('پرداخت و تطبیق فیش'),
    copy: t('هدایت به درگاه یا ارسال اطلاعات کارت‌به‌کارت؛ فیش دریافتی به سفارش مربوط وصل و برای رسیدگی قابل پیگیری می‌شود.'),
    wide: true,
    icon: <CreditCard size={18} />,
    visual: (
      <div className="hx-receipt"><i /><i /><i /><i /><span className="hx-stamp">{t('وصل شد')}</span></div>
    ),
  },
  {
    title: t('پرونده و شناخت مشتری'),
    copy: t('اطلاعات تماس، گفت‌وگوها، علاقه‌مندی‌ها، سفارش‌ها و پیگیری‌های قبلی در پروندهٔ مشتری کنار هم قرار می‌گیرند.'),
    wide: true,
    icon: <UserRound size={18} />,
    visual: (
      <div className="hx-prof">
        <CustomerAvatar name={tx('مریم احمدی')} channel={tx('اینستاگرام')} size={76} />
        <div className="hx-tags"><span>{t('علاقه‌مندی')}</span><span>{t('آخرین سفارش')}</span><span>{t('روش ارسال')}</span><span>{t('سابقهٔ گفت‌وگو')}</span></div>
      </div>
    ),
  },
  {
    title: t('پیگیری سفارش و تحلیل فروش'),
    copy: t('وضعیت سفارش و کد رهگیری به گفت‌وگو متصل است؛ پنل هم مکالمه‌ها، سفارش‌ها، پرداخت‌ها و تحلیل‌های فروش را نشان می‌دهد.'),
    icon: <Activity size={18} />,
    visual: (
      <div className="hx-bars" aria-hidden="true">
        {[40, 62, 48, 78, 58, 92, 70].map((h, i) => (
          <i key={i} style={{ ['--h' as string]: `${h}%`, ['--i' as string]: i }} />
        ))}
      </div>
    ),
  },
];

export default function Bento() {
  const { t } = useI18n();
  const features = makeFeatures(t);
  return (
    <div className="hx-bento">
      {features.map((f, i) => (
        <Reveal key={f.title} delay={(i % 3) * 0.08} className={f.wide ? 'hx-card-wrap s2' : 'hx-card-wrap'}>
          <TiltCard as="article" className={'hx-card' + (f.wide ? ' s2' : '')} onPointerMove={spot} style={{ height: '100%' }}>
            <div className="hx-vis" aria-hidden="true">{f.visual}</div>
            <div>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ color: 'var(--ortxt)', display: 'inline-flex' }}>{f.icon}</span>
                {f.title}
              </h3>
              <p>{f.copy}</p>
            </div>
          </TiltCard>
        </Reveal>
      ))}
    </div>
  );
}

'use client';

import type { PointerEvent, ReactNode } from 'react';
import { Activity, CreditCard, Layers3, MessageCircle, RefreshCw, ShoppingBag, Sparkles, UserRound } from 'lucide-react';
import Reveal from './Reveal';
import TiltCard from './TiltCard';
import CustomerAvatar from './CustomerAvatar';

function spot(e: PointerEvent<HTMLElement>) {
  if (e.pointerType === 'touch') return;
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--sx', `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty('--sy', `${e.clientY - r.top}px`);
}

type Feature = { title: string; copy: string; wide?: boolean; visual: ReactNode; icon: ReactNode };

const features: Feature[] = [
  {
    title: 'پاسخ‌گویی هوشمند در گفت‌وگو',
    copy: 'دلسا سؤال دربارهٔ محصول، قیمت، موجودی، ویژگی‌ها، ارسال و روش خرید را با توجه به اطلاعات کسب‌وکار پاسخ می‌دهد.',
    wide: true,
    icon: <Sparkles size={18} />,
    visual: (
      <div className="hx-vis-chat">
        <div className="hx-b cu">سلام، مدل K7 رو دارید؟</div>
        <div className="hx-b ai"><em>دستیار دلسا</em>سلام! رنگ موردنظرتون رو می‌فرمایید؟<span className="hx-dots"><i /><i /><i /></span></div>
      </div>
    ),
  },
  {
    title: 'فهم انتخاب‌های چندمرحله‌ای',
    copy: 'وقتی مشتری در چند پیام مدل، رنگ، سایز یا تعداد را مشخص می‌کند، انتخاب‌ها در زمینهٔ مکالمه دنبال می‌شوند.',
    icon: <MessageCircle size={18} />,
    visual: (
      <div className="hx-flow"><span>مدل K7</span><em /><span>مشکی</span><em /><span>۱ عدد</span></div>
    ),
  },
  {
    title: 'سبد خرید و ثبت سفارش',
    copy: 'افزودن، حذف یا تغییر تعداد محصولات؛ سپس ثبت نام گیرنده، شماره تماس، نشانی و کد پستی.',
    icon: <Layers3 size={18} />,
    visual: (
      <div className="hx-cart">
        <div><b>محصول نمونه</b><s>×۱</s></div>
        <div><b>محصول نمونه</b><s>×۲</s></div>
        <span className="hx-bar" style={{ display: 'block' }}><i /></span>
      </div>
    ),
  },
  {
    title: 'پرداخت و تطبیق فیش',
    copy: 'هدایت به درگاه یا ارسال اطلاعات کارت‌به‌کارت؛ فیش دریافتی به سفارش مربوط وصل و برای رسیدگی قابل پیگیری می‌شود.',
    wide: true,
    icon: <CreditCard size={18} />,
    visual: (
      <div className="hx-receipt"><i /><i /><i /><i /><span className="hx-stamp">وصل شد</span></div>
    ),
  },
  {
    title: 'پرونده و شناخت مشتری',
    copy: 'اطلاعات تماس، گفت‌وگوها، علاقه‌مندی‌ها، سفارش‌ها و پیگیری‌های قبلی در پروندهٔ مشتری کنار هم قرار می‌گیرند.',
    wide: true,
    icon: <UserRound size={18} />,
    visual: (
      <div className="hx-prof">
        <CustomerAvatar name="مریم احمدی" channel="اینستاگرام" size={76} />
        <div className="hx-tags"><span>علاقه‌مندی</span><span>آخرین سفارش</span><span>روش ارسال</span><span>سابقهٔ گفت‌وگو</span></div>
      </div>
    ),
  },
  {
    title: 'پیگیری سفارش و تحلیل فروش',
    copy: 'وضعیت سفارش و کد رهگیری به گفت‌وگو متصل است؛ پنل هم مکالمه‌ها، سفارش‌ها، پرداخت‌ها و تحلیل‌های فروش را نشان می‌دهد.',
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

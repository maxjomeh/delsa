'use client';

import { useRef } from 'react';
import { motion, useInView } from 'motion/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { ShieldCheck } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';

gsap.registerPlugin(ScrollTrigger, useGSAP);

const makeSteps = (t: (s: string) => string, nf: (n: number) => string): [string, string, string, string][] => [
  [nf(1), t('نیاز مشتری را از گفت‌وگو بفهم'), t('هوش مصنوعی دلسا منظور مشتری و زمینهٔ مکالمه را دنبال می‌کند؛ حتی وقتی انتخاب محصول در چند پیام شکل می‌گیرد.'), t('فهم گفت‌وگو')],
  [nf(2), t('انتخاب را به سفارش تبدیل کن'), t('محصول، رنگ، سایز و تعداد در سبد خرید جمع می‌شوند و اطلاعات لازم برای ثبت سفارش دریافت می‌شود.'), t('سبد و سفارش')],
  [nf(3), t('پرداخت تا ارسال را پیگیری کن'), t('پرداخت، وضعیت سفارش و کد رهگیری به همان گفت‌وگو و پروندهٔ مشتری متصل می‌مانند.'), t('پرداخت و رهگیری')],
];

function Step({ n, title, copy, tag }: { n: string; title: string; copy: string; tag: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const on = useInView(ref, { margin: '-42% 0px -42% 0px' });
  const seen = useInView(ref, { once: true, margin: '0px 0px -5% 0px' });
  return (
    <motion.div
      ref={ref}
      className="hx-step"
      data-on={on}
      initial={{ opacity: 0, x: -30 }}
      animate={seen ? { opacity: 1, x: 0 } : undefined}
      transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <span className="hx-step-n" aria-hidden="true">{n}</span>
      <span className="hx-step-tag">{tag}</span>
      <h3>{title}</h3>
      <p>{copy}</p>
    </motion.div>
  );
}

export default function Steps() {
  const { t, intl } = useI18n();
  const steps = makeSteps(t, (n) => new Intl.NumberFormat(intl).format(n));
  const ref = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  // GSAP ScrollTrigger: the orange progress line is scrubbed by scroll position.
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(fill.current, { scaleY: 0 }, {
        scaleY: 1, ease: 'none',
        scrollTrigger: { trigger: ref.current, start: 'top 68%', end: 'bottom 62%', scrub: 0.6 },
      });
    });
    mm.add('(prefers-reduced-motion: reduce)', () => { gsap.set(fill.current, { scaleY: 1 }); });
  }, { scope: ref });
  return (
    <>
      <div className="hx-tl" ref={ref}>
        <div className="hx-tl-track" aria-hidden="true"><div className="hx-tl-fill" ref={fill} /></div>
        {steps.map(([n, title, copy, tag]) => (
          <Step key={n} n={n} title={title} copy={copy} tag={tag} />
        ))}
      </div>
      <p className="hx-trust"><ShieldCheck size={17} /> {t('هرجا تصمیم یا بررسی صاحب کسب‌وکار لازم باشد، گفت‌وگو از پنل برای رسیدگی انسانی در دسترس است.')}</p>
    </>
  );
}

'use client';

import { useRef } from 'react';
import { motion, useInView, useScroll, useSpring } from 'motion/react';
import { ShieldCheck } from 'lucide-react';

const steps: [string, string, string, string][] = [
  ['۱', 'نیاز مشتری را از گفت‌وگو بفهم', 'هوش مصنوعی دلسا منظور مشتری و زمینهٔ مکالمه را دنبال می‌کند؛ حتی وقتی انتخاب محصول در چند پیام شکل می‌گیرد.', 'فهم گفت‌وگو'],
  ['۲', 'انتخاب را به سفارش تبدیل کن', 'محصول، رنگ، سایز و تعداد در سبد خرید جمع می‌شوند و اطلاعات لازم برای ثبت سفارش دریافت می‌شود.', 'سبد و سفارش'],
  ['۳', 'پرداخت تا ارسال را پیگیری کن', 'پرداخت، وضعیت سفارش و کد رهگیری به همان گفت‌وگو و پروندهٔ مشتری متصل می‌مانند.', 'پرداخت و رهگیری'],
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
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 70%', 'end 55%'] });
  const scaleY = useSpring(scrollYProgress, { stiffness: 120, damping: 26, mass: 0.3 });
  return (
    <>
      <div className="hx-tl" ref={ref}>
        <div className="hx-tl-track" aria-hidden="true"><motion.div className="hx-tl-fill" style={{ scaleY }} /></div>
        {steps.map(([n, title, copy, tag]) => (
          <Step key={n} n={n} title={title} copy={copy} tag={tag} />
        ))}
      </div>
      <p className="hx-trust"><ShieldCheck size={17} /> هرجا تصمیم یا بررسی صاحب کسب‌وکار لازم باشد، گفت‌وگو از پنل برای رسیدگی انسانی در دسترس است.</p>
    </>
  );
}

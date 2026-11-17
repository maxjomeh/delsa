'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { ArrowUpLeft, Check, CreditCard, Flag, Layers3, MessageCircle, ShieldCheck } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import AnimatedCimaInbox from '../AnimatedCimaInbox';
import { BrandName } from './BrandIcon';

gsap.registerPlugin(ScrollTrigger, useGSAP);

const line1 = ['از', 'اولین', 'پیام'];
const line2 = ['تا', 'فروش', 'موفق.'];

const wordVariants = {
  hidden: { y: '115%', opacity: 0 },
  show: { y: '0%', opacity: 1, transition: { duration: 0.85, ease: [0.2, 0.8, 0.2, 1] as const } },
};

export default function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const spring = { stiffness: 90, damping: 18, mass: 0.6 };
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [9, -9]), spring);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [-7, 7]), spring);
  const ax = useSpring(useTransform(mx, [-0.5, 0.5], [-22, 22]), spring);
  const ay = useSpring(useTransform(my, [-0.5, 0.5], [-14, 14]), spring);
  const bx = useSpring(useTransform(mx, [-0.5, 0.5], [26, -26]), spring);
  const by = useSpring(useTransform(my, [-0.5, 0.5], [18, -18]), spring);

  // GSAP ScrollTrigger parallax: background, copy and device drift at different speeds as the hero scrolls away.
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: ref.current, start: 'top top', end: 'bottom top', scrub: 0.5 } });
      tl.to('.hx-aurora', { yPercent: 18, ease: 'none' }, 0)
        .to('.hx-blob.b', { x: -90, ease: 'none' }, 0)
        .to('.hx-copy', { y: -50, ease: 'none' }, 0);
    });
    // The device drifts only in the two-column desktop layout; on phones it must stay put (the names rail is sticky).
    mm.add('(prefers-reduced-motion: no-preference) and (min-width: 1101px)', () => {
      gsap.to('.hx-par-stage', { y: -80, ease: 'none', scrollTrigger: { trigger: ref.current, start: 'top top', end: 'bottom top', scrub: 0.5 } });
    });
  }, { scope: ref });

  function onMove(e: React.PointerEvent<HTMLElement>) {
    if (reduce || e.pointerType === 'touch') return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--mx', `${px * 100}%`);
    el.style.setProperty('--my', `${py * 100}%`);
    mx.set(px - 0.5);
    my.set(py - 0.5);
  }
  function onLeave() {
    mx.set(0);
    my.set(0);
  }

  return (
    <section ref={ref} className="hx-hero" onPointerMove={onMove} onPointerLeave={onLeave} aria-labelledby="hx-title">
      <div className="hx-aurora" aria-hidden="true">
        <span className="hx-blob a" />
        <span className="hx-blob b" />
        <span className="hx-blob c" />
      </div>
      <div className="hx-grid" aria-hidden="true" />
      <div className="hx-spot" aria-hidden="true" />

      <div className="hx-wrap hx-hero-inner">
        <div className="hx-copy">
          <motion.span
            className="hx-eyebrow"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <i /> DELSA / CIMA · CRM هوشمند
          </motion.span>

          <motion.h1
            id="hx-title"
            className="hx-h1"
            initial={reduce ? false : 'hidden'}
            animate="show"
            transition={{ staggerChildren: 0.09, delayChildren: 0.15 }}
          >
            <span className="hx-line">
              {line1.map((w) => (
                <span className="hx-wm" key={w}>
                  <motion.span className="hx-w" variants={wordVariants}>{w}</motion.span>
                </span>
              ))}
            </span>
            <span className="hx-line">
              {line2.map((w) => (
                <span className="hx-wm" key={w}>
                  <motion.span className="hx-w hx-grad" variants={wordVariants}>{w}</motion.span>
                </span>
              ))}
            </span>
          </motion.h1>

          <motion.p
            className="hx-lead"
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7 }}
          >
            مکالمه‌های مشتری را به فروش تبدیل کن؛ از پاسخ‌گویی و انتخاب محصول تا ثبت سفارش و پیگیری، در یک پنل یکپارچه.
          </motion.p>

          <motion.div
            className="hx-actions"
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.85 }}
          >
            <Link href="/signup" className="hx-btn hx-btn-primary">
              شروع با CIMA <ArrowUpLeft size={18} />
            </Link>
            <button type="button" className="hx-btn" onClick={() => window.dispatchEvent(new Event('delsa:open-chat'))}>
              دریافت مشاوره <MessageCircle size={17} />
            </button>
          </motion.div>

          <motion.div
            className="hx-chips"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.05 }}
          >
            <span><MessageCircle size={16} /> مدیریت پیام‌ها</span>
            <span><Layers3 size={16} /> سبد خرید و سفارش</span>
            <span><ShieldCheck size={16} /> نظارت انسانی</span>
          </motion.div>
        </div>

        <div className="hx-par-stage">
        <motion.div
          className="hx-stage"
          initial={reduce ? false : { opacity: 0, y: 50, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, delay: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="hx-stage-glow" aria-hidden="true" />
          <motion.div className="hx-tilt" style={reduce ? undefined : { rotateX, rotateY }}>
            <div className="hx-device" aria-label="نمونهٔ نمایشی صندوق ورودی CIMA">
              <AnimatedCimaInbox />
            </div>
          </motion.div>

          <motion.div className="hx-chip a" style={reduce ? undefined : { x: ax, y: ay }} aria-hidden="true">
            <span className="ic"><Check size={18} /></span>
            <span><b>سفارش ۴۸۳۱ ثبت شد</b><small>از گفت‌وگوی <BrandName name="اینستاگرام" size={15} /></small></span>
          </motion.div>
          <motion.div className="hx-chip b" style={reduce ? undefined : { x: bx, y: by }} aria-hidden="true">
            <span className="ic"><Flag size={17} /></span>
            <span><b>نیازمند بررسی انسانی</b><small>تأیید پیش از پاسخ نهایی</small></span>
          </motion.div>
          <motion.div className="hx-chip c" style={reduce ? undefined : { x: ax, y: by }} aria-hidden="true">
            <span className="ic"><CreditCard size={17} /></span>
            <span><b>فیش به سفارش وصل شد</b><small>پیگیری پرداخت</small></span>
          </motion.div>
          <p className="hx-demo-note">نمونهٔ نمایشی از رابط CIMA؛ مکالمه‌ها واقعی نیستند.</p>
        </motion.div>
        </div>
      </div>

      <div className="hx-scroll" aria-hidden="true"><i /></div>
    </section>
  );
}

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring } from 'motion/react';
import { ArrowUpLeft, Menu, X } from 'lucide-react';

const links = [
  { href: '#cima', label: 'CIMA · CRM' },
  { href: '#how', label: 'نحوهٔ کار' },
  { href: '#channels', label: 'کانال‌ها' },
  { href: '#apu', label: 'APU' },
  { href: '/store', label: 'فروشگاه' },
  { href: '/pricing', label: 'تعرفه' },
];

export default function HomeHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { scrollY, scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.2 });
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 24));

  return (
    <>
      <header className="hx-header" data-scrolled={scrolled}>
        <Link href="/" className="hx-brand" aria-label="دلسا، خانه">
          <img src="/delsa-mark.svg" alt="" width={34} height={34} />
          DELSA
        </Link>
        <nav className="hx-nav" aria-label="منوی اصلی">
          {links.map((l) => (
            <Link key={l.href} href={l.href}>{l.label}</Link>
          ))}
        </nav>
        <div className="hx-header-actions">
          <Link className="hx-btn hx-btn-primary sm" href="/login">
            ورود به پنل <ArrowUpLeft size={16} />
          </Link>
          <button
            type="button"
            className="hx-menu-btn"
            aria-label={open ? 'بستن منو' : 'باز کردن منو'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        <motion.span className="hx-progress" style={{ scaleX: progress }} aria-hidden="true" />
      </header>
      <AnimatePresence>
        {open && (
          <motion.nav
            className="hx-drawer"
            aria-label="منوی موبایل"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.22 }}
          >
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</Link>
            ))}
            <Link className="hx-btn hx-btn-primary" href="/login" onClick={() => setOpen(false)}>
              ورود به پنل <ArrowUpLeft size={16} />
            </Link>
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  );
}

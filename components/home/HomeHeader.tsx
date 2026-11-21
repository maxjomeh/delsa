'use client';

import Link from '../i18n/Link';
import { useI18n } from '../i18n/I18nProvider';
import { useState } from 'react';
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring } from 'motion/react';
import { ArrowUpLeft, Menu, Sparkles, X } from 'lucide-react';

const makeLinks = (t: (s: string) => string): { href: string; label: string; featured?: boolean }[] => [
  { href: '/builder', label: t('سایت‌ساز'), featured: true },
  { href: '#cima', label: 'CIMA · CRM' },
  { href: '#how', label: t('نحوهٔ کار') },
  { href: '#channels', label: t('کانال‌ها') },
  { href: '#apu', label: 'APU' },
  { href: '/store', label: t('فروشگاه') },
  { href: '/pricing', label: t('تعرفه') },
];

/** On the homepage hash links scroll in place; on other pages they point back to the homepage sections. */
const resolve = (href: string, home: boolean) => (href.startsWith('#') && !home ? '/' + href : href);

export default function HomeHeader({ home = true }: { home?: boolean }) {
  const { t } = useI18n();
  const links = makeLinks(t);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { scrollY, scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.2 });
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 24));

  return (
    <>
      <header className="hx-header" data-scrolled={scrolled}>
        <Link href="/" className="hx-brand" aria-label={t('دلسا، خانه')}>
          <img src="/delsa-mark.svg" alt="" width={34} height={34} />
          DELSA
        </Link>
        <nav className="hx-nav" aria-label={t('منوی اصلی')}>
          {links.map((l) => (
            <Link key={l.href} href={resolve(l.href, home)} className={l.featured ? 'hx-nav-feature' : undefined}>
              {l.featured && <Sparkles size={16} aria-hidden="true" />}
              {l.label}
              {l.featured && <em className="hx-new">{t('جدید')}</em>}
            </Link>
          ))}
        </nav>
        <div className="hx-header-actions">
          <Link className="hx-btn hx-btn-primary sm" href="/login"> {t('ورود به پنل')} <ArrowUpLeft size={16} />
          </Link>
          <button
            type="button"
            className="hx-menu-btn"
            aria-label={open ? t('بستن منو') : t('باز کردن منو')}
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
            aria-label={t('منوی موبایل')}
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.22 }}
          >
            {links.map((l) => (
              <Link key={l.href} href={resolve(l.href, home)} className={l.featured ? 'hx-nav-feature' : undefined} onClick={() => setOpen(false)}>
                {l.featured && <Sparkles size={18} aria-hidden="true" />}
                {l.label}
                {l.featured && <em className="hx-new">{t('جدید')}</em>}
              </Link>
            ))}
            <Link className="hx-btn hx-btn-primary" href="/login" onClick={() => setOpen(false)}> {t('ورود به پنل')} <ArrowUpLeft size={16} />
            </Link>
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  );
}

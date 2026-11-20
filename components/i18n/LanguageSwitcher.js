'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Check, Globe } from 'lucide-react';
import { LOCALES, LOCALE_INFO, isPersianOnly, localizeHref, splitLocale } from '../../lib/i18n/config';
import { useI18n } from './I18nProvider';

export default function LanguageSwitcher() {
  const { locale, t } = useI18n();
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const base = splitLocale(pathname).path;

  useEffect(() => {
    if (!open) return;
    const close = (event) => { if (event.type === 'keydown' ? event.key === 'Escape' : !root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, [open]);

  // Published customer sites (/s/*) and not-yet-translated areas have no language choice.
  if (/^\/s(\/|$)/.test(base) || isPersianOnly(base)) return null;

  function go(event, target) {
    event.preventDefault();
    window.location.assign(localizeHref(target, base) + window.location.search + window.location.hash);
  }

  return (
    <div className="lang-switch" ref={root}>
      <button type="button" className="lang-switch-button" aria-haspopup="true" aria-expanded={open} aria-label={t('تغییر زبان')} onClick={() => setOpen((v) => !v)}>
        <Globe size={17} aria-hidden="true" /><span>{locale.toUpperCase()}</span>
      </button>
      {open && (
        <ul className="lang-switch-menu">
          {LOCALES.map((code) => (
            <li key={code}>
              <a href={localizeHref(code, base)} hrefLang={code} lang={code} aria-current={code === locale ? 'true' : undefined} onClick={(e) => go(e, code)}>
                {LOCALE_INFO[code].label}{code === locale && <Check size={14} aria-hidden="true" />}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

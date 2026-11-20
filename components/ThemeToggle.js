'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useI18n } from './i18n/I18nProvider';

export default function ThemeToggle() {
  const { t } = useI18n();
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    const savedTheme = window.localStorage.getItem('delsa-theme');
    const isDark = savedTheme ? savedTheme === 'dark' : true;
    setDark(isDark);
    root.dataset.theme = isDark ? 'dark' : 'light';

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    if (reducedMotion || !finePointer) return;

    let hideTimer;

    function onPointerMove(event) {
      if (event.pointerType === 'touch') return;
      root.dataset.pointerActive = 'true';
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => delete root.dataset.pointerActive, 650);
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.clearTimeout(hideTimer);
      delete root.dataset.pointerActive;
    };
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    window.localStorage.setItem('delsa-theme', next ? 'dark' : 'light');
  }

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? t('فعال‌کردن حالت روشن') : t('فعال‌کردن حالت تیره')}
      title={dark ? t('حالت روشن') : t('حالت تیره')}
    >
      {dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
      <span>{dark ? t('حالت روشن') : t('حالت تیره')}</span>
    </button>
  );
}

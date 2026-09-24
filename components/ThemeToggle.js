'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const isDark = window.localStorage.getItem('delsa-theme') === 'dark';
    setDark(isDark);
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
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
      aria-label={dark ? 'فعال‌کردن حالت روشن' : 'فعال‌کردن حالت تیره'}
      title={dark ? 'حالت روشن' : 'حالت تیره'}
    >
      {dark ? <Sun size={18} aria-hidden="true"/> : <Moon size={18} aria-hidden="true"/>}
      <span>{dark ? 'حالت روشن' : 'حالت تیره'}</span>
    </button>
  );
}

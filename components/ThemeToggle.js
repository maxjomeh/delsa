'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const isDark = window.localStorage.getItem('delsa-theme') === 'dark';
    setDark(isDark);
    root.dataset.theme = isDark ? 'dark' : 'light';

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    if (reducedMotion || !finePointer) return;

    let targetX = window.innerWidth * 0.5;
    let targetY = window.innerHeight * 0.4;
    let currentX = targetX;
    let currentY = targetY;
    let frame = 0;
    let hideTimer;

    function animatePointer() {
      currentX += (targetX - currentX) * 0.16;
      currentY += (targetY - currentY) * 0.16;
      root.style.setProperty('--cursor-x', `${currentX}px`);
      root.style.setProperty('--cursor-y', `${currentY}px`);
      if (Math.abs(targetX - currentX) > 0.5 || Math.abs(targetY - currentY) > 0.5) {
        frame = window.requestAnimationFrame(animatePointer);
      } else {
        frame = 0;
      }
    }

    function onPointerMove(event) {
      if (event.pointerType === 'touch') return;
      targetX = event.clientX;
      targetY = event.clientY;
      root.dataset.cursorActive = 'true';
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => delete root.dataset.cursorActive, 1200);
      if (!frame) frame = window.requestAnimationFrame(animatePointer);
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.cancelAnimationFrame(frame);
      window.clearTimeout(hideTimer);
      delete root.dataset.cursorActive;
      root.style.removeProperty('--cursor-x');
      root.style.removeProperty('--cursor-y');
    };
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    window.localStorage.setItem('delsa-theme', next ? 'dark' : 'light');
  }

  return (
    <>
      <div className="cursor-glow" aria-hidden="true" />
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
    </>
  );
}

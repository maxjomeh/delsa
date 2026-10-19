'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// These selectors are intentionally for the public marketing page only.
// A dashboard may contain a section that is thousands of pixels tall (e.g.
// hundreds of CRM customers). An IntersectionObserver threshold on the whole
// section would never be met and could hide the entire application.
const MARKETING_SELECTOR =
  'main > section:not(.apu-hero), .apu-demo, .steps-grid > article, .soon-list > div, .faq details';

export default function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    // Never apply scroll-reveal to authenticated workspaces or other routes.
    // Their own card-level animations are independent and remain enabled.
    if (pathname !== '/') return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const targets = document.querySelectorAll(MARKETING_SELECTOR);
    if (reduceMotion || !targets.length || !('IntersectionObserver' in window)) return;

    const nodes = Array.from(targets).filter(node =>
      !node.closest('.customer-shell, .panel-shell, [data-app-workspace]')
    );
    if (!nodes.length) return;

    const root = document.documentElement;
    root.classList.add('scroll-reveal-enabled');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('scroll-reveal-visible');
        } else {
          entry.target.classList.remove('scroll-reveal-visible');
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px -7% 0px' });

    nodes.forEach((node, index) => {
      node.classList.add('scroll-reveal');
      node.style.setProperty('--reveal-delay', `${(index % 5) * 75}ms`);
      observer.observe(node);
    });

    return () => {
      observer.disconnect();
      root.classList.remove('scroll-reveal-enabled');
      nodes.forEach((node) => {
        node.classList.remove('scroll-reveal', 'scroll-reveal-visible');
        node.style.removeProperty('--reveal-delay');
      });
    };
  }, [pathname]);

  return null;
}

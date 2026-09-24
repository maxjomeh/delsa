'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const targets = document.querySelectorAll(
      'main > section:not(.apu-hero), .apu-demo, .steps-grid > article, .soon-list > div, .faq details'
    );
    if (reduceMotion || !targets.length || !('IntersectionObserver' in window)) return;

    const nodes = Array.from(targets);
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
    }, { threshold: 0.12, rootMargin: '0px 0px -7% 0px' });

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

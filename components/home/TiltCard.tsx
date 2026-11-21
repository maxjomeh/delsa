'use client';

import { createElement, useEffect, useRef } from 'react';
import type { CSSProperties, PointerEventHandler, ReactNode } from 'react';

type Props = {
  as?: 'article' | 'div';
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  max?: number;
  onPointerMove?: PointerEventHandler<HTMLElement>;
};

/** Vanilla-Tilt wrapper: parallax tilt + glare on desktop pointers only (skipped for touch and reduced motion). */
export default function TiltCard({ as = 'div', className, style, children, max = 7, onPointerMove }: Props) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduce) return;
    let cancelled = false;
    import('vanilla-tilt').then((mod) => {
      if (cancelled) return;
      const VanillaTilt = (mod as any).default ?? mod;
      VanillaTilt.init(el, { max, speed: 500, scale: 1.015, perspective: 1100, glare: true, 'max-glare': 0.16, gyroscope: false });
    });
    return () => {
      cancelled = true;
      (el as any).vanillaTilt?.destroy();
    };
  }, [max]);

  return createElement(as, { ref, className, style, onPointerMove }, children);
}

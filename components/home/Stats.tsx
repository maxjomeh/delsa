'use client';

import { animate, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { fa } from './fa';
import TiltCard from './TiltCard';

function Count({ to }: { to: number }) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' });
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? to : 0);
  useEffect(() => {
    if (!inView) return;
    if (reduce) { setV(to); return; }
    const c = animate(0, to, { duration: 1.6, ease: [0.2, 0.8, 0.2, 1], onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [inView, reduce, to]);
  return <b ref={ref as React.RefObject<HTMLElement & HTMLSpanElement>}><span className="hx-grad">{fa(v)}</span></b>;
}

const items: [number, string][] = [
  [7, 'کانال پیام‌رسان در یک پنل'],
  [3, 'گام از پرسش محصول تا کد رهگیری'],
  [1, 'پروندهٔ یکپارچه برای هر مشتری'],
];

export default function Stats() {
  return (
    <div className="hx-stats">
      {items.map(([n, label]) => (
        <TiltCard className="hx-stat" key={label} max={9}>
          <Count to={n} />
          <span>{label}</span>
        </TiltCard>
      ))}
    </div>
  );
}

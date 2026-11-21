'use client';

import { animate, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import TiltCard from './TiltCard';

function Count({ to }: { to: number }) {
  const { intl } = useI18n();
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
  return <b ref={ref as React.RefObject<HTMLElement & HTMLSpanElement>}><span className="hx-grad">{new Intl.NumberFormat(intl).format(v)}</span></b>;
}

const makeItems = (t: (s: string) => string): [number, string][] => [
  [7, t('کانال پیام‌رسان در یک پنل')],
  [3, t('گام از پرسش محصول تا کد رهگیری')],
  [1, t('پروندهٔ یکپارچه برای هر مشتری')],
];

export default function Stats() {
  const { t } = useI18n();
  const items = makeItems(t);
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

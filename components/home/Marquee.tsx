'use client';

import { BrandIcon } from './BrandIcon';
import { useI18n } from '../i18n/I18nProvider';
import { DEFAULT_LOCALE, MESSENGERS } from '../../lib/i18n/config';

export default function Marquee() {
  const { t, locale } = useI18n();
  const channels = (MESSENGERS[locale] ?? MESSENGERS[DEFAULT_LOCALE]).marquee;
  // Two identical halves so translateX(-50%) loops seamlessly.
  // Short lists are repeated so each half is wider than the viewport.
  const half = Array.from({ length: Math.max(2, Math.ceil(14 / channels.length)) }, () => channels).flat();
  return (
    <div className="hx-marquee" aria-hidden="true">
      <div className="hx-track">
        {[0, 1].map((k) => (
          <div key={k} style={{ display: 'flex', gap: 14 }}>
            {half.map(([name, color], i) => (
              <span className="hx-ch" key={`${k}-${i}`} style={{ ['--c' as string]: color }}>
                <BrandIcon name={name} size={22} /> {t(name)}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

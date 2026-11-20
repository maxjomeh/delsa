'use client';

import { BrandIcon } from './BrandIcon';
import { useI18n } from '../i18n/I18nProvider';
import { tx } from '../../lib/i18n/config';

const channels: [string, string][] = [
  [tx('اینستاگرام'), '#e1306c'],
  [tx('واتساپ'), '#25d366'],
  [tx('تلگرام'), '#2aabee'],
  [tx('بله'), '#2fbf9f'],
  [tx('ایتا'), '#ff8a00'],
  [tx('روبیکا'), '#8b6cff'],
  [tx('سروش'), '#3ab0ff'],
];

export default function Marquee() {
  const { t } = useI18n();
  // Two identical halves so translateX(-50%) loops seamlessly.
  const half = [...channels, ...channels];
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

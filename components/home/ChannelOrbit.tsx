'use client';

import { BrandIcon } from './BrandIcon';
import { useI18n } from '../i18n/I18nProvider';
import { DEFAULT_LOCALE, MESSENGERS } from '../../lib/i18n/config';

export default function ChannelOrbit() {
  const { t, locale } = useI18n();
  const { outer, inner } = MESSENGERS[locale] ?? MESSENGERS[DEFAULT_LOCALE];
  return (
    <div className="hx-orbit" aria-hidden="true">
      <div className="hx-ring r1">
        {outer.map((n, i) => (
          <div className="hx-slot" key={n} style={{ ['--a' as string]: `${i * 90 + 20}deg` }}>
            <span className="hx-pill"><BrandIcon name={n} size={20} />{t(n)}</span>
          </div>
        ))}
      </div>
      {inner.length > 0 && <div className="hx-ring r2">
        {inner.map((n, i) => (
          <div className="hx-slot" key={n} style={{ ['--a' as string]: `${i * 120 + 50}deg` }}>
            <span className="hx-pill"><BrandIcon name={n} size={20} />{t(n)}</span>
          </div>
        ))}
      </div>}
      <div className="hx-core"><img src="/delsa-mark.svg" alt="" /></div>
    </div>
  );
}

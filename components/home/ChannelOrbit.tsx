'use client';

import { BrandIcon } from './BrandIcon';
import { useI18n } from '../i18n/I18nProvider';
import { tx } from '../../lib/i18n/config';

const outer = [tx('اینستاگرام'), tx('واتساپ'), tx('تلگرام'), tx('بله')];
const inner = [tx('ایتا'), tx('روبیکا'), tx('سروش')];

export default function ChannelOrbit() {
  const { t } = useI18n();
  return (
    <div className="hx-orbit" aria-hidden="true">
      <div className="hx-ring r1">
        {outer.map((n, i) => (
          <div className="hx-slot" key={n} style={{ ['--a' as string]: `${i * 90 + 20}deg` }}>
            <span className="hx-pill"><BrandIcon name={n} size={20} />{t(n)}</span>
          </div>
        ))}
      </div>
      <div className="hx-ring r2">
        {inner.map((n, i) => (
          <div className="hx-slot" key={n} style={{ ['--a' as string]: `${i * 120 + 50}deg` }}>
            <span className="hx-pill"><BrandIcon name={n} size={20} />{t(n)}</span>
          </div>
        ))}
      </div>
      <div className="hx-core"><img src="/delsa-mark.svg" alt="" /></div>
    </div>
  );
}

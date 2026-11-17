import { BrandIcon } from './BrandIcon';

const outer = ['اینستاگرام', 'واتساپ', 'تلگرام', 'بله'];
const inner = ['ایتا', 'روبیکا', 'سروش'];

export default function ChannelOrbit() {
  return (
    <div className="hx-orbit" aria-hidden="true">
      <div className="hx-ring r1">
        {outer.map((n, i) => (
          <div className="hx-slot" key={n} style={{ ['--a' as string]: `${i * 90 + 20}deg` }}>
            <span className="hx-pill"><BrandIcon name={n} size={20} />{n}</span>
          </div>
        ))}
      </div>
      <div className="hx-ring r2">
        {inner.map((n, i) => (
          <div className="hx-slot" key={n} style={{ ['--a' as string]: `${i * 120 + 50}deg` }}>
            <span className="hx-pill"><BrandIcon name={n} size={20} />{n}</span>
          </div>
        ))}
      </div>
      <div className="hx-core"><img src="/delsa-mark.svg" alt="" /></div>
    </div>
  );
}

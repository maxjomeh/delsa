import { BrandIcon } from './BrandIcon';

const channels: [string, string][] = [
  ['اینستاگرام', '#e1306c'],
  ['واتساپ', '#25d366'],
  ['تلگرام', '#2aabee'],
  ['بله', '#2fbf9f'],
  ['ایتا', '#ff8a00'],
  ['روبیکا', '#8b6cff'],
  ['سروش', '#3ab0ff'],
];

export default function Marquee() {
  // Two identical halves so translateX(-50%) loops seamlessly.
  const half = [...channels, ...channels];
  return (
    <div className="hx-marquee" aria-hidden="true">
      <div className="hx-track">
        {[0, 1].map((k) => (
          <div key={k} style={{ display: 'flex', gap: 14 }}>
            {half.map(([name, color], i) => (
              <span className="hx-ch" key={`${k}-${i}`} style={{ ['--c' as string]: color }}>
                <BrandIcon name={name} size={22} /> {name}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

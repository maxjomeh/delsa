import { BrandIcon } from './BrandIcon';

/**
 * Illustrated messenger-profile pictures for the demo customers (fictional people, flat vector art — not photos).
 * Each avatar can carry the messenger's logo as a small badge in the corner, like a real messenger profile.
 */
type Look = {
  bg: [string, string]; skin: string; skinShade: string; hair: string; top: string;
  hairStyle: 'long' | 'short' | 'bob' | 'ponytail'; beard?: boolean;
};

const LOOKS: Record<string, Look> = {
  'مریم احمدی': { bg: ['#ffd9c4', '#ffb899'], skin: '#f3c9a8', skinShade: '#e4b08c', hair: '#3a2418', top: '#2f9e8f', hairStyle: 'long' },
  'علی رضایی': { bg: ['#cfe3ff', '#9cbdf2'], skin: '#d9a77c', skinShade: '#c48f63', hair: '#15110f', top: '#33538f', hairStyle: 'short' },
  'نگار محمدی': { bg: ['#e4dcff', '#c3b4f5'], skin: '#e8b98f', skinShade: '#d3a076', hair: '#7a3b1d', top: '#1f2b5a', hairStyle: 'bob' },
  'کیان شریفی': { bg: ['#cdf1df', '#9fd9bd'], skin: '#d2a07a', skinShade: '#bc8863', hair: '#1c1613', top: '#2d5a45', hairStyle: 'short', beard: true },
  'سارا رحیمی': { bg: ['#ffeab8', '#ffd27a'], skin: '#f4d0b4', skinShade: '#e5b996', hair: '#5b3319', top: '#d9822b', hairStyle: 'ponytail' },
};
const FALLBACK: Look = LOOKS['مریم احمدی'];

function Hair({ look, layer }: { look: Look; layer: 'back' | 'front' }) {
  const c = look.hair;
  if (layer === 'back') {
    if (look.hairStyle === 'long') return <path d="M19.5 31C17.5 14 26 9.5 32 9.5S46.5 14 44.5 31L46.5 50C42 47.5 22 47.5 17.5 50Z" fill={c} />;
    if (look.hairStyle === 'bob') return <path d="M19 35C16.5 15.5 25.5 10 32 10S47.5 15.5 45 35C42 37.5 22 37.5 19 35Z" fill={c} />;
    if (look.hairStyle === 'ponytail') return <ellipse cx="46" cy="24" rx="4.6" ry="9.5" transform="rotate(22 46 24)" fill={c} />;
    return null;
  }
  if (look.hairStyle === 'short') return <path d="M21.2 28C20.2 15.5 26.5 12 32 12S43.8 15.5 42.8 28C40.6 21.8 23.4 21.8 21.2 28Z" fill={c} />;
  if (look.hairStyle === 'ponytail') return <path d="M21.4 27C21.4 16 27 13 32 13S42.6 16 42.6 27C39 21.5 25 21.5 21.4 27Z" fill={c} />;
  return <path d="M21.4 27.5C21.6 17 27 14.2 32 14.2S42.4 17 42.6 27.5C38 22.6 26 22.6 21.4 27.5Z" fill={c} />;
}

export default function CustomerAvatar({ name, channel, size = 40 }: { name: string; channel?: string; size?: number }) {
  const look = LOOKS[name] ?? FALLBACK;
  const badge = Math.round(size * 0.44);
  return (
    <span className="hx-cav" style={{ ['--av' as string]: `${size}px`, ['--bd' as string]: `${badge}px` }} role="img" aria-label={`تصویر پروفایل ${name}${channel ? ' در ' + channel : ''}`}>
      <span className="hx-cav-pic">
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <rect width="64" height="64" fill={look.bg[0]} />
          <circle cx="50" cy="12" r="26" fill={look.bg[1]} opacity=".65" />
          <Hair look={look} layer="back" />
          <path d="M7 66C7 52 18 47 32 47S57 52 57 66Z" fill={look.top} />
          <rect x="28" y="38" width="8" height="11" rx="3.5" fill={look.skinShade} />
          <ellipse cx="32" cy="29.5" rx="10.4" ry="12" fill={look.skin} />
          {look.beard && <path d="M21.8 30.5C21.8 40.5 26 43.6 32 43.6S42.2 40.5 42.2 30.5C40.4 36 23.6 36 21.8 30.5Z" fill={look.hair} opacity=".88" />}
          <Hair look={look} layer="front" />
          <circle cx="27.8" cy="30" r="1.15" fill="#2a1d16" /><circle cx="36.2" cy="30" r="1.15" fill="#2a1d16" />
          <path d="M28.6 35.2C30.4 36.8 33.6 36.8 35.4 35.2" fill="none" stroke="#2a1d16" strokeWidth="1.1" strokeLinecap="round" opacity=".75" />
        </svg>
      </span>
      {channel && <span className="hx-cav-badge" aria-hidden="true"><BrandIcon name={channel} size={Math.max(9, Math.round(badge * 0.62))} /></span>}
    </span>
  );
}

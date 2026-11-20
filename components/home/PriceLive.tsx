'use client';

import { useEffect, useReducer, useRef } from 'react';
import { useInView, useReducedMotion } from 'motion/react';
import { Activity, Check, CircleHelp, RefreshCw, X } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { tx } from '../../lib/i18n/config';

type Row = { id: number; name: string; sku: string; store: number; source: number; ignored: boolean; tick: number; dir: 0 | 1 | -1 };
// The log keeps what happened (not a finished sentence) so it is translated when rendered.
type Log = { k: 'start' } | { k: 'apply' | 'ignore' | 'synced'; name: string } | { k: 'changed'; name: string; pct: number };
type State = { rows: Row[]; log: Log; ticks: number };

const initial: State = {
  ticks: 0,
  log: { k: 'start' },
  rows: [
    { id: 1, name: tx('کرم آبرسان روزانه'), sku: 'SKU-2018', store: 480000, source: 515000, ignored: false, tick: 0, dir: 1 },
    { id: 2, name: tx('شامپو بدون سولفات'), sku: 'SKU-2028', store: 220000, source: 228000, ignored: false, tick: 0, dir: 1 },
    { id: 3, name: tx('سرم ویتامین C'), sku: 'SKU-2038', store: 390000, source: 390000, ignored: false, tick: 0, dir: 0 },
    { id: 4, name: tx('ماسک مو ترمیم‌کننده'), sku: 'SKU-2048', store: 310000, source: 310000, ignored: false, tick: 0, dir: 0 },
  ],
};

type Action =
  | { t: 'apply'; id: number }
  | { t: 'ignore'; id: number }
  | { t: 'drift'; id: number; pct: number };

const diffPct = (r: Row) => (Math.abs(r.source - r.store) / r.store) * 100;
const statusOf = (r: Row): 'same' | 'minor' | 'review' | 'ignored' =>
  r.ignored ? 'ignored' : r.source === r.store ? 'same' : diffPct(r) > 3 ? 'review' : 'minor';

function reducer(s: State, a: Action): State {
  const nm = (id: number) => s.rows.find((r) => r.id === id)?.name ?? '';
  switch (a.t) {
    case 'apply':
      return { ...s, log: { k: 'apply', name: nm(a.id) }, rows: s.rows.map((r) => (r.id === a.id ? { ...r, store: r.source, ignored: false, dir: 0, tick: s.ticks + 1 } : r)), ticks: s.ticks + 1 };
    case 'ignore':
      return { ...s, log: { k: 'ignore', name: nm(a.id) }, rows: s.rows.map((r) => (r.id === a.id ? { ...r, ignored: true } : r)) };
    case 'drift': {
      const rows = s.rows.map((r) => {
        if (r.id !== a.id) return r;
        const next = Math.max(1000, Math.round((r.store * (1 + a.pct / 100)) / 1000) * 1000);
        return { ...r, source: next, ignored: false, dir: (next > r.store ? 1 : next < r.store ? -1 : 0) as 0 | 1 | -1, tick: s.ticks + 1 };
      });
      const r = rows.find((x) => x.id === a.id)!;
      const msg: Log = r.source === r.store ? { k: 'synced', name: r.name } : { k: 'changed', name: r.name, pct: Math.round(diffPct(r)) };
      return { ...s, rows, log: msg, ticks: s.ticks + 1 };
    }
  }
}

export default function PriceLive() {
  const { t, intl } = useI18n();
  const nf = (n: number) => new Intl.NumberFormat(intl).format(n);
  const label = { same: t('همسان'), minor: t('تغییر جزئی'), review: t('نیاز به بازبینی'), ignored: t('نادیده گرفته شد') } as const;
  const logText = (l: Log) => {
    switch (l.k) {
      case 'start': return t('پایش آغاز شد؛ تغییر قیمت منبع‌ها را زیر نظر دارم.');
      case 'apply': return t('تأیید انسانی: قیمت «{name}» با منبع هماهنگ شد.', { name: t(l.name) });
      case 'ignore': return t('«{name}» فعلاً نادیده گرفته شد؛ قیمتی تغییر نکرد.', { name: t(l.name) });
      case 'synced': return t('قیمت منبع «{name}» با فروشگاه یکی شد.', { name: t(l.name) });
      default: return t('قیمت منبع «{name}» تغییر کرد؛ {pct}٪ اختلاف.', { name: t(l.name), pct: nf(l.pct) });
    }
  };
  const [s, dispatch] = useReducer(reducer, initial);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: '0px 0px -10% 0px' });
  const reduce = useReducedMotion();
  const rowsRef = useRef(s.rows);
  rowsRef.current = s.rows;

  useEffect(() => {
    if (!inView || reduce) return;
    const id = window.setInterval(() => {
      const rows = rowsRef.current;
      const r = rows[Math.floor(Math.random() * rows.length)];
      const mag = 1 + Math.random() * 7.5;
      dispatch({ t: 'drift', id: r.id, pct: (Math.random() > 0.35 ? 1 : -1) * mag });
    }, 3600);
    return () => window.clearInterval(id);
  }, [inView, reduce]);

  const review = s.rows.filter((r) => statusOf(r) === 'review').length;
  const same = s.rows.filter((r) => statusOf(r) === 'same').length;

  return (
    <div className="hx-live" ref={ref}>
      <div className="hx-live-top">
        <div className="hx-live-title">
          <span className="ic"><RefreshCw size={18} /></span>
          <div><b>{t('پایش قیمت')}</b><small>{t('فروشگاه نمونه · اجرای نمایشی')}</small></div>
        </div>
        <span className="hx-tag"><i /> {t('نمونهٔ زنده')}</span>
      </div>

      <div className="hx-live-stats">
        <div><small>{t('محصول بررسی‌شده')}</small><b>{nf(s.rows.length)}</b></div>
        <div><small>{t('نیازمند بازبینی')}</small><b className="or">{nf(review)}</b></div>
        <div><small>{t('بدون تغییر')}</small><b>{nf(same)}</b></div>
      </div>

      <div className="hx-rows">
        <div className="hx-row head"><span>{t('محصول')}</span><span>{t('فروشگاه')}</span><span>{t('منبع')}</span><span>{t('وضعیت')}</span></div>
        {s.rows.map((r) => {
          const st = statusOf(r);
          return (
            <div className="hx-row" key={r.id}>
              <div className="nm"><b>{t(r.name)}</b><small>{r.sku}</small></div>
              <div className="pr">{nf(r.store)}</div>
              <div className={'pr' + (r.tick ? ' hx-flash' : '')} key={r.id + '-' + r.tick}>
                {nf(r.source)}
                {/* always rendered (hidden when unused) so the row height never changes */}
                {(() => { const show = r.dir !== 0 && st !== 'ignored'; return <small className={r.dir < 0 ? 'dn' : 'up'} style={{ visibility: show ? 'visible' : 'hidden' }} aria-hidden={!show}>{r.dir < 0 ? '▼' : '▲'} {nf(Math.round(diffPct(r)) || 1)}{t('٪')}</small>; })()}
              </div>
              <div className="st-wrap">
                <div className="hx-st">
                  <span className={'hx-pillst ' + st}>{label[st]}</span>
                  {(st === 'review' || st === 'minor') && (
                    <span className="hx-acts">
                      <button type="button" className="hx-act ok" aria-label={t('اعمال قیمت منبع برای {name}', { name: t(r.name) })} title={t('تأیید و اعمال')} onClick={() => dispatch({ t: 'apply', id: r.id })}><Check size={15} /></button>
                      <button type="button" className="hx-act" aria-label={t('نادیده گرفتن {name}', { name: t(r.name) })} title={t('نادیده بگیر')} onClick={() => dispatch({ t: 'ignore', id: r.id })}><X size={15} /></button>
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="hx-log" aria-live="polite"><Activity size={15} /> {logText(s.log)}</div>
      <p className="hx-foot-note"><CircleHelp size={13} /> {t('اعداد این بخش نمونه‌اند؛ روی ✓ بزن تا ببینی تأیید انسانی چطور کار می‌کند.')}</p>
    </div>
  );
}

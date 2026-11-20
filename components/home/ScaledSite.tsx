'use client';

import { useEffect, useRef, useState } from 'react';
import BuilderSiteViewJs from '../BuilderSiteView';
import { useI18n } from '../i18n/I18nProvider';
import { tx } from '../../lib/i18n/config';

// The site view is plain JS whose optional props have no defaults in its signature; treat it as loosely typed here.
const BuilderSiteView: any = BuilderSiteViewJs;

type Product = { title: string; price: string; hue: number };

/** Illustrative products so a preview never shows the empty "your products here" placeholder. */
const DEMO: Product[] = [
  { title: tx('محصول منتخب'), price: tx('۸۹۰٬۰۰۰'), hue: 0 },
  { title: tx('پرفروش این هفته'), price: tx('۱٬۲۵۰٬۰۰۰'), hue: 40 },
  { title: tx('مجموعهٔ جدید'), price: tx('۶۴۰٬۰۰۰'), hue: 80 },
  { title: tx('پیشنهاد ویژه'), price: tx('۴۹۰٬۰۰۰'), hue: 120 },
];

function DemoProducts() {
  const { t } = useI18n();
  return (
    <div className="bl-prods">
      {DEMO.map((p) => (
        <article key={p.title} data-part="card" data-ds="card">
          <div data-part="card-media" className="bl-pm" style={{ ['--hue' as string]: p.hue }}><span aria-hidden="true" /></div>
          <div data-part="card-body"><h3>{t(p.title)}</h3><strong>{t(p.price)} {t('تومان')}</strong></div>
        </article>
      ))}
    </div>
  );
}

/**
 * A real site-builder template rendered at its true width and scaled down into a frame (no iframe, same code that
 * publishes customers' sites). The frame has a fixed aspect ratio, so swapping templates never shifts the layout;
 * the page inside slowly pans so the visitor sees the whole template.
 */
export default function ScaledSite({ doc, width = 1280, ratio = '16 / 11', pan = true }: { doc: any; width?: number; ratio?: string; pan?: boolean }) {
  const { t } = useI18n();
  const frame = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [dist, setDist] = useState(0);
  // starter() documents carry random block ids, so the preview is rendered after mount only (no SSR/client mismatch);
  // the frame has a fixed aspect ratio, so nothing shifts when it appears.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  useEffect(() => {
    const el = frame.current, page = inner.current;
    if (!el || !page) return;
    const measure = () => {
      const s = el.clientWidth / width;
      setScale(s);
      setDist(Math.max(0, Math.round(page.scrollHeight * s - el.clientHeight)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(page);
    return () => ro.disconnect();
  }, [width, doc, ready]);

  return (
    <div ref={frame} className="bl-scaled" style={{ aspectRatio: ratio }}>
      <div
        ref={inner}
        className={'bl-site' + (pan ? ' pan' : '')}
        inert
        aria-hidden="true"
        style={{ width, ['--s' as string]: scale, ['--dist' as string]: `${dist}px` }}
      >
        {ready && <BuilderSiteView name={t('کسب‌وکار شما')} document={doc} preview productsSlot={<DemoProducts />} />}
      </div>
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { I18nProvider, useI18n } from './I18nProvider';
import { loadMessages } from '../../lib/i18n/messages';

// Gives a lazily translated area (site-builder UI, Sima/CRM) its dictionary on top of the page's own. The builder strings are
// loaded on demand so the dashboard itself does not ship them. Direction follows the page language.
// `scope` picks the dictionary: 'builder' (site builder UI) or 'crm' (Sima / CRM).
export default function BuilderI18n({ scope = 'builder', children }) {
  const parent = useI18n();
  const [extra, setExtra] = useState(null);
  const persian = parent.locale === 'fa';
  useEffect(() => {
    if (persian) return;
    let live = true;
    loadMessages(parent.locale, scope).then((m) => { if (live) setExtra(m); });
    return () => { live = false; };
  }, [parent.locale, persian, scope]);
  if (persian) return <div dir="rtl" lang="fa">{children}</div>;
  if (!extra) return <p role="status" aria-live="polite" style={{ padding: 24 }}>{parent.t('در حال بارگذاری…')}</p>;
  return (
    <div dir={parent.dir} lang={parent.locale}>
      <I18nProvider locale={parent.locale} messages={{ ...parent.messages, ...extra }}>{children}</I18nProvider>
    </div>
  );
}

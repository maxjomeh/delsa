'use client';
import { useEffect, useState } from 'react';
import { I18nProvider, useI18n } from './I18nProvider';
import { loadMessages } from '../../lib/i18n/messages';

// Gives a site-builder subtree the language of the *site* (document.lang), independent of the
// language of the surrounding page. Published pages pass `messages` from the server (no flash);
// previews (editor, landing) load the dictionary lazily.
export default function SiteI18n({ lang = 'fa', messages, children }) {
  const parent = useI18n();
  const [loaded, setLoaded] = useState(null);
  const nested = parent.scope === 'site' && parent.locale === lang;
  useEffect(() => {
    if (nested || lang === 'fa' || messages) return;
    let live = true;
    loadMessages(lang, 'site').then((m) => { if (live) setLoaded(m); });
    return () => { live = false; setLoaded(null); };
  }, [lang, messages, nested]);
  if (nested) return children;
  return <I18nProvider locale={lang} messages={messages || loaded || EMPTY} scope="site">{children}</I18nProvider>;
}

const EMPTY = {};

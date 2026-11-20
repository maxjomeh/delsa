import { cache } from 'react';
import { headers } from 'next/headers';
import { DEFAULT_LOCALE, LOCALE_HEADER, LOCALE_INFO, PATH_HEADER, createTranslator, isLocale, localizeHref } from './config';

const loaders = {
  en: () => import('./messages/en'),
  ar: () => import('./messages/ar'),
  tr: () => import('./messages/tr'),
};

export async function loadMessages(locale) {
  return loaders[locale] ? (await loaders[locale]()).default : {};
}

// Reads the locale resolved by proxy.js. Reading headers() makes the route dynamic, so never
// call this from the cached public-site routes (/s/*).
export const getI18n = cache(async () => {
  const h = await headers();
  const raw = h.get(LOCALE_HEADER);
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const messages = await loadMessages(locale);
  return {
    locale,
    dir: LOCALE_INFO[locale].dir,
    intl: LOCALE_INFO[locale].intl,
    messages,
    path: h.get(PATH_HEADER) || '/',
    t: createTranslator(locale, messages),
    href: (path) => localizeHref(locale, path),
  };
});

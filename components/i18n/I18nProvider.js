'use client';
import { createContext, useContext, useMemo } from 'react';
import { DEFAULT_LOCALE, LOCALE_INFO, createTranslator, localizeHref } from '../../lib/i18n/config';

function build(locale, messages) {
  return {
    locale,
    dir: LOCALE_INFO[locale].dir,
    intl: LOCALE_INFO[locale].intl,
    t: createTranslator(locale, messages),
    href: (path) => localizeHref(locale, path),
  };
}

// Without a provider (e.g. the cached /s/* routes) everything falls back to Persian.
const I18nContext = createContext(build(DEFAULT_LOCALE, {}));

export function I18nProvider({ locale, messages, children }) {
  const value = useMemo(() => build(locale, messages), [locale, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

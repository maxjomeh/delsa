// Locales supported by the site. Persian (fa) is the source language and lives at the root
// (no URL prefix); every other locale is served under /<locale>/... and rewritten by proxy.js.
export const LOCALES = ['fa', 'en', 'ar', 'tr'];
export const DEFAULT_LOCALE = 'fa';
export const LOCALE_HEADER = 'x-delsa-locale';
export const PATH_HEADER = 'x-delsa-path';

export const LOCALE_INFO = {
  fa: { label: 'فارسی', dir: 'rtl', intl: 'fa-IR', og: 'fa_IR' },
  en: { label: 'English', dir: 'ltr', intl: 'en-US', og: 'en_US' },
  ar: { label: 'العربية', dir: 'rtl', intl: 'ar-u-nu-latn', og: 'ar_AR' },
  tr: { label: 'Türkçe', dir: 'ltr', intl: 'tr-TR', og: 'tr_TR' },
};

export function isLocale(value) {
  return LOCALES.includes(value);
}

// "/en/pricing" -> {locale:'en', path:'/pricing', prefixed:true}; "/pricing" -> fa, not prefixed.
export function splitLocale(pathname) {
  const match = /^\/([a-z]{2})(?=\/|$)/.exec(pathname || '');
  if (match && isLocale(match[1])) return { locale: match[1], path: pathname.slice(3) || '/', prefixed: true };
  return { locale: DEFAULT_LOCALE, path: pathname || '/', prefixed: false };
}

// Areas that have not been translated yet (customer dashboard, admin panel, site builder).
// Other languages are redirected to the Persian version instead of showing mixed-language UI.
// Remove a pattern from here once that area is converted to t().
const PERSIAN_ONLY = /^\/builder\//;
export function isPersianOnly(path) {
  return PERSIAN_ONLY.test(path);
}

// Paths that never get a locale prefix: route handlers and customer-published sites (/s/*).
const UNLOCALIZED = /^\/(api|auth|s|_next)(\/|$)/;

// Adds the locale prefix to an internal href, leaving query/hash intact ("/#apu" -> "/en#apu").
export function localizeHref(locale, href) {
  if (locale === DEFAULT_LOCALE || typeof href !== 'string') return href;
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const [, path, rest] = /^(\/[^?#]*)(.*)$/.exec(href) || [];
  if (path === undefined || UNLOCALIZED.test(path) || splitLocale(path).prefixed) return href;
  return '/' + locale + (path === '/' ? '' : path) + rest;
}

// Marks a Persian string that is stored in data and translated later with t(value) (keeps it extractable).
export const tx = (text) => text;

const PERSIAN = /[\u0600-\u06FF]/;

export function createTranslator(locale, messages = {}, { quiet = false } = {}) {
  const warned = new Set();
  return function t(text, vars) {
    let out = text;
    if (locale !== DEFAULT_LOCALE && PERSIAN.test(text)) {
      if (Object.prototype.hasOwnProperty.call(messages, text)) out = messages[text];
      else if (!quiet && process.env.NODE_ENV !== 'production' && !warned.has(text)) { warned.add(text); console.warn('[i18n] missing ' + locale + ' translation:', text); }
    }
    return vars ? out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : out;
  };
}

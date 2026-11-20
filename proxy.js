import { sessionCookieOptions } from './lib/supabase/cookie-options';
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { DEFAULT_LOCALE, LOCALE_HEADER, PATH_HEADER, isPersianOnly, splitLocale } from './lib/i18n/config';

export async function proxy(request) {
  const { locale, path, prefixed } = splitLocale(request.nextUrl.pathname);
  // "/fa/..." is the same as the unprefixed Persian site; customer sites (/s/*) are never localized,
  // and areas that are not translated yet fall back to Persian.
  if (prefixed && (locale === DEFAULT_LOCALE || /^\/s(\/|$)/.test(path) || isPersianOnly(path))) {
    const url = request.nextUrl.clone();
    url.pathname = path;
    // Temporary (307) for the untranslated areas so browsers don't cache it once they are translated.
    return NextResponse.redirect(url, isPersianOnly(path) && locale !== DEFAULT_LOCALE ? 307 : 308);
  }
  // Pages read the language from these request headers (never from the client's own values).
  request.headers.set(LOCALE_HEADER, locale);
  request.headers.set(PATH_HEADER, path);
  const next = () => {
    if (!prefixed) return NextResponse.next({ request });
    const url = request.nextUrl.clone();
    url.pathname = path;
    return NextResponse.rewrite(url, { request });
  };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return next();
  let response = next();
  const supabase = createServerClient(url, key, {
    cookieOptions:sessionCookieOptions,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = next();
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers||{}).forEach(([name,value])=>response.headers.set(name,value));
      },
    },
  });
  await supabase.auth.getClaims();
  response.headers.set('Cache-Control','private, no-store');
  return response;
}
// Published sites (/s/*) are public and cacheable: skipping the proxy avoids the per-request
// auth refresh and the `private, no-store` header that would disable ISR/CDN caching.
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|s/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'] };

'use client';
import NextLink from 'next/link';
import { useI18n } from './I18nProvider';

// Drop-in replacement for next/link that keeps the visitor in their current language.
export default function Link({ href, ...props }) {
  const { href: localize } = useI18n();
  return <NextLink href={typeof href === 'string' ? localize(href) : href} {...props} />;
}

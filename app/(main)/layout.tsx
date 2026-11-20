import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/500.css';
import '@fontsource/vazirmatn/700.css';
import '../globals.css';
import type { Metadata } from 'next';
import ThemeToggle from '../../components/ThemeToggle';
import VisitorChat from '../../components/VisitorChat';
import ScrollReveal from '../../components/ScrollReveal';
import LanguageSwitcher from '../../components/i18n/LanguageSwitcher';
import { I18nProvider } from '../../components/i18n/I18nProvider';
import { LOCALES, LOCALE_INFO, localizeHref } from '../../lib/i18n/config';
import { getI18n } from '../../lib/i18n/server';

const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.delsaai.ir';

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale, path } = await getI18n();
  const languages = Object.fromEntries(LOCALES.map((code) => [code, localizeHref(code, path)]));
  return {
    metadataBase: new URL(origin),
    title: t('دلسا | پایش و به‌روزرسانی هوشمند قیمت'),
    description: t('با APU دلسا قیمت محصولات را پایش کن، اختلاف‌ها را ببین و با اطمینان درباره‌ی تغییر قیمت تصمیم بگیر.'),
    icons: { icon: '/delsa-mark.svg' },
    alternates: { canonical: localizeHref(locale, path), languages: { ...languages, 'x-default': languages.fa } },
    openGraph: { locale: LOCALE_INFO[locale].og, alternateLocale: LOCALES.filter((code) => code !== locale).map((code) => LOCALE_INFO[code].og) },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dir, messages } = await getI18n();
  return (
    <html lang={locale} dir={dir} data-theme="dark" suppressHydrationWarning>
      <body>
        <I18nProvider locale={locale} messages={messages}>
          {children}
          <ThemeToggle />
          <LanguageSwitcher />
          <VisitorChat />
          <ScrollReveal />
        </I18nProvider>
      </body>
    </html>
  );
}

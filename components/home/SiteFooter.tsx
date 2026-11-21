'use client';

import Link from '../i18n/Link';
import { useI18n } from '../i18n/I18nProvider';

/** Shared footer for every public page (homepage design system). */
export default function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="hx-footer">
      <div className="hx-wrap hx-foot-grid">
        <div className="hx-foot-about">
          <Link href="/" className="hx-brand"><img src="/delsa-mark.svg" alt="" width={34} height={34} />DELSA</Link>
          <p>Digital Engagement Layer System Automation</p>
        </div>
        <div><h4>{t('محصولات')}</h4><Link href="/#cima">CIMA · CRM</Link><Link href="/#apu">APU</Link><Link href="/store">{t('فروشگاه')}</Link></div>
        <div><h4>{t('دلسا')}</h4><Link href="/#how">{t('نحوهٔ کار')}</Link><Link href="/#channels">{t('کانال‌ها')}</Link><Link href="/pricing">{t('تعرفه')}</Link></div>
        <div><h4>{t('حساب')}</h4><Link href="/login">{t('ورود به پنل')}</Link><Link href="/signup">{t('ساخت حساب')}</Link><Link href="/admin/login">{t('ورود مدیر')}</Link></div>
      </div>
    </footer>
  );
}

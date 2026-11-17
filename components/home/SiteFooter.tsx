import Link from 'next/link';

/** Shared footer for every public page (homepage design system). */
export default function SiteFooter() {
  return (
    <footer className="hx-footer">
      <div className="hx-wrap hx-foot-grid">
        <div className="hx-foot-about">
          <Link href="/" className="hx-brand"><img src="/delsa-mark.svg" alt="" width={34} height={34} />DELSA</Link>
          <p>Digital Engagement Layer System Automation</p>
        </div>
        <div><h4>محصولات</h4><Link href="/#cima">CIMA · CRM</Link><Link href="/#apu">APU</Link><Link href="/store">فروشگاه</Link></div>
        <div><h4>دلسا</h4><Link href="/#how">نحوهٔ کار</Link><Link href="/#channels">کانال‌ها</Link><Link href="/pricing">تعرفه</Link></div>
        <div><h4>حساب</h4><Link href="/login">ورود به پنل</Link><Link href="/signup">ساخت حساب</Link><Link href="/admin/login">ورود مدیر</Link></div>
      </div>
    </footer>
  );
}

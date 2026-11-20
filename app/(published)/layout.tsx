import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/500.css';
import '@fontsource/vazirmatn/700.css';
import '../globals.css';
import ThemeToggle from '../../components/ThemeToggle';
import VisitorChat from '../../components/VisitorChat';
import ScrollReveal from '../../components/ScrollReveal';

// Customer-published sites (/s/*) are served from the ISR cache, so this root layout must stay
// static: no headers()/cookies() here, and no locale handling (the content is the customer's own).
export const metadata = { title: 'دلسا | پایش و به‌روزرسانی هوشمند قیمت', description: 'با APU دلسا قیمت محصولات را پایش کن، اختلاف‌ها را ببین و با اطمینان درباره‌ی تغییر قیمت تصمیم بگیر.', icons: { icon: '/delsa-mark.svg' } };
export default function PublishedRootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="fa" dir="rtl" data-theme="dark" suppressHydrationWarning><body>{children}<ThemeToggle /><VisitorChat /><ScrollReveal /></body></html>;
}

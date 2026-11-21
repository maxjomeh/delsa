import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/500.css';
import '@fontsource/vazirmatn/700.css';
import '../globals.css';
import ThemeToggle from '../../components/ThemeToggle';
import VisitorChat from '../../components/VisitorChat';
import ScrollReveal from '../../components/ScrollReveal';

// Customer-published sites (/s/*) are served from the ISR cache, so this root layout must stay
// static: no headers()/cookies() here, and no locale handling (the content is the customer's own).
export const metadata = { title: 'دلسا | پاسخ‌گویی هوشمند و CRM مکالمه‌محور CIMA', description: 'دلسا پیام مشتری را می‌فهمد و مسیر فروش را از پاسخ‌گویی و تشکیل سبد خرید تا پرداخت و پیگیری سفارش مدیریت می‌کند. آشنایی با CRM مکالمه‌محور CIMA.', icons: { icon: '/delsa-mark.svg' } };
export default function PublishedRootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="fa" dir="rtl" data-theme="dark" suppressHydrationWarning><body>{children}<ThemeToggle /><VisitorChat /><ScrollReveal /></body></html>;
}

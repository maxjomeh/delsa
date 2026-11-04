import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/500.css';
import '@fontsource/vazirmatn/700.css';
import './globals.css';
import ThemeToggle from '../components/ThemeToggle';
import VisitorChat from '../components/VisitorChat';
import ScrollReveal from '../components/ScrollReveal';
export const metadata = { title: 'دلسا | پاسخ‌گویی هوشمند و CRM مکالمه‌محور CIMA', description: 'دلسا پیام مشتری را می‌فهمد و مسیر فروش را از پاسخ‌گویی و تشکیل سبد خرید تا پرداخت و پیگیری سفارش مدیریت می‌کند. آشنایی با CRM مکالمه‌محور CIMA.', icons: { icon: '/delsa-mark.svg' } };
export default function RootLayout({children}) { return <html lang="fa" dir="rtl" data-theme="dark" suppressHydrationWarning><body>{children}<ThemeToggle/><VisitorChat/><ScrollReveal/></body></html>; }

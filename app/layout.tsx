import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/500.css';
import '@fontsource/vazirmatn/700.css';
import './globals.css';
import './delsa-tokens.css';
import ThemeToggle from '../components/ThemeToggle';
import VisitorChat from '../components/VisitorChat';
import ScrollReveal from '../components/ScrollReveal';
export const metadata = { title: 'دلسا | اکوسیستم هوشمند کسب‌وکار', description: 'دلسا مجموعه‌ای از سیستم‌های APU، دورپین، سیما و سایت‌ساز را برای مدیریت هوشمند کسب‌وکار ارائه می‌دهد.', icons: { icon: '/delsa-mark.svg' } };
export default function RootLayout({children}) { return <html lang="fa" dir="rtl" data-theme="dark" suppressHydrationWarning><body>{children}<ThemeToggle/><VisitorChat/><ScrollReveal/></body></html>; }

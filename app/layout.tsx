import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/500.css';
import '@fontsource/vazirmatn/700.css';
import './globals.css';
import ThemeToggle from '../components/ThemeToggle';
export const metadata = { title: 'دلسا | پایش و به‌روزرسانی هوشمند قیمت', description: 'با APU دلسا قیمت محصولات را پایش کن، اختلاف‌ها را ببین و با اطمینان درباره‌ی تغییر قیمت تصمیم بگیر.', icons: { icon: '/delsa-mark.svg' } };
export default function RootLayout({children}) { return <html lang="fa" dir="rtl" data-theme="light" suppressHydrationWarning><body>{children}<ThemeToggle/></body></html>; }

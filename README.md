# DELSA

سایت چندزبانهٔ دلسا (فارسی راست‌چین، English، العربية، Türkçe) با تمرکز فعلی بر APU (پایش و به‌روزرسانی قیمت).

## راه‌اندازی محلی

```sh
npm install
cp .env.example .env.local
npm run dev
```

در `.env.local` مقدار `NEXT_PUBLIC_SUPABASE_URL` و `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` پروژه‌ی Supabase را وارد کنید. سپس فایل `supabase/schema.sql` را در SQL Editor همان پروژه اجرا کنید و در Authentication → URL Configuration نشانی‌های سایت محلی و Vercel Preview را به فهرست مجاز اضافه کنید.

## ثبت مدیر

1. مدیر با ایمیل خودش از `/signup` حساب بسازد و ایمیل را تأیید کند.
2. در Supabase SQL Editor دستور انتهای `supabase/schema.sql` را با ایمیل خودش اجرا کند تا نقش `admin` شود.
3. برای پنل مدیریت به `/admin/login` برود. نقش کاربر عادی در فرم عمومی ثبت‌نام قابل ارتقا نیست.

## Vercel

در Project Settings → Environment Variables، متغیرهای `.env.example` را برای Preview و Production ثبت کنید. کلید `service_role` را هرگز در `NEXT_PUBLIC_*` نگذارید یا به مرورگر ندهید. ورود و ثبت‌نام پس از این تنظیم‌ها واقعی هستند؛ APU هنوز به فروشگاه/منبع قیمت وصل نشده و نمونه‌های صفحه داده‌ی نمایشی‌اند.

## مسیرها

- `/`: صفحه‌ی اصلی متحرک و mobile-first با تمرکز APU
- `/signup` و `/login`: ثبت‌نام و ورود ایمیل/رمز
- `/dashboard`: فضای APU کاربر احراز هویت‌شده
- `/admin/login` و `/admin`: ورود نقش‌محور و پنل ادمین
- `/pricing`: صفحه‌ی دسترسی آغازین APU (پرداخت هنوز غیرفعال)

## چندزبانه بودن (i18n)

- فارسی زبان اصلی است و بدون پیشوند سرو می‌شود؛ بقیه با پیشوند مسیر: `/en`، `/ar`، `/tr` (مثلاً `/en/pricing`). `proxy.js` پیشوند را برمی‌دارد، مسیر را rewrite می‌کند و زبان را در هدر درخواست می‌گذارد.
- متن‌ها با خودِ متن فارسی کلید می‌خورند: در کد `t('متن فارسی')` و ترجمه‌ها در `lib/i18n/messages/{en,ar,tr}.js`. فارسی نیازی به فایل ترجمه ندارد.
- سمت سرور: `const { t, href, intl } = await getI18n()` از `lib/i18n/server.js`؛ سمت کلاینت: `const { t, href } = useI18n()` از `components/i18n/I18nProvider.js`. برای لینک‌های داخلی از `components/i18n/Link.js` (به‌جای `next/link`) و برای `redirect`/`router.push` از `href('/مسیر')` استفاده کنید تا زبان کاربر حفظ شود.
- `npm run i18n:check` متن‌های بدون ترجمه را فهرست می‌کند.
- دو root layout جدا: `app/(main)` (چندزبانه، پویا) و `app/(published)` (سایت‌های منتشرشدهٔ `/s/*`؛ باید ایستا بماند تا کش ISR کار کند و نباید `headers()` بخواند).
- هنوز ترجمه نشده‌اند و برای زبان‌های دیگر به نسخهٔ فارسی هدایت می‌شوند: `/dashboard`، `/admin` (به‌جز `/admin/login`) و `/builder`. بعد از تبدیل هر بخش به `t()` الگوی آن را از `PERSIAN_ONLY` در `lib/i18n/config.js` حذف کنید.

# سایت‌ساز: وارد کردن پست، ریلز و استوری اینستاگرام (مرحلهٔ ۱)

## چه چیزی ساخته شده
دکمهٔ «وارد کردن از اینستاگرام» در بخش محصولات سایت‌ساز. مشتری حساب Business/Creator خودش را از راه API رسمی وصل می‌کند و
پست‌ها، ریلزها و استوری‌های فعال را در یک شبکه می‌بیند و انتخاب می‌کند. **در این مرحله محصولی ساخته نمی‌شود** (مراحل بعد: کپی رسانه و ساخت
محصول، هوش مصنوعی، همگام‌سازی).

## معماری
- اتصال جدا از CRM است: جدول `builder_instagram_accounts` و توکن رمزشده در `private.builder_instagram_tokens`
  (`supabase/builder-instagram.sql`). بدون اشتراک CRM کار می‌کند و وب‌هک پیام ندارد.
- یک redirect URI برای هر دو محصول: `/api/crm/instagram/callback`. کوکی state فیلد `purpose:'builder'` دارد و callback بر همان اساس شاخه می‌شود.
  دسترسی درخواستی فقط `instagram_business_basic` (خواندن) است.
- توکن‌ها با AES-256-GCM و `PLATFORM_CREDENTIALS_ENCRYPTION_KEY` رمز می‌شوند؛ مرورگر هرگز توکن نمی‌بیند. توکن ۶۰ روزه است و وقتی کمتر از ۲۰ روز
  بماند هنگام خواندن تمدید می‌شود؛ اگر Instagram آن را نپذیرد حساب «منقضی» می‌شود و مشتری باید دوباره وصل کند.
- مسیرها: `GET/POST /api/builder/instagram` (وضعیت، اتصال، قطع)، `GET /api/builder/instagram/media` (یک صفحه ۲۴تایی).
  فقط آدرس‌های https روی CDN اینستاگرام/فیس‌بوک به مرورگر می‌رسد (`lib/builder-instagram.js`).
- تا زمانی که migration اجرا نشده، وضعیت `installed:false` برمی‌گردد و دیالوگ پیام «هنوز فعال نشده» نشان می‌دهد؛ چیزی خراب نمی‌شود.

## راه‌اندازی
1. اجرای `supabase/builder-instagram.sql` یک‌بار در SQL Editor (بازگشت: `builder-instagram-rollback.sql`).
2. متغیرهای محیطی موجود CRM کافی‌اند: `INSTAGRAM_APP_ID`، `INSTAGRAM_APP_SECRET`، `INSTAGRAM_REDIRECT_URI`، `PLATFORM_CREDENTIALS_ENCRYPTION_KEY` و کلید سرویس Supabase.
3. در اپ Meta: حساب‌هایی غیر از تسترها برای خواندن محتوا به Advanced Access و review اپ برای `instagram_business_basic` نیاز دارند.

## آزمون
- `node supabase/tests/builder-instagram.test.cjs` (پارس رسانه، URLهای امن، صفحه‌بندی، خطاها، تمدید توکن، مسیرها با دیتابیس و Instagram ساختگی)
- `supabase/tests/local-postgres/run.sh supabase/tests/builder-instagram.sql` (جداسازی مالک‌ها، محرمانگی توکن، سقف ۵ حساب، RLS)

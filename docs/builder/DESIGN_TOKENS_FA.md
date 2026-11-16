# DELSA Builder Design Tokens — مرحله DS-01

دامنه: همه قالب‌های سایت‌ساز، Preview و سایت منتشرشده. CSS Variables تنها در `.website` تعریف می‌شوند تا ظاهر پنل مدیریت دلسا تحت‌تأثیر قرار نگیرد.

## گروه توکن‌ها

| گروه | متغیرها | کاربرد |
| --- | --- | --- |
| فاصله | `--builder-space-1` … `--builder-space-12` | فاصله درون کارت، هدر، گرید |
| سکشن و عرض | `--builder-section-space`, `--builder-page-gutter`, `--builder-content-max` | حاشیه و محدودیت عرض |
| شعاع | `--builder-radius-sm`, `--builder-radius-md`, `--builder-radius-card`, `--builder-radius-lg` | کارت و کنترل |
| متن | `--builder-font-sm`, `--builder-font-body`, `--builder-line-body` | مقیاس تایپ |
| حرکت | `--builder-motion-fast`, `--builder-motion-normal`, `--builder-motion-ease` | گذارهای پایدار |
| رنگ معنایی | `--builder-surface`, `--builder-surface-raised`, `--builder-text`, `--builder-text-muted`, `--builder-border`, `--builder-accent` | ارجاع به رنگ‌های هر قالب |

**سازگاری:** رنگ‌های اصلی قالب‌ها (`--bg`, `--panel`, `--site-accent` و غیره) حفظ شده‌اند و توکن‌های معنایی به آنها اشاره می‌کنند؛ داده و قالب‌های قدیمی تغییر نمی‌کنند. تنظیمات اختصاصی طراحی بلوک‌ها همچنان اولویت دارند.

**مواردی که برای مراحل بعد بازند:** مهاجرت کامل بقیه کامپوننت‌ها به توکن‌ها، ارزیابی بصری همه ۹ قالب در دارک/لایت، سیستم Motion، تست موبایل/تبلت و بازبینی accessibility. انجام DS-01 به معنی تکمیل این موارد نیست.

**قانون پیشرفت:** یک مورد فقط با ثبت تغییرات در مخزن، Build موفق و بررسی پایه علامت می‌خورد؛ برای انتشار نهایی آزمون دیداری و کنترل کارکرد نیز ضروری است.

# نسخه اولیه سایت و داشبورد دلسا

این پروژه پیش‌نمایش قابل اجراست؛ سایت عمومی، داشبورد مشتری و نمونه پنل مدیریت را دارد.
رنگ‌ها: مشکی، نارنجی و سفید. زبان: فارسی و راست‌چین.

**وضعیت:** ساخت پروژه تأیید شده؛ هنوز در GitHub یا Vercel منتشر نشده است.
ورود واقعی، پایگاه داده، انتشار محتوای مدیریت و اتصال پیام‌رسان‌ها هنوز پیاده‌سازی نشده‌اند.
پنل مدیریت عمومی و فقط نمایشی است؛ هیچ داده محرمانه‌ای در آن قرار ندهید.

---

# DELSA — first interface preview

Persian RTL Next.js App Router project for GitHub and Vercel.

## Run

Node.js 22 or 24 LTS.

```sh
npm ci
npm run dev
```

Production verification: `npm run build`, then `npm start`.

## Routes

- `/`: DELSA and APU introduction.
- `/dashboard`: interactive customer workspace with clearly labeled sample data.
- `/dashboard?tab=apu`: product search, status filter, review approval, simulated updates and CSV download.
- `/dashboard?tab=channels`: channel selection preview.
- `/admin`: PUBLIC, SAMPLE-ONLY management interface preview, NOT a secured admin application.

## Current boundary

No authentication, database, real store credentials, message delivery, payment processing, scheduled execution or external channel integration exists yet. All sample changes are React memory state, discarded on refresh. The settings form and admin title editor preview changes locally only; they do not publish or persist anything. Never add private information to these public demo routes.

## Deployment

Create a private GitHub repository, push this project, then import that repository into Vercel using the Next.js preset. Root directory should be the directory containing this package.json. No environment variables are required for this demo. This project has not yet been pushed or deployed.

Next delivery phase: real identity and sessions, database and tenant isolation, protected admin routes, editable CMS, server-side n8n integration, audited connector setup, then real service testing. Channel support must be verified individually before claiming availability. Keep all service secrets server-side and outside Git.

Dependencies are pinned by package-lock.json; the Vazirmatn typeface is bundled locally.

Official setup references: https://nextjs.org/docs/app/getting-started/installation and https://vercel.com/docs/git/vercel-for-github

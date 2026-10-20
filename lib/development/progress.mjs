// CIMA reviewed baseline — 2026-10-20, production SHA pinned.
// Implementation and readiness are distinct audited estimates, not CI success probabilities.
// Automated adjustments must NEVER treat a deployment or file existence as functional acceptance.
export const BASELINE_SHA = '308ca5a281be8781432dc9993bca288c599509f3';
export const AUDIT_DATE = '2026-10-20';
export const PHASES = [
  {
    "number": 0,
    "name": "ایمنی و پایش",
    "weight": 13,
    "lines": "جلوگیری از بازنویسی اطلاعات تأییدنشده|12|90|75|intelligence;learning|identity\nجداسازی Tenant، حساب و نقش‌ها|14|75|55|review;send|human\nاعتبارسنجی OAuth و امضای Webhook|10|85|70|webhook;connect|identity\nکنترل مجوز، هویت و بازهٔ ارسال|14|85|55|send|human\nحفظ داده، نگهداری و بازیابی|8|65|45|history;historyCron|historyTest\nتطبیق Schema فعلی و هدف|7|65|50|migrationHistory;migrationReview|historyTest\nتست‌های رگرسیون و امنیت|11|70|45|review;send|human\nمانیتورینگ اتصال و Cron|9|80|55|health;historyCron|stability\nامنیت کلیدها و حریم خصوصی|9|70|40|model;copilot|gaptest\nپایداری رابط Production|6|65|25|workspace|stability",
    "features": [
      {
        "id": "p0f1",
        "label": "جلوگیری از بازنویسی اطلاعات تأییدنشده",
        "weight": 12,
        "implementation": 90,
        "readiness": 75,
        "sourcePaths": [
          "app/api/crm/intelligence/route.js",
          "app/api/crm/learning/route.js"
        ],
        "testPaths": [
          "tests/cima-identity-delivery-fields.test.mjs"
        ]
      },
      {
        "id": "p0f2",
        "label": "جداسازی Tenant، حساب و نقش‌ها",
        "weight": 14,
        "implementation": 75,
        "readiness": 55,
        "sourcePaths": [
          "app/api/crm/reviews/route.js",
          "app/api/crm/reviews/send/route.js"
        ],
        "testPaths": [
          "tests/cima-human-review-foundation.test.mjs"
        ]
      },
      {
        "id": "p0f3",
        "label": "اعتبارسنجی OAuth و امضای Webhook",
        "weight": 10,
        "implementation": 85,
        "readiness": 70,
        "sourcePaths": [
          "app/api/crm/zernio/webhook/route.js",
          "app/api/crm/zernio/route.js"
        ],
        "testPaths": [
          "tests/cima-identity-delivery-fields.test.mjs"
        ]
      },
      {
        "id": "p0f4",
        "label": "کنترل مجوز، هویت و بازهٔ ارسال",
        "weight": 14,
        "implementation": 85,
        "readiness": 55,
        "sourcePaths": [
          "app/api/crm/reviews/send/route.js"
        ],
        "testPaths": [
          "tests/cima-human-review-foundation.test.mjs"
        ]
      },
      {
        "id": "p0f5",
        "label": "حفظ داده، نگهداری و بازیابی",
        "weight": 8,
        "implementation": 65,
        "readiness": 45,
        "sourcePaths": [
          "lib/crm/zernio-history.mjs",
          "app/api/crm/zernio/history/cron/route.js"
        ],
        "testPaths": [
          "tests/zernio-history-ml.test.mjs"
        ]
      },
      {
        "id": "p0f6",
        "label": "تطبیق Schema فعلی و هدف",
        "weight": 7,
        "implementation": 65,
        "readiness": 50,
        "sourcePaths": [
          "supabase/migrations/20261019_zernio_history_canonical_messages.sql",
          "supabase/migrations/20261019_cima_human_review_foundation.sql"
        ],
        "testPaths": [
          "tests/zernio-history-ml.test.mjs"
        ]
      },
      {
        "id": "p0f7",
        "label": "تست‌های رگرسیون و امنیت",
        "weight": 11,
        "implementation": 70,
        "readiness": 45,
        "sourcePaths": [
          "app/api/crm/reviews/route.js",
          "app/api/crm/reviews/send/route.js"
        ],
        "testPaths": [
          "tests/cima-human-review-foundation.test.mjs"
        ]
      },
      {
        "id": "p0f8",
        "label": "مانیتورینگ اتصال و Cron",
        "weight": 9,
        "implementation": 80,
        "readiness": 55,
        "sourcePaths": [
          "app/api/crm/health/route.js",
          "app/api/crm/zernio/history/cron/route.js"
        ],
        "testPaths": [
          "tests/cima-production-stability.test.mjs"
        ]
      },
      {
        "id": "p0f9",
        "label": "امنیت کلیدها و حریم خصوصی",
        "weight": 9,
        "implementation": 70,
        "readiness": 40,
        "sourcePaths": [
          "app/api/admin/cima-model/route.js",
          "app/api/crm/copilot/route.js"
        ],
        "testPaths": [
          "tests/cima-gapgpt-config.test.mjs"
        ]
      },
      {
        "id": "p0f10",
        "label": "پایداری رابط Production",
        "weight": 6,
        "implementation": 65,
        "readiness": 25,
        "sourcePaths": [
          "components/crm/SimaWorkspace.js"
        ],
        "testPaths": [
          "tests/cima-production-stability.test.mjs"
        ]
      }
    ]
  },
  {
    "number": 1,
    "name": "دریافت پیام و تاریخچه",
    "weight": 17,
    "lines": "اتصال و مالکیت حساب Instagram/Zernio|10|90|75|connect;zernio|identity\nدریافت Webhook زنده و معتبر|10|85|70|webhook|historyTest\nذخیره و Projection رویداد به CRM|12|85|75|webhook;migrationHistory|historyTest\nمدل Canonical Conversation و Message|15|40|30|migrationHistory;history|historyTest\nDedup با شناسهٔ پیام Provider|13|45|20|history;dedupe|historyTest\nواردسازی تاریخچهٔ قابل‌دسترسی|14|80|60|history;historyRoute|historyTest\nCursor، Checkpoint، Resume و Lease|10|85|60|history;historyCron|historyTest\nمدیریت Replay و رویداد خارج از ترتیب|6|60|40|webhook;history|historyTest\nتطبیق هویت مشتری و حساب|5|75|55|webhook;social|identity\nنمایش وضعیت واردسازی و رسیدها|5|65|40|historyUI;historyRoute|historyTest",
    "features": [
      {
        "id": "p1f1",
        "label": "اتصال و مالکیت حساب Instagram/Zernio",
        "weight": 10,
        "implementation": 90,
        "readiness": 75,
        "sourcePaths": [
          "app/api/crm/zernio/route.js",
          "lib/crm/zernio.mjs"
        ],
        "testPaths": [
          "tests/cima-identity-delivery-fields.test.mjs"
        ]
      },
      {
        "id": "p1f2",
        "label": "دریافت Webhook زنده و معتبر",
        "weight": 10,
        "implementation": 85,
        "readiness": 70,
        "sourcePaths": [
          "app/api/crm/zernio/webhook/route.js"
        ],
        "testPaths": [
          "tests/zernio-history-ml.test.mjs"
        ]
      },
      {
        "id": "p1f3",
        "label": "ذخیره و Projection رویداد به CRM",
        "weight": 12,
        "implementation": 85,
        "readiness": 75,
        "sourcePaths": [
          "app/api/crm/zernio/webhook/route.js",
          "supabase/migrations/20261019_zernio_history_canonical_messages.sql"
        ],
        "testPaths": [
          "tests/zernio-history-ml.test.mjs"
        ]
      },
      {
        "id": "p1f4",
        "label": "مدل Canonical Conversation و Message",
        "weight": 15,
        "implementation": 40,
        "readiness": 30,
        "sourcePaths": [
          "supabase/migrations/20261019_zernio_history_canonical_messages.sql",
          "lib/crm/zernio-history.mjs"
        ],
        "testPaths": [
          "tests/zernio-history-ml.test.mjs"
        ]
      },
      {
        "id": "p1f5",
        "label": "Dedup با شناسهٔ پیام Provider",
        "weight": 13,
        "implementation": 45,
        "readiness": 20,
        "sourcePaths": [
          "lib/crm/zernio-history.mjs",
          "lib/crm/dedupe-display.mjs"
        ],
        "testPaths": [
          "tests/zernio-history-ml.test.mjs"
        ]
      },
      {
        "id": "p1f6",
        "label": "واردسازی تاریخچهٔ قابل‌دسترسی",
        "weight": 14,
        "implementation": 80,
        "readiness": 60,
        "sourcePaths": [
          "lib/crm/zernio-history.mjs",
          "app/api/crm/zernio/history/route.js"
        ],
        "testPaths": [
          "tests/zernio-history-ml.test.mjs"
        ]
      },
      {
        "id": "p1f7",
        "label": "Cursor، Checkpoint، Resume و Lease",
        "weight": 10,
        "implementation": 85,
        "readiness": 60,
        "sourcePaths": [
          "lib/crm/zernio-history.mjs",
          "app/api/crm/zernio/history/cron/route.js"
        ],
        "testPaths": [
          "tests/zernio-history-ml.test.mjs"
        ]
      },
      {
        "id": "p1f8",
        "label": "مدیریت Replay و رویداد خارج از ترتیب",
        "weight": 6,
        "implementation": 60,
        "readiness": 40,
        "sourcePaths": [
          "app/api/crm/zernio/webhook/route.js",
          "lib/crm/zernio-history.mjs"
        ],
        "testPaths": [
          "tests/zernio-history-ml.test.mjs"
        ]
      },
      {
        "id": "p1f9",
        "label": "تطبیق هویت مشتری و حساب",
        "weight": 5,
        "implementation": 75,
        "readiness": 55,
        "sourcePaths": [
          "app/api/crm/zernio/webhook/route.js",
          "lib/crm/social-profile.mjs"
        ],
        "testPaths": [
          "tests/cima-identity-delivery-fields.test.mjs"
        ]
      },
      {
        "id": "p1f10",
        "label": "نمایش وضعیت واردسازی و رسیدها",
        "weight": 5,
        "implementation": 65,
        "readiness": 40,
        "sourcePaths": [
          "components/crm/HistorySyncPanel.js",
          "app/api/crm/zernio/history/route.js"
        ],
        "testPaths": [
          "tests/zernio-history-ml.test.mjs"
        ]
      }
    ]
  },
  {
    "number": 2,
    "name": "صندوق پاسخ انسانی",
    "weight": 17,
    "lines": "رابط سه‌ستونهٔ RTL و موبایل|8|90|45|humanUI|human\nصف اختصاصی بررسی هر کسب‌وکار|12|90|70|review;humanUI|human\nنمایش دلیل ارجاع، فیلتر و شواهد|6|75|50|humanUI|human\nنوشتن، ذخیره و ویرایش پاسخ انسانی|10|85|55|review;humanUI|human\nتشخیص پیش‌نویس منسوخ و Version Guard|11|90|55|review;send|human\nارسال واقعی از حساب صحیح Instagram|17|80|25|send|humanSend\nOutbox اتمیک و جلوگیری از ارسال تکراری|12|90|65|send;migrationOutbox|humanSend\nمدیریت UNKNOWN و بازیابی وضعیت ارسال|8|50|25|send|humanSend\nرسید ارسال و تفکیک پیام از یادداشت|5|65|35|inbox;send|humanSend\nجست‌وجو و آغاز گفتگو بدون سابقه|5|40|20|humanUI|human\nفرم بازدیدکننده و تبدیل برچسب مشتری|6|30|10|humanUI|human",
    "features": [
      {
        "id": "p2f1",
        "label": "رابط سه‌ستونهٔ RTL و موبایل",
        "weight": 8,
        "implementation": 90,
        "readiness": 45,
        "sourcePaths": [
          "components/crm/HumanReviewWorkspace.js"
        ],
        "testPaths": [
          "tests/cima-human-review-foundation.test.mjs"
        ]
      },
      {
        "id": "p2f2",
        "label": "صف اختصاصی بررسی هر کسب‌وکار",
        "weight": 12,
        "implementation": 90,
        "readiness": 70,
        "sourcePaths": [
          "app/api/crm/reviews/route.js",
          "components/crm/HumanReviewWorkspace.js"
        ],
        "testPaths": [
          "tests/cima-human-review-foundation.test.mjs"
        ]
      },
      {
        "id": "p2f3",
        "label": "نمایش دلیل ارجاع، فیلتر و شواهد",
        "weight": 6,
        "implementation": 75,
        "readiness": 50,
        "sourcePaths": [
          "components/crm/HumanReviewWorkspace.js"
        ],
        "testPaths": [
          "tests/cima-human-review-foundation.test.mjs"
        ]
      },
      {
        "id": "p2f4",
        "label": "نوشتن، ذخیره و ویرایش پاسخ انسانی",
        "weight": 10,
        "implementation": 85,
        "readiness": 55,
        "sourcePaths": [
          "app/api/crm/reviews/route.js",
          "components/crm/HumanReviewWorkspace.js"
        ],
        "testPaths": [
          "tests/cima-human-review-foundation.test.mjs"
        ]
      },
      {
        "id": "p2f5",
        "label": "تشخیص پیش‌نویس منسوخ و Version Guard",
        "weight": 11,
        "implementation": 90,
        "readiness": 55,
        "sourcePaths": [
          "app/api/crm/reviews/route.js",
          "app/api/crm/reviews/send/route.js"
        ],
        "testPaths": [
          "tests/cima-human-review-foundation.test.mjs"
        ]
      },
      {
        "id": "p2f6",
        "label": "ارسال واقعی از حساب صحیح Instagram",
        "weight": 17,
        "implementation": 80,
        "readiness": 25,
        "sourcePaths": [
          "app/api/crm/reviews/send/route.js"
        ],
        "testPaths": [
          "tests/cima-human-send.test.mjs"
        ]
      },
      {
        "id": "p2f7",
        "label": "Outbox اتمیک و جلوگیری از ارسال تکراری",
        "weight": 12,
        "implementation": 90,
        "readiness": 65,
        "sourcePaths": [
          "app/api/crm/reviews/send/route.js",
          "supabase/migrations/20261019_cima_human_send_outbox.sql"
        ],
        "testPaths": [
          "tests/cima-human-send.test.mjs"
        ]
      },
      {
        "id": "p2f8",
        "label": "مدیریت UNKNOWN و بازیابی وضعیت ارسال",
        "weight": 8,
        "implementation": 50,
        "readiness": 25,
        "sourcePaths": [
          "app/api/crm/reviews/send/route.js"
        ],
        "testPaths": [
          "tests/cima-human-send.test.mjs"
        ]
      },
      {
        "id": "p2f9",
        "label": "رسید ارسال و تفکیک پیام از یادداشت",
        "weight": 5,
        "implementation": 65,
        "readiness": 35,
        "sourcePaths": [
          "components/crm/SimaInbox.js",
          "app/api/crm/reviews/send/route.js"
        ],
        "testPaths": [
          "tests/cima-human-send.test.mjs"
        ]
      },
      {
        "id": "p2f10",
        "label": "جست‌وجو و آغاز گفتگو بدون سابقه",
        "weight": 5,
        "implementation": 40,
        "readiness": 20,
        "sourcePaths": [
          "components/crm/HumanReviewWorkspace.js"
        ],
        "testPaths": [
          "tests/cima-human-review-foundation.test.mjs"
        ]
      },
      {
        "id": "p2f11",
        "label": "فرم بازدیدکننده و تبدیل برچسب مشتری",
        "weight": 6,
        "implementation": 30,
        "readiness": 10,
        "sourcePaths": [
          "components/crm/HumanReviewWorkspace.js"
        ],
        "testPaths": [
          "tests/cima-human-review-foundation.test.mjs"
        ]
      }
    ]
  },
  {
    "number": 3,
    "name": "دانش و CRM پویا",
    "weight": 19,
    "lines": "ایجاد، ویرایش، تأیید و Revision دانش|11|85|40|knowledge|knowledgeTest\nCitation، منبع و تاریخ انقضای دانش|10|75|20|grounding;knowledge|knowledgeTest\nقیمت و موجودی زنده با دسترسی مجاز|8|10|0|| \nحافظهٔ مشتری با منشأ داده|10|70|40|memory|knowledgeTest\nحفظ اولویت اطلاعات تأییدشده|10|70|45|learning;memory|identity\nکشف پیشنهادی فیلدهای اختصاصی|11|70|40|adaptive;intelligence|historyTest\nتعریف نوع، معنا و تأیید فیلد|7|65|35|information;learning|identity\nBackfill تمام مشتریان تاریخی|12|25|10|intelligence;history|historyTest\nاستخراج Typed Facts و حل تعارض|7|55|30|adaptive;memory|historyTest\nتعمیم قابل‌اتکا به اصناف مختلف|5|50|25|adaptive|historyTest\nرضایت و حریم خصوصی|4|30|10|memory|identity\nپرسیدن هوشمند اطلاعات ناقص|5|45|20|information;intelligence|historyTest",
    "features": [
      {
        "id": "p3f1",
        "label": "ایجاد، ویرایش، تأیید و Revision دانش",
        "weight": 11,
        "implementation": 85,
        "readiness": 40,
        "sourcePaths": [
          "app/api/crm/knowledge/route.js"
        ],
        "testPaths": [
          "tests/cima-knowledge-copilot.test.mjs"
        ]
      },
      {
        "id": "p3f2",
        "label": "Citation، منبع و تاریخ انقضای دانش",
        "weight": 10,
        "implementation": 75,
        "readiness": 20,
        "sourcePaths": [
          "lib/crm/cima-grounding.mjs",
          "app/api/crm/knowledge/route.js"
        ],
        "testPaths": [
          "tests/cima-knowledge-copilot.test.mjs"
        ]
      },
      {
        "id": "p3f3",
        "label": "قیمت و موجودی زنده با دسترسی مجاز",
        "weight": 8,
        "implementation": 10,
        "readiness": 0,
        "sourcePaths": [],
        "testPaths": []
      },
      {
        "id": "p3f4",
        "label": "حافظهٔ مشتری با منشأ داده",
        "weight": 10,
        "implementation": 70,
        "readiness": 40,
        "sourcePaths": [
          "app/api/crm/memory/route.js"
        ],
        "testPaths": [
          "tests/cima-knowledge-copilot.test.mjs"
        ]
      },
      {
        "id": "p3f5",
        "label": "حفظ اولویت اطلاعات تأییدشده",
        "weight": 10,
        "implementation": 70,
        "readiness": 45,
        "sourcePaths": [
          "app/api/crm/learning/route.js",
          "app/api/crm/memory/route.js"
        ],
        "testPaths": [
          "tests/cima-identity-delivery-fields.test.mjs"
        ]
      },
      {
        "id": "p3f6",
        "label": "کشف پیشنهادی فیلدهای اختصاصی",
        "weight": 11,
        "implementation": 70,
        "readiness": 40,
        "sourcePaths": [
          "lib/crm/adaptive-fields.mjs",
          "app/api/crm/intelligence/route.js"
        ],
        "testPaths": [
          "tests/zernio-history-ml.test.mjs"
        ]
      },
      {
        "id": "p3f7",
        "label": "تعریف نوع، معنا و تأیید فیلد",
        "weight": 7,
        "implementation": 65,
        "readiness": 35,
        "sourcePaths": [
          "components/crm/InformationWorkspace.js",
          "app/api/crm/learning/route.js"
        ],
        "testPaths": [
          "tests/cima-identity-delivery-fields.test.mjs"
        ]
      },
      {
        "id": "p3f8",
        "label": "Backfill تمام مشتریان تاریخی",
        "weight": 12,
        "implementation": 25,
        "readiness": 10,
        "sourcePaths": [
          "app/api/crm/intelligence/route.js",
          "lib/crm/zernio-history.mjs"
        ],
        "testPaths": [
          "tests/zernio-history-ml.test.mjs"
        ]
      },
      {
        "id": "p3f9",
        "label": "استخراج Typed Facts و حل تعارض",
        "weight": 7,
        "implementation": 55,
        "readiness": 30,
        "sourcePaths": [
          "lib/crm/adaptive-fields.mjs",
          "app/api/crm/memory/route.js"
        ],
        "testPaths": [
          "tests/zernio-history-ml.test.mjs"
        ]
      },
      {
        "id": "p3f10",
        "label": "تعمیم قابل‌اتکا به اصناف مختلف",
        "weight": 5,
        "implementation": 50,
        "readiness": 25,
        "sourcePaths": [
          "lib/crm/adaptive-fields.mjs"
        ],
        "testPaths": [
          "tests/zernio-history-ml.test.mjs"
        ]
      },
      {
        "id": "p3f11",
        "label": "رضایت و حریم خصوصی",
        "weight": 4,
        "implementation": 30,
        "readiness": 10,
        "sourcePaths": [
          "app/api/crm/memory/route.js"
        ],
        "testPaths": [
          "tests/cima-identity-delivery-fields.test.mjs"
        ]
      },
      {
        "id": "p3f12",
        "label": "پرسیدن هوشمند اطلاعات ناقص",
        "weight": 5,
        "implementation": 45,
        "readiness": 20,
        "sourcePaths": [
          "components/crm/InformationWorkspace.js",
          "app/api/crm/intelligence/route.js"
        ],
        "testPaths": [
          "tests/zernio-history-ml.test.mjs"
        ]
      }
    ]
  },
  {
    "number": 4,
    "name": "هوشمندی و ارزیابی AI",
    "weight": 18,
    "lines": "مدیریت GapGPT و کلید در پنل|9|90|75|model;gapgpt|gaptest\nمحدودیت درخواست و هزینه|7|80|60|gapgpt;copilot|gaptest\nتولید پیش‌نویس LLM با نظارت انسان|12|85|15|copilot|knowledgeTest\nقوانین Risk و Hard Gates|11|75|50|grounding|knowledgeTest\nGrounding و ردیابی منابع|10|70|20|grounding;copilot|knowledgeTest\nConfidence مستقل و کالیبره‌شده|13|15|0|grounding|knowledgeTest\nبازخورد مدیر و مجموعهٔ دادهٔ آموزشی|9|75|20|feedback;copilot|knowledgeTest\nBenchmark مستقل و Held-out Testing|10|10|0|| \nVersioning مدل و Prompt و دسته‌بندی خطاها|6|40|10|copilot;model|gaptest\nShadow Mode و آزمایشگاه عملکرد|6|20|5|| \nمدیریت شکاف‌های دانش|7|60|30|copilot;knowledge|knowledgeTest",
    "features": [
      {
        "id": "p4f1",
        "label": "مدیریت GapGPT و کلید در پنل",
        "weight": 9,
        "implementation": 90,
        "readiness": 75,
        "sourcePaths": [
          "app/api/admin/cima-model/route.js",
          "lib/crm/cima-gapgpt.mjs"
        ],
        "testPaths": [
          "tests/cima-gapgpt-config.test.mjs"
        ]
      },
      {
        "id": "p4f2",
        "label": "محدودیت درخواست و هزینه",
        "weight": 7,
        "implementation": 80,
        "readiness": 60,
        "sourcePaths": [
          "lib/crm/cima-gapgpt.mjs",
          "app/api/crm/copilot/route.js"
        ],
        "testPaths": [
          "tests/cima-gapgpt-config.test.mjs"
        ]
      },
      {
        "id": "p4f3",
        "label": "تولید پیش‌نویس LLM با نظارت انسان",
        "weight": 12,
        "implementation": 85,
        "readiness": 15,
        "sourcePaths": [
          "app/api/crm/copilot/route.js"
        ],
        "testPaths": [
          "tests/cima-knowledge-copilot.test.mjs"
        ]
      },
      {
        "id": "p4f4",
        "label": "قوانین Risk و Hard Gates",
        "weight": 11,
        "implementation": 75,
        "readiness": 50,
        "sourcePaths": [
          "lib/crm/cima-grounding.mjs"
        ],
        "testPaths": [
          "tests/cima-knowledge-copilot.test.mjs"
        ]
      },
      {
        "id": "p4f5",
        "label": "Grounding و ردیابی منابع",
        "weight": 10,
        "implementation": 70,
        "readiness": 20,
        "sourcePaths": [
          "lib/crm/cima-grounding.mjs",
          "app/api/crm/copilot/route.js"
        ],
        "testPaths": [
          "tests/cima-knowledge-copilot.test.mjs"
        ]
      },
      {
        "id": "p4f6",
        "label": "Confidence مستقل و کالیبره‌شده",
        "weight": 13,
        "implementation": 15,
        "readiness": 0,
        "sourcePaths": [
          "lib/crm/cima-grounding.mjs"
        ],
        "testPaths": [
          "tests/cima-knowledge-copilot.test.mjs"
        ]
      },
      {
        "id": "p4f7",
        "label": "بازخورد مدیر و مجموعهٔ دادهٔ آموزشی",
        "weight": 9,
        "implementation": 75,
        "readiness": 20,
        "sourcePaths": [
          "app/api/crm/copilot/feedback/route.js",
          "app/api/crm/copilot/route.js"
        ],
        "testPaths": [
          "tests/cima-knowledge-copilot.test.mjs"
        ]
      },
      {
        "id": "p4f8",
        "label": "Benchmark مستقل و Held-out Testing",
        "weight": 10,
        "implementation": 10,
        "readiness": 0,
        "sourcePaths": [],
        "testPaths": []
      },
      {
        "id": "p4f9",
        "label": "Versioning مدل و Prompt و دسته‌بندی خطاها",
        "weight": 6,
        "implementation": 40,
        "readiness": 10,
        "sourcePaths": [
          "app/api/crm/copilot/route.js",
          "app/api/admin/cima-model/route.js"
        ],
        "testPaths": [
          "tests/cima-gapgpt-config.test.mjs"
        ]
      },
      {
        "id": "p4f10",
        "label": "Shadow Mode و آزمایشگاه عملکرد",
        "weight": 6,
        "implementation": 20,
        "readiness": 5,
        "sourcePaths": [],
        "testPaths": []
      },
      {
        "id": "p4f11",
        "label": "مدیریت شکاف‌های دانش",
        "weight": 7,
        "implementation": 60,
        "readiness": 30,
        "sourcePaths": [
          "app/api/crm/copilot/route.js",
          "app/api/crm/knowledge/route.js"
        ],
        "testPaths": [
          "tests/cima-knowledge-copilot.test.mjs"
        ]
      }
    ]
  },
  {
    "number": 5,
    "name": "خودکارسازی کنترل‌شده",
    "weight": 9,
    "lines": "سیاست استقلال برای هر Tenant و Domain|15|15|0|| \nتعریف Intentهای کم‌ریسک مجاز|12|15|0|grounding|knowledgeTest\nThreshold کالیبره و Selective Risk|18|0|0|| \nCanary، تأیید مالک و Rollback|15|0|0|| \nKill Switch اختصاصی Autopilot|12|35|15|model|gaptest\nپایش نتیجه و خطای Auto-send|12|0|0|| \nزیرساخت ایمنی قابل‌استفاده مجدد|10|65|40|send;grounding|humanSend\nپایلوت واقعی ارسال خودکار|6|0|0||",
    "features": [
      {
        "id": "p5f1",
        "label": "سیاست استقلال برای هر Tenant و Domain",
        "weight": 15,
        "implementation": 15,
        "readiness": 0,
        "sourcePaths": [],
        "testPaths": []
      },
      {
        "id": "p5f2",
        "label": "تعریف Intentهای کم‌ریسک مجاز",
        "weight": 12,
        "implementation": 15,
        "readiness": 0,
        "sourcePaths": [
          "lib/crm/cima-grounding.mjs"
        ],
        "testPaths": [
          "tests/cima-knowledge-copilot.test.mjs"
        ]
      },
      {
        "id": "p5f3",
        "label": "Threshold کالیبره و Selective Risk",
        "weight": 18,
        "implementation": 0,
        "readiness": 0,
        "sourcePaths": [],
        "testPaths": []
      },
      {
        "id": "p5f4",
        "label": "Canary، تأیید مالک و Rollback",
        "weight": 15,
        "implementation": 0,
        "readiness": 0,
        "sourcePaths": [],
        "testPaths": []
      },
      {
        "id": "p5f5",
        "label": "Kill Switch اختصاصی Autopilot",
        "weight": 12,
        "implementation": 35,
        "readiness": 15,
        "sourcePaths": [
          "app/api/admin/cima-model/route.js"
        ],
        "testPaths": [
          "tests/cima-gapgpt-config.test.mjs"
        ]
      },
      {
        "id": "p5f6",
        "label": "پایش نتیجه و خطای Auto-send",
        "weight": 12,
        "implementation": 0,
        "readiness": 0,
        "sourcePaths": [],
        "testPaths": []
      },
      {
        "id": "p5f7",
        "label": "زیرساخت ایمنی قابل‌استفاده مجدد",
        "weight": 10,
        "implementation": 65,
        "readiness": 40,
        "sourcePaths": [
          "app/api/crm/reviews/send/route.js",
          "lib/crm/cima-grounding.mjs"
        ],
        "testPaths": [
          "tests/cima-human-send.test.mjs"
        ]
      },
      {
        "id": "p5f8",
        "label": "پایلوت واقعی ارسال خودکار",
        "weight": 6,
        "implementation": 0,
        "readiness": 0,
        "sourcePaths": [],
        "testPaths": []
      }
    ]
  },
  {
    "number": 6,
    "name": "Agentها و SaaS پیشرفته",
    "weight": 7,
    "lines": "هستهٔ چندمشتری و جداسازی کسب‌وکار|15|75|55|review;connect|human\nAdapter پیام‌رسان‌های مختلف|11|40|15|zernio|historyTest\nAgent با ابزار Read-only|10|15|0|| \nعملیات Write با Permission Gate|12|0|0|| \nسفارش، محصول، پیگیری و Workflow|12|25|5|| \nعضویت سازمانی و نقش‌های تفویض‌شده|8|35|15|review|human\nصورتحساب و اشتراک SaaS|9|60|35|| \nبسته‌های چندزبانه|7|10|0|| \nپایش هزینه، مصرف و Latency هر Tenant|9|45|10|gapgpt|gaptest\nOnboarding و Disaster Recovery|7|20|5|connect;history|historyTest",
    "features": [
      {
        "id": "p6f1",
        "label": "هستهٔ چندمشتری و جداسازی کسب‌وکار",
        "weight": 15,
        "implementation": 75,
        "readiness": 55,
        "sourcePaths": [
          "app/api/crm/reviews/route.js",
          "app/api/crm/zernio/route.js"
        ],
        "testPaths": [
          "tests/cima-human-review-foundation.test.mjs"
        ]
      },
      {
        "id": "p6f2",
        "label": "Adapter پیام‌رسان‌های مختلف",
        "weight": 11,
        "implementation": 40,
        "readiness": 15,
        "sourcePaths": [
          "lib/crm/zernio.mjs"
        ],
        "testPaths": [
          "tests/zernio-history-ml.test.mjs"
        ]
      },
      {
        "id": "p6f3",
        "label": "Agent با ابزار Read-only",
        "weight": 10,
        "implementation": 15,
        "readiness": 0,
        "sourcePaths": [],
        "testPaths": []
      },
      {
        "id": "p6f4",
        "label": "عملیات Write با Permission Gate",
        "weight": 12,
        "implementation": 0,
        "readiness": 0,
        "sourcePaths": [],
        "testPaths": []
      },
      {
        "id": "p6f5",
        "label": "سفارش، محصول، پیگیری و Workflow",
        "weight": 12,
        "implementation": 25,
        "readiness": 5,
        "sourcePaths": [],
        "testPaths": []
      },
      {
        "id": "p6f6",
        "label": "عضویت سازمانی و نقش‌های تفویض‌شده",
        "weight": 8,
        "implementation": 35,
        "readiness": 15,
        "sourcePaths": [
          "app/api/crm/reviews/route.js"
        ],
        "testPaths": [
          "tests/cima-human-review-foundation.test.mjs"
        ]
      },
      {
        "id": "p6f7",
        "label": "صورتحساب و اشتراک SaaS",
        "weight": 9,
        "implementation": 60,
        "readiness": 35,
        "sourcePaths": [],
        "testPaths": []
      },
      {
        "id": "p6f8",
        "label": "بسته‌های چندزبانه",
        "weight": 7,
        "implementation": 10,
        "readiness": 0,
        "sourcePaths": [],
        "testPaths": []
      },
      {
        "id": "p6f9",
        "label": "پایش هزینه، مصرف و Latency هر Tenant",
        "weight": 9,
        "implementation": 45,
        "readiness": 10,
        "sourcePaths": [
          "lib/crm/cima-gapgpt.mjs"
        ],
        "testPaths": [
          "tests/cima-gapgpt-config.test.mjs"
        ]
      },
      {
        "id": "p6f10",
        "label": "Onboarding و Disaster Recovery",
        "weight": 7,
        "implementation": 20,
        "readiness": 5,
        "sourcePaths": [
          "app/api/crm/zernio/route.js",
          "lib/crm/zernio-history.mjs"
        ],
        "testPaths": [
          "tests/zernio-history-ml.test.mjs"
        ]
      }
    ]
  }
];
export const score = item => +(0.45*item.implementation+0.55*item.readiness).toFixed(1);
export function phaseSummary(phase){
 const implementation=phase.features.reduce((s,x)=>s+x.weight*x.implementation,0)/100;
 const readiness=phase.features.reduce((s,x)=>s+x.weight*x.readiness,0)/100;
 return {implementation:+implementation.toFixed(1),readiness:+readiness.toFixed(1),score:+(0.45*implementation+0.55*readiness).toFixed(1)};
}
export function productSummary(phases){
 const totalWeight=phases.reduce((s,p)=>s+p.weight,0);
 if(!totalWeight)return null;
 const implementation=phases.reduce((s,p)=>s+p.weight*phaseSummary(p).implementation,0)/totalWeight;
 const readiness=phases.reduce((s,p)=>s+p.weight*phaseSummary(p).readiness,0)/totalWeight;
 return {implementation:+implementation.toFixed(1),readiness:+readiness.toFixed(1),score:+(0.45*implementation+0.55*readiness).toFixed(1)};
}
export function applyVerifiedRelease(phases,{productionSha,ciPassed,changedFiles=[],treeFiles=[],completeComparison=false}={}){
 const canInspect=completeComparison&&/^[0-9a-f]{40}$/.test(productionSha||'')&&productionSha!==BASELINE_SHA;
 const changed=new Set(changedFiles),deployed=new Set(treeFiles);
 let promotions=0;
 const result=phases.map(phase=>({...phase,features:phase.features.map(feature=>{
  const relevant=(feature.sourcePaths||[]).some(path=>changed.has(path));
  const sourcePresent=(feature.sourcePaths||[]).length>0&&(feature.sourcePaths||[]).every(path=>deployed.has(path));
  const tested=(feature.testPaths||[]).some(path=>deployed.has(path));
  const autoDeployed=canInspect&&relevant&&sourcePresent;
  const verified=autoDeployed&&ciPassed===true&&tested;
  if(verified)promotions++;
  // Production code changes get at most two implementation points without tests.
  // A passing related CI suite raises this limited technical credit; neither proves E2E quality.
  return {...feature,implementation:autoDeployed?Math.min(95,feature.implementation+(verified?5:2)):feature.implementation,
   readiness:verified?Math.min(80,feature.readiness+3):feature.readiness,
   autoDeployed,autoVerified:verified,sourcePresent,testPresent:tested,sourceChanged:relevant};
 })}));
 return {phases:result,promotions,autoStatus:!productionSha?'unknown_production':productionSha===BASELINE_SHA?'baseline':!completeComparison?'comparison_unavailable':ciPassed!==true?'deployed_code_not_tested':'verified'};
}

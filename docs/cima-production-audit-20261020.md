# CIMA Production Stability Audit — 2026-10-20

## Scope and method
Production deployment verified via Vercel alias lookup: before this fix the served commit was `3020c2399aa17f15d0c513ed646b06f585fb99c0` on both `delsaai.ir` and `www.delsaai.ir`. Inspected Next.js source, current Supabase schema and aggregate data, scheduled jobs, Vercel environment key *names* (never secret values), provider contract documentation and GitHub tests. Vercel production runtime errors were inaccessible with **403**, so cannot claim observed runtime error-free state. An authenticated browser walkthrough and controlled real channel delivery test remain mandatory.

## Audit inventory

| ID | Severity | Evidence / diagnosis | Patch in this branch | Verification |
|---|---|---|---|---|
| A-01 | P0 | The user manually **Promoted a Preview**. ZERNIO_CONNECT_ENABLED, ZERNIO_ENABLE_WEBHOOK and SIMA_HISTORY_CRON_SECRET exist **only** in Vercel Production env configuration. A Preview-built deployment can be READY but not have these values even after promotion. | Create a fresh `target=production` deployment from fixed code; authenticated `/api/crm/health` warns if channel/webhook settings are absent. | Actual new production deployment and alias verification required. |
| A-02 | P1 | `SimaWorkspace` queried as many as 6,000 messages and 5 additional tables every **15 s**; heavy requests and focus events could overlap. | Use 90 s cadence, fetch full current-window message history only for customer/inbox/interactions screens; discard stale responses on section changes. | Source regression + full Next.js build. |
| A-03 | P1 | One optional CRM table, one settings call or one information API could make the workspace discard **all** otherwise successful data. | Partial failure isolation, retaining successful datasets; do not blank all tabs because one query fails. | Source regression + full Next.js build. |
| A-04 | P1 | `CustomerAvatar` incorrectly used a regex matching a limited set of HTTPS URLs; existing avatar URLs containing common characters could be excluded. | One channel-aware HTTPS URL validator used in customer profile, Human Inbox and Unified Inbox. | Unit tests with real-world HTTPS formats. |
| A-05 | P1 | Send button could be disabled without exposing the cause. Two Outbox entries are **pending/zero attempts**, one has provider accepted receipt, one was rejected for already replied. We cannot infer the two pending sends actually reached Zernio. | Authenticated, tenant-scoped preflight diagnostics report window expiration, inactive/replied case, opt-out, missing provider configuration and already attempted turn. UI shows reasons; no extra sends. | Code/test and in-browser review; never blindly retry UNKNOWN. |
| A-06 | P1 | CRM total 2,763 interactions; 139 duplicate **pairs** share channel, customer, direction, body and exact timestamp but different source IDs. The existing read-only presentation deduper covers all observed pairs because all source keys use `zernio-msg:`. | Preserve presentation dedupe, use expanded history only where needed. **No deletion** and no semantic dedupe of messages that might be genuinely distinct. | SQL duplicate-group/source analysis + unit regression. Unique provider-message ID rework is a later specialized migration requiring collision testing. |
| A-07 | P1 | Previous UI listed extra menu items without separating critical work; prior change consolidated primary navigation, but authenticated usability still requires visual acceptance. | Preserve existing navigation; protect each module from unrelated API failures and provide health warnings. | Build; manual browser testing pending. |
| A-08 | P2 | 511 customer records, 18-19 visible social images, 6 fallback social identities; only a fraction of provider identities contain usable photos. | Safe rendering of **available** photos and verified handles; no invented images or names. | Schema counts and client unit test; backfill of unavailable Instagram avatars depends on provider access. |
| A-09 | P1 | 262 CRM information facts are pending review; 6 learning suggestions pending; 0 approved business knowledge sources. This is a lack of review/knowledge data, **not proof of a broken cron**. Four relevant cron jobs are active and no Zernio event is currently in failed state. | Keep human verification; no silent promotion of learned facts or arbitrary inferred columns. | DB state/function/grant checks. Review workflow end-to-end still needs authenticated browser testing. |
| A-10 | P2 | The "صندوق مکالمات" footer still claimed at most 500 customers/messages and implied logging happened outside actual sends. | Correct explanatory copy, display real social thumbnails; separate manual CRM logging from actual Human Inbox sends. | Source regression + build. |
| A-11 | P2 | No up-to-date self-service way to distinguish a Preview missing Production envs from a downed connector. | `GET /api/crm/health`: active CRM tenant only, secret-free provider flags/queue counts and UI warning on degraded deployment. | Security/source regression + build. |

## Acceptance test checklist (to be completed with business owner)
1. Open `/dashboard?tab=crm` at 100% and 125% zoom on desktop and mobile. Switch main and secondary tabs quickly. Check that customer and conversation data remain visible while polling.
2. In `مشتریان`, inspect one real avatar where source photo is present, and one without. Verify valid Instagram profile link and no invented profile details.
3. In `صندوق مکالمات`, compare a previously duplicated timeline against Zernio. Count exactly one rendered copy per identical canonical message, and no lost distinct messages.
4. In `اطلاعات جدید`, check customer-wide matrix and source-backed pending review. Accept and reject controlled, non-sensitive suggestions under an authorized test customer only.
5. In `نیازمند پاسخ شما`, select a recent **test-account conversation**, verify explicit send reason and status. After a *separately authorized* human click, confirm Zernio acceptance + recipient-visible message; inspect idempotency on refresh. Never resend an Unknown without provider reconciliation.
6. In `دانش کسب‌وکار`, verify draft, approve, revoke and KB proposal. AI stays human-only; no responses from unapproved source.
7. Check `اتصال‌ها` shows configured Instagram account, and admin model settings preserve encrypted key/test state; no key leaked to browser.
8. Verify callbacks, original account message processing, manual note, tasks and orders. End-to-end tests require auth and tenant-specific connected accounts.

## Deployment and rollback
- This PR starts from currently served SHA `3020c239...`.
- No database writes, table drops, message deletion or automatic sends in this branch. No production key reads.
- CI runs all Node tests and `npm run build`.
- Deploy via **target=production**, not Preview promotion. Confirm both aliases map to new deployment.
- If client regressions occur, Vercel rollback to prior known-good deployment `dpl_BKJsKWSXR2zSuM7g6iHyZDzsd1Bg`; no SQL rollback needed for this branch.
- If provider remains unavailable, open `/dashboard?tab=crm`, inspect the health warning. Vercel runtime/error observability currently returned 403 to this connection; authorized user may need to inspect their own project Function logs.

## No false completion claims
This repair isolates several verified causes and adds diagnostics. It does **not** prove: Instagram sender delivery to a real recipient, full historical retention beyond provider caps, autonomous ML training, calibrated confidence, authenticated end-to-end tests for every UI page, or comprehensive elimination of duplicates at the ingestion/storage layer.

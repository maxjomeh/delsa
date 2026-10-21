# CIMA Sprint 01 — history cursor and account scope guard

Status: **prepared, not wired into the production history worker**.

The helper `lib/crm/zernio-history-guard.mjs` and its unit tests are available in this branch. A successful unit test or Preview build is **not** evidence that live history ingestion is protected.

Before enabling in production:

1. Import `validHistoryConversation` and `historyNextCursor` in `lib/crm/zernio-history.mjs`.
2. Validate each queued conversation and each fetched conversation before constructing a CRM event. Reject cross-account identifiers rather than inferring ownership.
3. Replace direct `pagination.nextCursor` reads with `historyNextCursor(pagination, currentCursor, 'UPSTREAM_CURSOR')` for conversation pages and `'MESSAGE_CURSOR'` for message pages.
4. Preserve typed `*_MISSING` and `*_STALLED` errors in history job state for operator review; do not silently mark a job complete.
5. Add integration tests with mocked provider pages, including cursor replay, invalid participant, and resume after a failed page.
6. Run full CI, build, tenant-scope regression, a Preview check, and a provider sandbox or authorized replay before promoting.

No existing customer message may be deleted, merged by similarity, or sent as a test. Keep AI auto-send disabled. Record implementation readiness separately from operational readiness in DevOS.

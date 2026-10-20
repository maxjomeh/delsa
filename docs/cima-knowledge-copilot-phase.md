# CIMA — Phase 3/4 foundation: Knowledge, source-backed memory, review-only copilot

Release: 2026-10-20, branch `feat/cima-knowledge-grounded-copilot-20261020`.

## Newly implemented
- **Knowledge Workspace** in SIMA menu: create, edit, approve, revoke per-tenant question/answer, policy, product and procedure sources. Edit reverts entry to draft; every revision is snapshotted in a separate private table by a DB trigger. No source is automatically approved.
- **Customer Memory** in Human Inbox: reads only the customer's own verified CRM information states as confirmed facts. CRM phone has an explicit **unverified** label because old rule-based extraction may have filled it without user approval. Existing pending fact claims are shown separately as unverified proposals with their original evidence. No new inference or cross-business identity merge.
- **Copilot** for one human-review case and current conversation version, session/subscription/tenant-scoped. Evaluates hard blocks before retrieval. Retrieves matching approved, unexpired sources with explainable token-overlap **relevance only** (not probability). For low-risk messages, suggests exact approved answer with source ID/revision; for high-risk or missing knowledge, abstains and explains why.
- Optional **OpenAI Responses API** draft adapter with `store:false`, only short latest message and selected approved business sources. Controlled by server-only `OPENAI_API_KEY` plus `CIMA_AI_DRAFTS_ENABLED=true`; optional `CIMA_AI_MODEL` (defaults gpt-4.1-mini). Currently project lacks an OpenAI model key and switch, so the model is NOT active and no customer conversation is transmitted to a model by this new feature. When enabled, AI text is a **human-review-only draft**; not certified entailment or accuracy.
- **Manager feedback** useful / incorrect / missing knowledge, optional corrected answer stored tenant-privately for future *evaluated* supervised learning. No immediate retraining or learned policy changes.
- Draft candidates store conversation version, source message, source revision IDs, risk reason codes and **NULL confidence** with uncalibrated status. None of these APIs call Zernio sends, the outbox or autonomous follow-ups.

## Known limits
- This is not a fully trained confidence model, calibrated probability, evaluation lab, comprehensive RAG or semantic customer agent. No vector search yet. Matching approved knowledge is conservative and may abstain too often; this is intended until measured quality improves.
- No current business-approved KB records have been seeded: business owner must enter and approve real-world facts before grounded suggestions appear.
- Live price, inventory, part compatibility, commitments and sensitive topics always require a person and/or authoritative live tools even if FAQs appear to match.
- The first UI loads up to 250 knowledge entries; pagination and document ingestion will be a later milestone.
- Phone, city and dynamic CRM values with unknown evidence must not be reported as guaranteed verified data. Pending extraction candidates remain pending until approved.
- Model access requires **separate paid API key** for the selected provider, not the user's ChatGPT subscription.
- Model output is always untrusted until independently evaluated. Future work: citations/claim-entailment verification, knowledge expiry controls, model comparisons, held-out Persian domain tests, calibration, field backfill, hybrid retrieval and audited promotions.

## Acceptance and smoke test
1. Open SIMA > دانش کسب‌وکار. Create a harmless FAQ. Verify draft is not used until approved.
2. Approve FAQ, open SIMA > نیازمند پاسخ شما. Select a low-risk customer question whose text matches the approved source, click «بررسی ریسک و تولید پیشنهاد».
3. Verify reference title and version are shown; click «استفاده در پیش‌نویس، بدون ارسال» and confirm the **send** button is separate.
4. Switch to a price/stock/parts safety topic and confirm the copilot abstains with risk reasons.
5. Mark a suggestion «مفید» or «نادرست». It saves a label and does not change the model.
6. Change conversation source while a draft is open and verify stale candidate is not injected as a new draft.
7. Test tenant isolation, 100% zoom, RTL/mobile, light/dark; verify production domain aliases and existing Zernio webhook remain intact.

Database applied to project `ujsflbpseapemogybrgy`: `20261020_cima_knowledge_copilot.sql`, `20261020_cima_copilot_feedback.sql`. Both additive; historical CRM data untouched. Transactional data quality tests ran with ROLLBACK. No live customer sends during this development.

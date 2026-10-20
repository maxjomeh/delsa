# CIMA Phase 4 — GapGPT model configuration from DELSA admin

## Production architecture

- Admin UI: `/admin?tab=ai`, **تنظیمات هوش مصنوعی** -> **مدل و کلیدهای API سیما**.
- Admin-only API: `GET/POST /api/admin/cima-model`, verifies authenticated Supabase user and `profiles.role='admin'` on each operation. Browser write requests require a same-origin header.
- Token encrypted with **AES-256-GCM** using existing `PLATFORM_CREDENTIALS_ENCRYPTION_KEY` on the server; ciphertext stored in service-role-only `sima_ai_provider_settings`. The complete token is never returned to the browser after saving; changing it replaces the encrypted value with a fresh nonce and immediately disables model calls.
- **GapGPT fixed provider base:** `https://api.gapgpt.app/v1`; only `POST /chat/completions` through the server. No arbitrary host override (prevents SSRF).
- Low-cost default and initial supported model: `gpt-4o-mini`. GapGPT may price this differently from OpenAI's direct pricing: verify the wallet and provider's current rate before estimating cost.
- After rotation: 1. Save 2. Test (makes **one small, potentially billable** model request) 3. Enable. "Test" updates connection status; "Enable" requires a passed test for the current encrypted key. Admin can disable at any time. No Vercel redeploy is needed after changes to the saved key.
- Backend's existing `/api/crm/copilot` reads enabled provider settings on **each** draft request. If GapGPT is enabled and tested, it uses this model; otherwise legacy OpenAI env-key draft adapter remains optional.
- Every model call is restricted to customer message plus matching *approved*, tenant-scoped KB sources. Price, stock, vehicle compatibility, sensitive domains and weak retrieval routes abstain before the model is called.
- **No auto-send**. Output appears only as an unverified proposal in «نیازمند پاسخ شما», and a human must review/edit and use the separate explicit send workflow.
- One model draft per conversation version is reused to prevent repeated calls. The atomic `sima_claim_model_quota` allows at most 20 paid model requests per tenant per UTC day as a conservative pilot guard. No automated retries.
- Server-to-server secrets do not appear in logs, analytics or provider-test responses. Audit entries include action/actor/revision but no token or message text.

## Validation

- Supabase migrations `20261020_cima_gapgpt_settings.sql` and `20261020_cima_gapgpt_usage_limit.sql` applied live (additive only).
- 20 successful + 21st blocked quota call verified in transaction and ROLLBACK.
- GitHub CI runs unit security tests for admin-only access, stable host, mocked GapGPT call, schema privileges, no auto-send, and Next.js build.
- No actual GapGPT key was available in this conversation: screenshot masks most of it. No external paid provider call was performed here. Admin must paste the **full key** in the site UI, test and enable.
- The 0.2 USDT balance visible in the provided screenshot is a point-in-time value, not a claim of current balance.

## Known remaining work

- Independent evaluation of Persian answer quality/grounding, human-labeled confidence calibration and source-claim entailment checks before any autonomous sends.
- Monitoring real paid token usage from upstream responses and configurable budget limits (the current safety guard limits **requests**, not charges/tokens).
- Multiple simultaneously active keys/provider failover and tenant-specific bring-your-own-key plans (currently admin manages one global GapGPT token).
- Provider compatibility may evolve; the dashboard's actual test will confirm the current supplied key and `gpt-4o-mini` route before enabling.

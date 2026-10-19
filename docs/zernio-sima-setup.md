# Zernio → SIMA: staged tenant connector

Status (2026-10-19): feature branch preview only. No production domain deployment, no Zernio API calls, no social OAuth grants, and no automated outbound replies. The additive Supabase migration `sima_zernio_tenant_bridge_20261019` has been applied to the Delsa backend project; both new tables have RLS enabled. GitHub Actions build and security tests passed.

## Before enabling

1. Revoke the Zernio API key shown in a conversation screenshot. Do not reuse it. Create a **new** key in the Zernio API Keys settings. Do not paste keys into chats, screenshots, repositories, or `NEXT_PUBLIC_*` variables.
2. Add `ZERNIO_API_KEY` to the existing Vercel **delsa** project, server-side Production environment only. Do not edit aliases/domains.
3. Generate a separate unpredictable webhook secret (minimum 32 random bytes) and save the exact same value in `ZERNIO_WEBHOOK_SECRET` in Vercel and in the Zernio webhook endpoint settings. Never put it in a client-side variable.
4. Deploy this branch to the existing project as a reviewed production build after tests; until then `ZERNIO_CONNECT_ENABLED=false` and `ZERNIO_ENABLE_WEBHOOK=false`.
5. Configure Zernio webhook URL: `https://www.delsaai.ir/api/crm/zernio/webhook`. Subscribe only to `account.connected`, `account.disconnected`, `message.received`, `comment.received`. Use Zernio's test delivery first after deployment and enabling the webhook flag.
6. Enable `ZERNIO_CONNECT_ENABLED=true` only after testing the endpoint and confirming one test tenant's account remains isolated.

## Design and current boundaries

- The existing `Default` Zernio profile is NOT used for Delsa customers. When a licensed SIMA user initiates connection, the backend finds or provisions a Zernio profile keyed by that authenticated Supabase `user.id` as `externalId`. Mapping is persisted by service role only.
- Only Instagram and Facebook OAuth initiation are included in this first release. Other platforms, including WhatsApp/Telegram, require separate tested flows. The user still approves access on the platform's own consent screen.
- The API key never reaches the browser. Connected accounts are fetched with the tenant's `profileId` and filtered by it before returning minimal display fields.
- Signed Zernio webhook events are bounded to 256 KiB, HMAC-SHA256 verified on raw bytes, checked against the stored tenant/profile mapping, then inserted by unique UUID into a private-to-service-role `crm_zernio_events` intake queue. Duplicates return success without writing twice. Unknown profiles are ignored.
- **Crucial:** Events are persisted in a queue but are NOT YET mapped to `crm_customers` / `crm_interactions`; the worker and tenant-safe contact identity tables are a separate release gate. We do not promise an active inbox before that work.
- Zernio profile = one Delsa business tenant, NOT an end-customer's loyalty profile. No cross-channel merging without consent-backed verified identifiers. The loyalty ledger, purchases, tiers, and rewards remain in Delsa.
- Never connect the same Instagram account through both direct Instagram and Zernio connectors during tests; duplicate intake is otherwise possible once worker processing is enabled.
- Test `node --test supabase/tests/zernio.test.cjs` and `npm run build` through GitHub Actions on the feature branch. Verify production route and a controlled Zernio webhook test before any social OAuth.

## Next gates

1. Rotate exposed key and configure server-only secrets.
2. Review/merge the feature branch to the **actual** production-deployed branch, not blindly to `main`; verify the target in Vercel.
3. Smoke test signature rejection, test webhook, idempotency, profile creation, and account list with one Delsa test tenant.
4. Implement a bounded, resumable, tenant-safe worker to turn persisted inbound `message.received` and `comment.received` events into CRM identities/interactions and monitor retries/failures. Do not enable automated sending before delivery-state and consent controls are in place.
5. Add per-tenant cost metering, account disconnection and reconnection health before general availability.

Official sources: https://docs.zernio.com/multi-tenant , https://docs.zernio.com/webhooks , https://docs.zernio.com/guides/connecting-accounts .

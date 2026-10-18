# DELSA Channel Hub — Instagram receive-only rollout

Updated 2026-10-18. Branch is stacked on CIMA inbox PR #5.

## Delivered

- An Instagram professional account connects using official Instagram Login from the CIMA dashboard.
- Connection credentials stay encrypted server-side; client responses never expose them.
- DELSA owns a tenant-scoped connection. The new delsa_channel_grants table defines service access.
- CIMA is the only supported service grant today. DorPin and outbound rights are explicitly blocked.
- Fresh text-message intake checks the CIMA grant inside the transaction, with a row lock for revocation safety.
- The /api/channels endpoint reads connection metadata and grants. It can enable or revoke CIMA access after authenticated ownership checks.
- Connecting via the CIMA flow explicitly grants CIMA receive-only access; no other product receives a grant.

## To activate the official Meta connection

1. Database deployed 2026-10-18: migration 20261018083809_delsa_channel_hub_instagram_grants_v1 is installed on the existing DELSA delsa-backend Supabase project; transactional permission assertions in supabase/tests/delsa-channel-hub.sql passed. Recheck migration state before using a different environment.
2. Create a Meta Developer app configured for the Instagram API with Instagram Login. Use an eligible Instagram professional account for private testing; public onboarding may require App Review and business verification.
3. Put these secrets directly in the Vercel project's protected server environment, never in chat or GitHub:
   - INSTAGRAM_APP_ID
   - INSTAGRAM_APP_SECRET
   - INSTAGRAM_REDIRECT_URI=https://www.delsaai.ir/api/crm/instagram/callback
   - INSTAGRAM_WEBHOOK_APP_SECRET
   - INSTAGRAM_WEBHOOK_VERIFY_TOKEN
   - PLATFORM_CREDENTIALS_ENCRYPTION_KEY (existing base64-encoded 32-byte key)
   - SUPABASE_SECRET_KEY or the existing legacy SUPABASE_SERVICE_ROLE_KEY
4. Register the exact Meta redirect URI and webhook callback https://www.delsaai.ir/api/crm/instagram/webhook. Subscribe to messages. Request instagram_business_basic and instagram_business_manage_messages under current official Meta rules.
5. Sign into a valid CIMA subscriber account on the production domain, authorize the test Instagram page and verify the explicit CIMA grant.
6. Send a fresh text DM from a second eligible account. Check exactly one inbound interaction and correct tenant. Replay the signed payload to test idempotence. Disable CIMA permission and verify new DMs are not ingested.
7. Verify token expiry, reconnect, disconnect, invalid webhook signature, subscription expiration, per-tenant isolation, mobile/light/dark UI, and provider App Review eligibility.
8. Implement token-refresh monitoring prior to larger deployment; auto-refresh is not built in this phase.

## Tests and release gates

- node --test tests/cima-inbox.test.mjs tests/channel-hub.test.mjs
- npm run build
- Run supabase/tests/delsa-channel-hub.sql only after the schema has been installed.
- GitHub CI and Vercel previews do not prove a real Meta connection or browser usability.
- No outbound DM automation, historical DM import, media parsing or DorPin message access in this release.
- Existing n8n workflows remain untouched; clone them for future integrations.

## Official references

- https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login
- https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api
- https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api

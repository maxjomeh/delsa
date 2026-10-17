# Sima enrichment and Instagram connection

Installed in Supabase on 2026-10-12:

- `crm-information.sql`: field definitions, typed validation, customer question states, contextual queue and explicit message extraction.
- `crm-information-defaults.sql`: nine base fields for existing active subscribers, including Amirhossein Khamsi; no customer fixtures inserted.
- `crm-instagram.sql`: encrypted token storage in private schema, account-scoped customer identities and server-only intake. Privileged functions live in `private`; public wrappers use security invoker and grant execute only to `service_role`.

Database tests run in transactions and roll back all fixtures. Verified priority, after-purchase eligibility, opt-out, cooldown, Persian digits, source evidence, conflict review, tenant isolation, connector identity routing, duplicate delivery, inaccessible credentials and disconnect enforcement.

## Operational state

The website has **no configured Meta/Instagram app credentials** as of this implementation. No Instagram account has been connected, no real DM has been received and no automatic message has been sent. OAuth and webhook code are prepared; their live behavior still needs verification with a professional test account after Meta setup.

Configure these server-only environment variables directly in Vercel. Never paste secret values in chat or commit them:

| Variable | Purpose |
| --- | --- |
| `INSTAGRAM_APP_ID` | Instagram app ID for Business Login |
| `INSTAGRAM_APP_SECRET` | Instagram app secret for code exchange |
| `INSTAGRAM_REDIRECT_URI` | `https://www.delsaai.ir/api/crm/instagram/callback`; must match Meta's allowed redirect URI exactly |
| `INSTAGRAM_WEBHOOK_APP_SECRET` | Meta app secret used to sign webhook deliveries; explicitly separate from the Instagram token exchange secret |
| `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` | Random verification secret for webhook subscription |

Existing `PLATFORM_CREDENTIALS_ENCRYPTION_KEY` encrypts both OAuth state and access tokens. Existing Supabase integration provides the server secret key. The server-only module is imported exclusively by API routes.

Webhook URL: `https://www.delsaai.ir/api/crm/instagram/webhook`. Subscribe to Instagram `messages`; request `instagram_business_basic` and `instagram_business_manage_messages`. Use a professional test account first; public customer onboarding requires the appropriate Meta review/access level.

OAuth initiation checks session, active CRM entitlement, same origin and callback origin. Callback checks encrypted state, user binding, expiry and subscription again. Tokens never appear in customer-readable rows. Webhooks verify the HMAC over the raw request body before parsing. Account identity, never caller-supplied tenant ID, determines the tenant. Echoes are ignored. Message event IDs are account-scoped and idempotent. Unknown, expired, disconnected and unsubscribed accounts do not create records.

## Current extraction and question behavior

- Explicit statements such as `روز و ماه تولد: ۰۳/۱۵` are extracted on inbound interaction insertion, including future verified webhook intake.
- Values are validated and normalized by field type. Conflicting values do not overwrite the profile; they enter review with source interaction and quoted evidence.
- Free-form inference, transcription, image reading, historical imports, token refresh scheduling and automatic replies are not enabled.
- Queue uses all database records, returns one question per eligible customer and caps results at 500. After asking: global 24-hour cooldown, same-question 30-day cooldown. Deferral: seven days; refusal: until explicitly reset.
- Urgent or complaint-like inbound messages in the last 24 hours suppress profile questions. Existing values, disabled fields, closed profiles and do-not-contact preferences also suppress them.
- Field source/history UI shows the 5,000 most recent states. Existing CRM lists retain their 500-record UI limit. Queue evaluation is independent of those display limits.

Do not enable autonomous sending merely by configuring OAuth. It needs contextual response generation, an audited outbox, delivery receipts, uncertainty handling, channel window checks and separate activation controls. Do not modify original n8n workflows; duplicate any workflow before using it for Sima.

Official API references:

- https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login
- https://developers.facebook.com/documentation/instagram-platform/reference/oauth-authorize
- https://developers.facebook.com/documentation/instagram-platform/reference/access_token
- https://developers.facebook.com/documentation/instagram-platform/webhooks

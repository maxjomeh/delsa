# Zernio → SIMA customer projection (2026-10-19)

This bridge ingests **verified and mapped** Zernio social message events into the correct Delsa CRM tenant.

## What is live in Supabase
- Previous five CRM customers and their dependent information-state records have been deleted on request. Associated stale customer/info-state audit entries were cleared. Nothing in another Delsa product/subscription changed.
- `crm_zernio_contacts` maps `(tenant_id, account_id, participant_id)` to a CRM customer. No automatic merging by name, phone, or username.
- `crm_zernio_process_batch(limit)` is a service-role-only, idempotent and serialized worker. It looks up tenant ownership using the **stored signed-ingress mapping** and processes `conversation.started`, `message.received` and `message.sent`. Delivery receipts and other subscribed event types are acknowledged and marked processed but do not fabricate messages.
- `cron.schedule('sima_zernio_customer_projection','*/2 * * * *',...)` keeps durable intake progressing if a serverless after-response callback is dropped. Cron worker is database-local and sends no messages.
- A projection of 61 pending events created 6 new social CRM contacts and 35 actual CRM interactions in a first observed run; all processed with zero failures. Historic inbox messages from before Zernio connection are *not* present in these webhooks; separate API backfill requires an explicit follow-up.

## HTTP ingestion
The webhook endpoint checks HMAC on raw bytes, validates event ownership and inserts the event id exactly once to `crm_zernio_events`. It sends 2xx before scheduling background processing using Next.js `after()`. The background function performs a single bounded Supabase RPC. Webhook delivery is **at-least-once**, so unique ids prevent duplication.

## Customer experience
The existing customer 360 workspace now projects incoming text into source-backed **rule-based** need categories (price, stock, shipping, purchase, complaint); every need points to a quote and timestamp. The latest inbound message triggers a next-step recommendation. This is **not** LLM semantic inference. Messages are not auto-sent, and no external AI receives private messages.

## Security
Never expose Zernio/Vercel keys to the browser or chat. Identity mapping is private and service-role-only, and the CRM queries use the authenticated tenant. Inbound social identities are not merged across connected accounts. The Webhook cannot register a new profile mapping by itself; the business initiates OAuth and the backend creates it after checking active SIMA subscription. Preserve the `do_not_contact` setting. Browser UI can edit only through the existing RLS restrictions.

## Validation and watchouts
- SQL transaction dry-run processed five source events correctly, then rolled back; live batch processed 61 (0 failed), as observed before production deployment.
- Supabase Cron job is active and its first scheduled runs succeeded.
- CI runs Node customer intelligence/inbox/webhook tests plus `npm run build`.
- After production promotion: send a **new** Instagram DM to a connected business account, verify the new event is queued and then processed, and check the single customer profile's activity and need suggestion. Old `message.read` events should not create conversations.
- Reconnect or move a social account only with its owner's consent.

## History worker egress (2026-11-23)
`app/api/crm/zernio/history/cron/route.js` runs every 2 minutes (pg_cron `sima_zernio_historical_inbox_scan`). Each run used to download the
full JSON payload of up to 3000 events through PostgREST only to learn which (tenant, account) pairs exist. Migration
`20261125_zernio_history_candidates.sql` adds `crm_zernio_history_candidates()` (service role only) which does the same selection inside
the database and returns just the pairs; the route uses it and falls back to the previous query if the function is not installed yet.
Verified on Postgres 16: identical output to the previous selection (including the 3000-event window), about 2000x fewer bytes on synthetic
data. Whether this was the main source of the project's egress is **not** confirmed; check Supabase Usage after applying.

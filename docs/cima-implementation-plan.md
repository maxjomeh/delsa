# CIMA / SIMA — implementation contract and release gates

Updated 2026-10-18. This is the product/system plan, not a claim that future phases work in production.

## Product promise

CIMA is a cross-industry, subscription-gated, tenant-isolated autonomous CRM inside the DELSA dashboard. A human configures policy and handles exceptions; agents and workflows record, classify, prioritize and follow up wherever provider rules and evidence allow. Industry specialization is configuration, not separate siloed CRMs.

Current code lives under components/crm, lib/crm, app/api/crm, and supabase/crm-*.sql. The product catalog has a nonpublished crm service_code. Never expose it to unsubscribed customers merely because a UI module exists.

## Source-of-truth workflow

1. An official channel adapter authenticates the business account, validates signatures, deduplicates provider event IDs, and maps each event to a tenant and channel identity.
2. An intake transaction identifies or creates the CRM customer and stores the immutable source event with timestamp, sender and channel. Do not infer consent from the presence of a phone number.
3. The conversation projector groups events by contact, while preserving the distinction between a recorded outbound event, an actual channel dispatch receipt, and a read receipt. Nothing in a database row alone proves external delivery.
4. An enrichment agent may suggest fields, extracted product interest, assets/vehicle, lead stage or intent with text evidence. Deterministic validation handles field types, duplicates and conflicting claims; contested updates go to review.
5. A rules engine chooses actions (reply suggestion, qualifying question, lead creation, follow-up, price lookup, human handoff, order lookup). It must check customer opt-out, subscriptions, channel permission, provider communication windows, message caps, verified product/price data, and tenant policies.
6. A durable outbox makes sending idempotent. The dispatcher claims one job with a short lease, attempts delivery, and persists the provider receipt. Network timeout or uncertain status is UNKNOWN, not auto-retry. Retry only positively confirmed failures, bounded by policy. Audit every transition.
7. Background tasks are scheduled and executed by an authorised worker. They are not marked completed merely because their due time passed.
8. Analytics measure source coverage, lead conversion, unanswered contacts, delivery outcomes, SLA, workload removed and automation exceptions.

## Core data domains

Existing: profiles, subscriptions, crm_settings, crm_customers, crm_interactions, crm_leads, crm_orders, crm_tasks, crm_events, crm_field_definitions, crm_information_states, CRM Instagram connections/identities.

Next, additive only:
- organizations/workspaces and membership roles, migrating from current tenant=user id without cross-tenant leakage;
- canonical contact identities per channel and actual conversation/message model, supporting provider receipts and multiple accounts;
- business-specific products, interest tags, quotes, order line items, assets (including truck/fleet where appropriate), satisfaction and loyalty;
- outbound policy, templates, per-tenant channel grants, message outbox, delivery attempts and human review;
- industry packs (retail, wholesale/auto parts, services, fashion, property, education), custom fields and question priority;
- operational metrics, message search, pagination, exports, retention and privacy controls.

Maintain shared canonical product/customer/order identifiers so Site Builder, APU and DorPin can integrate without copying core customer data or reusing each other's credentials.

## Release gates

### Phase A — tenant-safe working CRM / in progress

- Subscription-gated CIMA navigation and per-tenant RLS (already present).
- Customer records, interactions, leads, orders, tasks, custom fields and question queue (already present).
- Unified inbox grouping, search, inferred needs-response, manual event logging (this branch).
- Limit: inbox currently projects up to 500 loaded contacts/interactions. Needs server pagination and per-channel authoritative unread counters before scaling.
- A manual outbound entry means "logged after sending elsewhere". Do not label this Send, or pretend it dispatched a message.

Acceptance: unit tests pass; CRM active tenants can create/read only their records; a tenant without a subscription cannot write; no sensitive token in client responses; mobile/light/dark usable.

### Phase B — official Instagram ingestion

- Configure approved Meta professional app and redirect/webhook signing secrets in Vercel only.
- Complete app review and test with one professional business account.
- Verify OAuth session binding, account ownership, token encryption, webhook HMAC, idempotency and reconnect/expiry.
- Intake actual DMs into CRM; do not change the existing n8n workflows, duplicate before integrating.
- Build central DELSA Channel Hub for one business connection with explicit CIMA/DorPin capability grants.

Acceptance: one real test DM appears once, correctly scoped, with source ID; multi-business tests demonstrate no cross-tenant visibility; revoked access halts intake.

### Phase C — reliable outbound automation

- Add durable outbox, task claims, leases, provider delivery receipts, UNKNOWN timeout state, bounded retries, audit and dead-letter queue.
- Check official channel messaging windows and explicit permissions. Respect opt-outs, urgent complaint handoff and rate limits.
- Only after proof of delivery and abuse safeguards: configurable autonomous response/reengagement, one question at a time, human approval where confidence is inadequate.
- AI returns validated structured intents; deterministic code executes actions and prevents duplicate sends. Never invent prices, inventory or order status.

Acceptance: duplicated inbound webhook and retried worker never send twice; opt-out and purchase cancel pending followups; timeout never blindly resends; no message is sent outside the provider's allowed window; all transitions auditable.

### Phase D — full productization

- Industry-specific intake and 17-tab spreadsheet feature parity where still relevant: customer/contact methods, product/vehicle preference, leads, interactions, follow-ups, deals, assets, orders/items, quality control, reports.
- Customer segmentation, cohort/retention, win-back, VIP, targeted campaigns with consent checks, satisfaction and loyalty.
- Omnichannel adapters (WhatsApp, Telegram, Bale, Eitaa, Rubika, Soroush and site) only when supported with valid official integrations.
- Dynamic integrations with shared DELSA APU / DorPin / Site Builder catalog, orders and business-level product permissions.
- Workspace memberships, per-seat roles, billing/metering, GDPR/local privacy workflows as applicable, date/currency/RTL/LTR localization for Persian, Arabic, Turkish and English.

Acceptance: operational end-to-end test with paying pilot business, failure recovery, reproducible security audit, monitored costs, verified provider permissions and successful recovery/backups.

## Current caveats / blocking dependencies

- No Instagram account or live channel credential was confirmed in the reviewed Supabase dataset; current OAuth/webhook code is preparatory only.
- No real dispatch worker/outbox is running. Even when a task is auto-created, it must NOT be represented as sent.
- Production Vercel project metadata/deployments were not available to the reviewer due to a scoped 403; confirm environment and domain separately.
- Cross-product data ownership / workspace model must be designed before onboarding organizations with multiple staff.
- Security advisors report accessible privileged functions that require a purpose-by-purpose privilege review, and leaked-password protection is disabled.

## Testing discipline

- Pure projection: node --test tests/cima-inbox.test.mjs
- Existing: node --test supabase/tests/crm-information.test.cjs supabase/tests/crm-instagram.test.cjs supabase/tests/crm-ui.test.cjs
- Integration: transactional SQL tests under supabase/tests; always roll back fixtures; test subscription, RLS, dedupe, privacy, optout and concurrency.
- Deployment: PR preview first, smoke-test mobile/light/dark, protected sign-in and actual subscriber state; merge deliberately, then verify Production.

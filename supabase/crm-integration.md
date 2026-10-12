# Sima V1 integration contract

Production installation of crm-workspace.sql is pending explicit approval. The production UI remains on the access placeholder until installation and tests succeed.

`crm_ingest_message(p_customer jsonb, p_event jsonb)` accepts an authenticated customer's context. It derives tenant_id from auth.uid(), requires an active CRM subscription, and never accepts a tenant override. Anonymous callers cannot execute it. The eventual server connector must obtain a securely scoped customer context; do not give n8n the site's service-role key or customer passwords.

Customer: name (optional), normalized phone and/or instagram identity. Event: channel, event_id (required stable source ID), body, occurred_at (optional ISO timestamp). Each source event is processed at most once in this database transaction. Include the connected channel account ID in event_id when a tenant has several channel accounts.

Inbound messages cancel only automatic pending followups for offers preceding their timestamp. Outbound offer interactions create a task and preserve the rule snapshot. Paid orders and contact optout cancel automatic pending followups. Tasks are not delivery receipts. No channel sender or n8n executor is connected yet, and the UI says this explicitly. Do not automatically mark a scheduled task completed because its due time passed.

Next integration phase: tenant-bound credentials, transactional task claim, dispatch receipt/outbox, bounded retries only for confirmed failures, and an unknown-delivery state for timeouts. Resolve this before enabling unattended sends. Existing source workflows must be duplicated; never modify originals.

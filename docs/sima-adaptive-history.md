# SIMA adaptive CRM phase: history, field proposals and visual refresh

Production rollout checklist for branch `feat/sima-ml-backfill-dynamic-fields-20261019`.

## Pre-connection Instagram DM history
Official Zernio documentation supports Instagram/Facebook historical replay, capped at 500 conversations per connected account and 500 most-recent messages per conversation (not absolute full lifetime history). Historic messages produce no webhooks; read-only `GET /v1/inbox/conversations` and `GET /v1/inbox/conversations/{id}/messages` must be cursor-scanned separately. Source: https://docs.zernio.com/changelog .

A tenant-authenticated `/api/crm/zernio/history` POST fetches one page (a conversation listing item or 100 messages) per invocation, stores an opaque next cursor, and queues minimal message events under the caller's mapped Zernio profile. Each page is idempotent by account + platform message ID, including against live webhook arrivals. The user's Connections panel starts/resumes this job in bounded 20-page batches and shows progress. This implementation does NOT claim to have already fetched pre-connect messages.

## Extracted profile fields
- `crm_learning_suggestions` isolates candidates by tenant and customer; evidence and confidence are retained.
- `crm_learning_scan_batch` scheduled every 10 minutes detects strong self-disclosed phone number candidates and proposes truck-model field after >=3 distinct customers were asked about it.
- Reviewer dashboard displays candidate values and source text, and owner can approve/reject. Approved data flows through `crm_review_learning_suggestion` which checks tenant ownership, active CRM subscription, and conflicts before applying to `crm_customers` or `crm_field_definitions`.
- A lightweight online Bayesian calibrator adjusts confidence on subsequent scans using same-tenant accepted/rejected examples. It is a statistical learner, NOT deep natural language understanding, and does not imply user intent or personality.
- Never merge Instagram identities on matching names or inferred phone numbers; preserve account+participant identifiers and evidence.
- Customer profile images are presented only when a valid HTTPS `participantPicture` is provided. Source image URLs may expire; initials remain fallback.
- No unauthorized auto-replies or auto-sending; low-confidence evidence is review-only.

## Known remaining product work
- Broaden extraction beyond the first phone/truck domains with an ML model and human-labelled examples; evaluate on a held-out set by field and industry before auto-apply. Protect sensitive fields, avoid guesswork, and prioritize high precision.
- Make historical backfill scalable without user leaving the browser open by adding a secure durable background puller with tenant-scoped provider read credentials and backoff.
- Sync earlier-than-500 Instagram messages is not possible through Zernio's replay limit. Message media files also require separate safe media storage for long-term access.
- Perform end-to-end authorized live UI smoke testing for account, selected customer, historical sync progress, and light/dark responsive layouts.

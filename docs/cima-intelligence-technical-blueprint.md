# CIMA Intelligence — Technical Blueprint v1.0

Delsa AI / SIMA | 19 October 2026 | Design baseline; not a statement that these future capabilities are deployed.

## 0. Authority, provenance, and decision log

This plan operationalizes the user's Persian handoff, "CIMA Intelligence — سند جامع انتقال پروژه". Explicit product requirements outrank prior assistant ideas. The following are requirements: reliable/grounded replies; the business owner's operational Human Inbox; real sending from that inbox; retaining human corrections as supervised learning candidates; no compulsory 100% automation; gradually increasing autonomy only after independent evaluation; cross-industry dynamic CRM; historical messages and customer memory. The 12 engines, choice of framework, exact confidence thresholds, specific statistical targets, and pricing are recommendations only.

**Non-negotiable design principle:** CIMA SHOULD EARN THE RIGHT TO AUTOMATE. A high model self-reported probability is not evidence. Unknown/unverified/high-risk cases must be routed to a human.

No send, auto-reply, tool operation with external side-effects, model activation, or production deployment is authorized by this blueprint alone.

## 1. Live-system audit (read-only, 2026-10-19)

Production at the time of the audit: delsaai.ir / www.delsaai.ir, Vercel deployment dpl_G8z9w1EpLCwqy3hoEqJCuCV79iWs, READY, SHA a39d662200d3e0a4ca48839767be3d83028b09dd (fix/sima-dashboard-visibility-20261019). The later fix branch commit 6126e628b2be648b0f6cdbf85e57e29fce306e83 contains additional layout and tests but is NOT confirmed deployed.

Database project ujsflbpseapemogybrgy: 504 customers, 2,632 CRM interactions, 504 Zernio social identities, 2 connected Zernio profiles, 2 completed history jobs, 0 history-job failures or running jobs, 0 pending/failed Zernio events, 21 CRM field definitions, 4 learning suggestions, 0 leads, 0 orders, 0 tasks (read-only counts at audit time). All listed CRM public tables have RLS enabled. RLS existence is not a penetration-test result.

### Current working foundations (verified in code/schema)

- Authenticated/subscription-gated SIMA workspace and separate tenant_id in CRM tables.
- Zernio profile provisioning, webhook HMAC validation, durable event capture, deduplication, tenant/account/participant identity mapping; server-side historical inbox importer and scheduled catch-up.
- Customer profile, custom fields, activity history and evidence-backed *rule-based* needs.
- Customer conversation grouping and inbox UI, manually recorded inbound/outbound interactions.
- Field discovery from the business's own messages using Persian normalization, TF-IDF/cosine clustering and adjacent Q&A; explicit phone extraction. Existing information-state review queue.
- Production-only Zernio and historical cron environment variable names are configured in Vercel; values were neither read nor revealed.

### Material gaps and contradictions (verify before coding)

- components/crm/SimaInbox.js explicitly logs a manual outbound interaction AFTER confirming it was sent elsewhere. It does NOT dispatch a real message. A functional send composer/outbox/provider receipt is absent.
- lib/crm/inbox.mjs computes "needs response" from recent rows; it is not an authoritative per-channel, versioned conversation/reader state.
- app/api/crm/intelligence/route.js calls learn() and writes certain deduced phones directly to crm_customers when blank; this conflicts with evidence-first, conflict-aware supervision, unless a strict, measured exception policy is created. FIRST SAFETY PATCH: stop automatic application or gate it behind the approved validation policy while preserving evidence and existing user data.
- The same intelligence route can directly add inferred learned field definitions. Move novel schemas into a reviewable registry; keep existing saved definitions intact.
- TF-IDF clustering is useful but is neither semantic LLM understanding nor a trained, independently evaluated supervised classifier.
- No production API key for a general LLM is visible by name in the listed Vercel envs. Model-service and provider permissions must be verified and set through approved channels, not assumed.
- The inbox/client data projections still have limited windows in several places; the inbox says up to 500 loaded interactions/customers. Build real server cursor paging and conversation ID indexing.
- Historical replay limits and access differ by platform. For Zernio's Instagram/Facebook pre-connect replay (docs checked 2026-10-19), up to 500 conversations/account and the newest 500 messages per conversation may be available. Replayed messages emit no webhooks and can arrive later; resweep. Do not claim lifetime completeness.
- Customer data and message ingestion do not prove model quality, actual business outcomes, or readiness for autonomous replies.
- The connected n8n instance/workflows, live send permission, legal channel messaging windows, historical data retention/privacy configuration, and end-to-end mobile accessibility were not independently audited here.

## 2. PRD and users

### Product positioning
A multi-tenant cross-industry **learning business agent**, not a generic chatbot. Product engines: connected-channel communications; evidence-based customer memory; business knowledge; dynamic CRM; human-supervised responses; controlled business actions; continuously evaluated improvement.

### Core personas and must-have user stories
- Business owner: "I see every unanswered/high-risk conversation in one human-review queue, understand WHY the AI stopped, inspect original messages and evidence, edit or replace a draft, and send a real reply from SIMA."
- Business owner: "I approve a reusable knowledge rule once, instead of correcting the same gap repeatedly."
- Operator: "While drafting, if the customer sends a new message, my draft is flagged stale and no simultaneous auto-reply goes out."
- Customer: "My messages are recognized across authorized channel accounts without mistaken merging, and I receive accurate responses respecting communication preferences."
- Business owner: "New profile fields are suggested from recurring questions, backfilled to all relevant customers with traceable quotes, not invented."
- Administrator: "I choose autonomy policy per business/domain and can pause, audit, undo, or restrict any automation."
- QA reviewer: "I compare model/prompt versions on held-out real-world examples and promote them only after passing safety and accuracy gates."
- Operations owner: "Channel outages do not lose messages, silently retry uncertain sends, or cross tenant boundaries."

### Functional acceptance statements
- A human can send from the appropriate connected account and see provider accepted/rejected/unknown status, without incorrectly claiming that a provider acknowledgment means recipient read.
- For a low-confidence/high-risk reply, no external message is sent; a durable, actionable review task with source context appears.
- Each extracted fact has tenant, customer, source message and timestamp, verification status, confidence, and conflict history.
- Each learned field has business-scoped label/type/validation, duplicates detection, proposed extraction, and approval/rollback.
- All scheduled automation is opt-in, policy-checked and cancelable by a fresh message, completed purchase, or opt-out.

### Nonfunctional requirements
Tenant isolation by design; fault recovery; no secret leakage to client; reasonable RTL mobile/desktop, dark/light themes, keyboard access; bounded API use/cost; source and decision provenance; retention/deletion; readable audit; graceful degradation on provider and model outages.

## 3. Proposed runtime architecture

    Zernio / Official Channels / Website / Email / future adapters
      -> Verify signature + tenant/account ownership + normalize + idempotency
      -> Durable Inbox Event / Canonical Message / Conversation projector
      -> Intent + entity + language + risk classification
      -> Customer Memory + Business KB + live tools / source citations
      -> Candidate answer(s) with structured claims and citations
      -> Evidence & Policy Gates + calibrated risk scores
            -> human_review_queue -> Human Inbox -> Manual send -> Outcome
            -> (eligible only) authorized outbox -> dispatch -> provider receipt
      -> factual feedback + evaluation candidates -> test set
      -> offline evaluation -> approval -> versioned promotion/rollback

Separately:
- Historical sync is a durable cursor/lease worker with backoff, checksums, resweeps and per-channel caps; never blocks user requests.
- CRMs field discovery reads existing normalized interactions, creates proposed schema and candidate values, then validates and backfills in tenant-scoped jobs.
- A knowledge ingestion worker versions approved product specs, prices, policies, documents and FAQs, with deletion propagation.

### Technology choices (proposals, not lock-in)
Reuse **Next.js/Vercel** for the UI, authenticated APIs and short request handlers; **Supabase PostgreSQL** as source of truth with tenant-scoped RLS; **Supabase Storage** for approved documents; Postgres FTS + pgvector for a hybrid search index if benchmarks justify embeddings; durable workers for historical imports, knowledge indexing, classification and outbox. Keep **n8n** for external adapters, not as the exclusive reasoning/learning state machine. Use pluggable server-side LLM SDK; consider OpenAI Agents SDK or LangGraph only after measuring their advantages over simpler orchestration. Use scikit-learn for tenant-safe baseline classifiers/calibration; stronger models only if evaluation demonstrates uplift. Optional tracing via Langfuse or equivalent after privacy review.

Important: tools run behind server-side allowlists/policies, never because model text commands them to execute.

## 4. Canonical data model and migration contract

**Additive migration strategy.** Do NOT drop existing crm_* tables or move production customer IDs in one cutover. Use new tenant-scoped tables, dual-read or dual-write only temporarily and observably, backfill with cursor checkpoints, verify referential counts and then gradually route the UI to canonical data. Existing profiles/tenant_id design may evolve into organizations + memberships without weakening isolation.

### A. Identity and messaging
- sima_tenants (future org mapping), sima_memberships (role and permissions).
- sima_channel_accounts: tenant_id, provider, account_id, capabilities, oauth status, token reference, expiry; unique(tenant_id,provider,account_id).
- sima_customer_identities: tenant_id, customer_id, channel_account_id, provider_user_id, verified_at, confidence, merge_state; unique(tenant_id,channel_account_id,provider_user_id). Never merge on same display name/phone alone.
- sima_conversations: tenant_id, id, channel_account_id, provider_conversation_id, customer_id, version, state, last_customer_message_at, last_business_message_at, last_read_at, review_claim; unique(tenant_id,channel_account_id,provider_conversation_id).
- sima_messages: tenant_id, conversation_id, provider_message_id, direction, body, attachments, created_at, received_at, channel metadata, delivery status, raw_event_id; unique per account and provider message ID. Never equate a manually logged interaction with an actual sent message.
- sima_inbound_events / dedup receipts: provider webhook event_id, hashed/raw validated payload, processing state, retries, errors; stay compatible with crm_zernio_events.

### B. Facts, fields and memory
- sima_fact_claims: tenant_id, customer_id, field_key, typed_value, source_message_id, evidence_quote, observed_at, valid_from, valid_until, confidence, verification_status, sensitivity, superseded_by; immutable or append-only evidence.
- sima_field_proposals: tenant, proposed key/label/type/validators, support_count, business-specific sample IDs, duplicate schema matches, status and approver.
- sima_field_definitions: evolve existing crm_field_definitions rather than cloning; version constraints and localization, include industry pack as a source.
- sima_field_values: tenant, customer, definition, typed value, verified status, source fact IDs, revision and human override. Materialized read model may project into current crm_customers.custom_fields for compatibility.
- sima_memory_episodes: customer and conversation; safe summary with source ids, freshness and expiry.
- sima_customer_preferences / contact_policy: consent scope, do_not_contact, channel quiet hours, declared preferences; avoid hidden cross-tenant learning.

### C. Knowledge, model and review
- sima_knowledge_sources, sima_knowledge_revisions, sima_knowledge_chunks and retrieval evidence; status approved/draft/expired/revoked.
- sima_response_candidates: answer, source citations, model+prompt versions, conversation_version, claim checks, freshness, risk, confidence/calibration version.
- sima_human_review_cases: tenant_id, conversation_id, reason codes, last_message_id, candidate_id, due_at, owner_id, priority, state, version. One unresolved actionable review case per conversation/topic policy.
- sima_review_events: actor, old/new state, edits, rejection reason, answer_diff, approval and timestamps.
- sima_message_outbox, sima_delivery_attempts: tenant/account/conversation/draft and idempotency key, lease, provider_receipt, UNKNOWN timeout status, terminal failure and sent audit.
- sima_learning_candidates, sima_feedback, sima_training_examples, sima_evaluation_cases, sima_evaluation_runs, sima_model_promotions.
- sima_ai_runs, sima_action_approvals, sima_tool_audits, sima_incidents and sima_cost_usage.

### Security constraints to enforce in SQL
Every child references its parent with tenant_id as part of a composite foreign key; tenant_id is never inferred from untrusted body. RLS for authenticated read/write based on effective organization membership and explicit permission; service-role jobs must validate the tenant/account mapping before any operation. Unique provider keys and immutable audit timestamps; index conversations(tenant_id, updated_at DESC), review queue(tenant_id,state,priority,due_at), messages(tenant_id,conversation_id,created_at). Auditable soft-revocation, lawful deletion requests, PII minimization.

Conceptual DDL skeleton (not a migration for immediate production):

    CREATE TABLE sima_human_review_cases(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      conversation_id uuid NOT NULL,
      candidate_id uuid,
      reason_codes text[] NOT NULL DEFAULT '{}',
      state text NOT NULL CHECK (state IN (
        'new','analyzing','awaiting_human','human_assigned',
        'human_drafting','sending','sent','resolved','reopened','send_failed')),
      priority integer NOT NULL DEFAULT 50,
      conversation_version bigint NOT NULL,
      assignee_id uuid,
      opened_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(tenant_id,id),
      FOREIGN KEY(tenant_id,conversation_id)
        REFERENCES sima_conversations(tenant_id,id)
    );
    -- Add tenant-scoped RLS/grants and partial unique index on open states
    -- after creating referenced tables and reviewing migration order.

Status transitions must run through restricted transaction functions or strongly guarded server APIs; no client can directly set 'sent'.

## 5. Conversation and learning state machines

Conversation flow:
- new -> analyzing -> [awaiting_human | eligible_for_auto_reply].
- awaiting_human -> human_assigned -> human_drafting -> sending -> [sent | send_failed | unknown_delivery].
- sent -> resolved (only on actual policy/outcome), resolved -> reopened on fresh inbound.
- auto-eligible -> sending only after a second policy/version check; never immediately from a self-declared model score.
- On fresh inbound: increment conversation.version; stale candidate/draft marked needs_recheck; revoke an unsent auto approval; enqueue a fresh review if needed.
- A human-owned conversation cannot concurrently run an autonomous sender for the same scope.
- No sending from "note recorded" state. On timeout, mark unknown_delivery and reconcile provider state before any retry, never blindly resend.

Independent learning state:
learning_candidate -> pending_validation -> [approved_for_knowledge | rejected] -> under_evaluation -> eligible_for_auto_reply -> promoted/rolled_back. Resolution of a customer ticket does NOT promote its human answer into universal business policy.

Optimistic transaction guard for human send: (tenant_id, conversation_id, expected_version, connected_account, idempotency_key, permissions, valid window, existing send claim). Concurrent requests get 409 conflict or return the original receipt. Provider idempotency is used if available and reconciled where unavailable.

## 6. Confidence & Risk Engine — eligibility before score

Never accept "I am 97% confident" as probability. Build model-independent evidence features and calibrate with labeled outcomes under controlled validation:

Inputs:
1. Retrieved evidence coverage and source trust (approved doc/version, verified catalog, live order/stock call).
2. Entailment/contradiction between generated claims and cited sources.
3. Input ambiguity, requested domain, user language, identity certainty, conversation freshness.
4. Tool execution result, deadline/expiry, recent supplier/price changes.
5. Historical correctness for this intent/domain/model version on separate labeled examples.
6. Channel messaging windows, opt-out, permissions and high-risk action classifications.

First apply HARD GATES: inactive account; no appropriate consent or send window; do_not_contact; unverified price, inventory or part compatibility; refund/discount/credit commitments; identity mismatch; stale/contradictory sources; sensitive matter; provider outage; unknown send status; newly received message; model/policy version not approved => no auto-send regardless of numeric score.

For eligible low-risk topics only, learn a calibrated P(correct | features, intent, model_version) with Platt scaling or isotonic where data volume allows; measure reliability diagrams/ECE, selective risk, and upper confidence bound on bad automation events. Calibration dataset must be recent, held out by conversation/customer and time, stratified by scenario and language. For scarce labels do not pretend to have calibrated scores: show "unvalidated" and route to human.

Recommended initial behavior: Observer or Copilot (draft-only), all autonomous sending disabled. A proposed 95/100 example is NOT an approved threshold. Thresholds and per-domain exceptions require user review and offline validation.

Output contract:

    {
      "decision": "human_review",
      "candidateId": "...",
      "confidence": null,
      "calibrationStatus": "insufficient_labeled_data",
      "riskLevel": "high",
      "hardBlocks": ["UNVERIFIED_STOCK"],
      "missingEvidence": ["warehouse_lookup"],
      "conversationVersion": 38,
      "policyVersion": "sima-policy-v1"
    }

For a combined safe+unsafe question, do not silently answer the unsafe part; propose safe partial information with clear uncertainty only when channel policy allows, otherwise human review.

## 7. AI + ML components: practical training loop

### The useful minimum, NOT fake "self-learning"
- Rule engine + TF-IDF currently extracts repeated operator questions; keep as transparent baseline, log coverage and errors.
- Add multilingual Persian normalization and a structured intent/entity extractor outputting typed JSON + evidence spans, with abstain/unknown support.
- Short/long customer memory: facts are extracted to pending claims, updated after verification; an LLM summary is never the sole durable source.
- Knowledge retrieval: hybrid FTS + embeddings with tenant and ACL filters; include document version, freshness and source ID; exact live tools for price, stock, identity and orders.
- Agent actions: allowlisted read-only product lookup first. Writes/purchases/sends require explicit permissions and/or approval.

### Learning from humans
Capture (input customer question, tenant-specific retrieved context, AI draft, manager edited/sent answer, outcome, human feedback code, source version and model/prompt version). Distinguish "correct reply to THIS customer" from "reusable policy". Route generalizable answers to a separate knowledge-validation queue. Deduplicate frequent knowledge gaps. Redact or segment PII before training, do not pool private tenants without explicit lawful opt-in, and do not treat one manager answer as universal truth.

Small supervised models could handle intent classification, customer-field extraction, routing and score calibration before considering LLM fine-tuning. Split by customer/thread and time to prevent leakage. Maintain a challenge set of ambiguous, out-of-domain, contradictory, outdated, adversarial, multimodal and colloquial Persian cases. Promotion requires comparison against current version and rollback support.

### Prevent false learning
Repeated wrong answers are not positive labels. A discount for one order does not become a general discount policy; a truck mentioned in a quote does not prove the customer owns the truck. A phone mentioned in a message may belong to a third party. Fact claims must retain perspective (self/other/unknown), source, uncertainty, evidence and supersession.

## 8. Business knowledge and memory architecture

Six logical memory types:
- conversation: current open dialogue state and turn references;
- episodic: past issues, outcomes, promises with source messages;
- semantic: stable verified customer facts and preferences;
- business: the business's approved products, policies, FAQ and technical catalogs;
- procedural: approved workflow/action recipes with permissions and versions;
- temporal: volatile price, inventory, shipping ETA and promotions, each with TTL and data-owner reference.

Retrieval pipeline: precise tenant/account/customer check -> query intent -> structured DB for live facts -> permission-filtered FTS/vector retrieval -> rerank -> factual claim validation -> explain missing evidence. Strong answer grounding: expose relevant source excerpts and source timestamps to the human; reject missing/expired/contradictory claims.

Product catalog, inventory and order data from APU, Durpin or Site Builder remain behind explicit per-tenant capability grants; a CRM connector must not use another module's credentials merely because they share a Delsa account.

## 9. Dynamic CRM from conversation patterns

Pipeline: historical + live messages -> normalize -> candidate entities/field labels -> cluster/redundancy check -> field type/meaning/schema review -> activate versioned field -> tenant-wide per-customer extraction with evidence -> conflict/quality review -> indexed typed values + change history.

Examples:
- Auto parts: truck brand/model, part code, axle, dimension, delivery city, vehicle ownership or third-party inquiry. Distinguish a quoted model from confirmed ownership.
- Fashion: clothing size, fit, preferred brand, color, shipping preference.
- Services: required service, appointment preferences, contract constraints.
- Generic across sectors: declared contact number, language, city, purchase intent, customer consent/preferences.

A field definition is a distinct operation from filling that field. Newly proposed fields (e.g. "مدل کشنده") should require semantic consolidation with existing equivalent field labels and owner approval initially. A new field triggers reprocessing ALL available relevant customers via a throttled background job, not only conversations after activation. Preserve existing confirmed user values and show conflicts side by side. Do not silently store sensitive protected inferences.

Active information gathering: ask only when relevant to current support/sale context and allowed by policy; never interrupt complaint/hardship workflows to request optional CRM profile data. Prefer asking once, respecting previous replies/refusals.

## 10. Human Inbox — the primary interface

Desktop RTL three-panel application and stacked mobile:
- Right: searchable queue of new, awaiting owner, high-risk, stale draft, send failed; SLA, urgency, channel and confidence status filters.
- Center: live conversation timeline with source/attachment support, quote and delivery receipts, thread version marker and updated indicator; composer with Write / Replace AI draft / Approve / Send; explicit send confirmation where required.
- Left: CIMA review: extracted intent, customer 360, verified facts, knowledge excerpts with citation, missing sources, block codes, proposed answer, risk and confidence, and quick knowledge-gap action.

Separate dashboard screens:
1. "نیازمند پاسخ شما" with actionable queue, assignment and wait metrics.
2. "مشتریان" with historical messages, social identity/avatar, validated facts, pending factual claims, dynamic field grid and provenance.
3. "دانش کسب‌وکار" with approved catalog/policies, imports, expiry and version timeline.
4. "چیزهایی که سیما نمی‌داند" showing clustered knowledge gaps, volume, risk, owner resolution, before/after deflection rate.
5. "آزمایشگاه هوشمندی" with benchmark coverage, held-out evaluations, calibration charts, per-domain model/prompt versions, promote/rollback.
6. "گزارش عملکرد" with quality, cost, latency, human workload, unsupported requests, channels and real order/resolution outcomes.
7. "تنظیمات استقلال" with Observer/Copilot/Autopilot/limited Autonomous, per-domain permissions, manual kill switch, cost caps, message windows and notification policy.

UI safeguards: buttons indicate **real sent** versus **internal note only**; don't promise delivery on API-accepted responses; show staleness when a new inbound arrives during composition; never erase the human's draft without saving it. Handle thousands of items with server pagination and virtualized panels; do not IntersectionObserver-hide large dashboard sections. Test zoom 100–125%, dark/light, RTL, mobile and keyboard.

## 11. API contracts (proposed additive, under /api/crm/v2)

Auth: protected session with has_active_crm, explicit tenant/account ownership, CSRF/origin guard for browser writes, rate limits, role permissions. No client-supplied tenant_id accepted as authority; all writes audited. All list endpoints support stable opaque cursor and bounded limit.

- GET /conversations?state=&channel=&cursor=&limit= : thread summary, latest message, unread and review state; cursor.
- GET /conversations/{id}/messages?cursor=&limit= : canonical message timeline with provider status and attachment metadata.
- POST /conversations/{id}/drafts : expectedConversationVersion, topic, instructions; returns candidate, source IDs and risk decision; does NOT send.
- POST /conversations/{id}/send : expectedConversationVersion, selectedConnectedAccount, idempotencyKey, content/draftId, optional humanApprovalId; returns outboxId and accepted/unknown status. Never mark SENT before provider acknowledgment.
- POST /reviews/{id}/claim : optimistic claim/version and assignee.
- POST /reviews/{id}/resolve : draft edits, decisions, gap category, desired knowledge candidate, expectedVersion.
- GET /review-queue?status=&risk=&cursor= : durable actionable queue.
- POST /knowledge/sources + POST /knowledge/revisions/{id}/approve : validated knowledge upload/approval and versioning.
- GET /customers/{id}/facts and POST /facts/{id}/review : source-backed updates and conflict reconciliation.
- GET /field-proposals and POST /field-proposals/{id}/review : field approval and tenant-safe reindex scheduling.
- GET /quality/evaluations and POST /quality/promotions/{id}/approve : read-only metrics and controlled version release.
- GET /policies and PATCH /policies : approved tenant autonomy settings, default auto-reply disabled.

Response error semantics: 400 invalid payload; 401 unauthenticated; 403 entitlement/permission; 404 when tenant-hidden resource; 409 stale conversation/locked review/duplicate conflict; 422 risk or policy ineligible; 429 rate cap; 503 provider unavailable; UNKNOWN send is a modeled state, never "success".

## 12. Quality gates, evaluation and release

Evaluation domains:
- Response: supported factual correctness, source citation validity, hallucination, resolution outcome.
- Confidence: ECE/reliability curves, selective risk, false-auto-send, abstention quality, misrouting.
- Human ops: review backlog/SLA, corrected drafts, duplicate sends, provider unknown status.
- Learning: knowledge-gap closure, field extraction precision, verified human agreement, holdout improvements and regression.
- Commercial: measured order completion/conversion, complaint recurrence, support load, cost per resolved conversation.
- Reliability: webhook loss, historical completeness *within provider scope*, outbox duplicate rate, recovery times, retries and tenancy violations.

No numerical acceptance thresholds are approved yet. For each proposed threshold provide a prospective holdout size, an error type budget, confidence interval and measured baseline; a claim like ">95% accuracy" is invalid without labeled independent samples. High-risk intents should require human approval regardless of average model precision. User approves any increase in automatic send scope after an offline plus shadow evaluation.

Testing pyramid:
1. Pure unit tests for Persian normalization, entity perspective, TF-IDF candidate grouping, score gates and confidence calibration.
2. Postgres RLS and cross-tenant foreign-key tests, idempotency, audit append-only, simultaneous reviews.
3. Contract tests for Zernio auth/revoke, rate limiting, 24h window/tag policy, provider send receipts and UNKNOWN retries, old-history caps.
4. Model red-team cases: prompt injection from untrusted chat/attachments, privacy requests, out-of-scope, conflicts, wrong vehicle parts, outdated price/stock, duplicate events.
5. End-to-end browser tests at 100%, 125%, desktop, mobile, dark/light with deep customer history and high row volume.
6. Pilot in Observer -> Copilot, collecting labels without external model sending.
7. Canary/feature flags and documented rollback/kill switch. No model version auto-promotes from anecdotal good results.

## 13. Security, legal boundaries, and cost

- Separation of tenants on every query and tool; test forged tenant IDs, leaked identifiers and mixed conversation IDs.
- Provider tokens and signing secrets only in server-side vault; rotate compromised tokens, never surface in logs.
- Respect Meta/Zernio channel messaging windows and tags; human-agent tag is not blanket permission for proactive marketing; check live policies before implementation.
- Treat all user DM text, URLs, documents and imported KB material as *untrusted data*, not system instructions.
- Restrict prompts to minimal tenant-scoped evidence; prevent cross-tenant vector retrieval and inadvertent training on private content; implement right-to-access/deletion/retention and configurable consent.
- Logging includes reasons and hashes, not unrestricted PII; redacted traces and customer data export per policy.
- Per-tenant budgets for LLM/embedding/storage/worker/API calls, cache public approved knowledge safely, no shared private embedding cache, tune models by measured routing needs.
- Failure modes: model down -> human queue; knowledge missing -> human queue; Zernio down -> pending local events; uncertain delivery -> reconciliation; worker dead -> lease expiry and limited retries.

## 14. Milestones and measurable acceptance

### Phase 0 — Safety & Observability (first)
- Freeze unsupervised phone overwrites and automatic creation of unreviewed field definitions; use evidence/review status instead.
- Verify actual tenant/account/role permissions, OAuth, Zernio webhook mapping and message retention.
- Map present tables to canonical planned schemas; add regression/security test coverage.
- Acceptance: no existing customer data deleted; no unreviewed fact overwrites; verified cross-tenant denial; zero unauthorized external sends (by design).

### Phase 1 — Canonical Inbound + Reliable History
- Canonical conversation/message projection, pagination, dedup by provider account/message ID, receipts, per-platform historical cursor/import coverage and status.
- Acceptance: single webhook produces one canonical message; repeated/reordered webhook unchanged; correct account/customer; resuming old imports never duplicates.

### Phase 2 — Operational Human Inbox (critical differentiator)
- Tenant-safe three-panel review cases, decision reasons, stale draft/version conflict, real provider send via durable outbox, provider receipt and UNKNOWN handling.
- Acceptance: manager opens a low-confidence DM, edits/writes a response, sends from the correct connected account, sees acknowledgment; double-click/network retry never produces an unverified second send; inbound while drafting blocks stale automatic sends.
- Keep ALL autonomous sending disabled.

### Phase 3 — Knowledge + Customer Memory + Dynamic Fields
- Approved KB with citations/version/TTL, exact price/stock integration, typed facts with evidence, field proposals/backfill for all current customers.
- Acceptance: every answered claim points to authorized current evidence; new field reprocesses historical customers and never overwrites verified facts; privacy and consent tested.

### Phase 4 — Drafting Intelligence + Evaluation Lab
- LLM-generated draft only, risk rules, confidence assessment, knowledge gaps, feedback dataset, holdout benchmark, failure taxonomies, model/prompt versioning.
- Acceptance: full trace to sources and policy decisions; shadow metrics monitored; no autonomous external send.

### Phase 5 — Controlled Autopilot
- Approved intent/domain-specific low-risk sending, calibrated confidence, per-tenant policies, canary, human kill switch, and outcome monitoring.
- Acceptance: independently assessed thresholds and scope approved by business owner; rollout feature-flagged, safely reversible; measured reduction in human intervention without deteriorating quality.

### Phase 6 — Higher-order agents & Multi-tenant SaaS
- Read-only tool calling first, then independently approved writes (orders, product updates, follow-up); user permission gates, usage billing, multilingual packs, organization memberships, n8n adapters.
- Acceptance: unauthorized operations impossible at tool boundary, per-tenant cost/performance observable, repeatable onboarding and disaster recovery.

## 15. Dependencies, unresolved decisions and design-review agenda

Prioritize clarifying (NOT inventing) the following with the owner before crossing their corresponding deployment gates:
- LLM/vendor, privacy terms and budget; business knowledge corpus and authoritative inventory/price sources.
- Which channel first for actual send (Instagram via Zernio is the most connected), account ownership and permitted human/automated messaging rights.
- Business-owner approval roles and whether support staff can send/approve knowledge.
- Customer fact auto-apply policy for narrowly verified fields, if any; what requires human approval.
- Language/industry pilot set, quantitative thresholds/holdout size, and per-domain autonomy controls.
- Retention, data export/deletion, and storage location for sensitive conversations.
- Full org/team multi-tenancy and future cross-module capability grants.

**Immediate next engineering ticket**: implement Phase 0 safety guard and test it, then establish a canonical, tenant-safe review case from a real inbound Zernio message; prepare a response draft but do not send automatically. Follow with a separately reviewable actual send/outbox implementation.

## 16. Sources and scope of claims

- Primary requirements: user-provided Persian "CIMA Intelligence — سند جامع انتقال پروژه", 2026-10-19. Sections 3, 7, 8, 9, 10, 12, 13, 18, 22, 25, 28–31. This plan preserves the distinction between user requirements and assistant proposals.
- Project repository inspected at production SHA a39d662; files under components/crm, lib/crm, app/api/crm, and existing docs/cima-implementation-plan.md.
- Supabase production read-only metadata and aggregate row counts checked 2026-10-19, public schema, project ujsflbpseapemogybrgy.
- Zernio official reference: https://docs.zernio.com/changelog ; https://docs.zernio.com/messages/get-inbox-conversation-messages ; https://docs.zernio.com/platforms/instagram (review relevant provider terms at implementation time).

This is an implementation blueprint, not a production release, migration, ML training run or proof of autopilot quality.

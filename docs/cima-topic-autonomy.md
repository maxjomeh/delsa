# CIMA — topic-level learning and automatic answers (phases 1–3)

Status: phase 1 (decision engine + schema), phase 2 (topic discovery + historical replay) and phase 3 (persistence, owner
screen, shadow evidence) are in. **Nothing here sends a message or calls a provider, and nothing can turn automatic sending on:
the tenant switch is deliberately not exposed anywhere.** Everything has been run on synthetic conversations only, never on
real customer data or a real database.

## Product intent (owner decisions, 2026-11-22)

CIMA answers customers on its own, topic by topic, once it has complete information for that topic and its
measured confidence for the topic is high enough. Topics, fields and confidence all change dynamically.

Decisions:

1. **Shadow mode is mandatory for every topic.** Before a topic may answer automatically, CIMA drafts silently, a human
   answers for real, and the two are compared. No exceptions.
2. **Learning sources:** historical conversations (replayed as a backtest) plus human feedback going forward.
3. **Never automatic** (see below): price/stock, complaints, payments and commitments, technical fit, negotiation,
   order changes, data requests, and vague messages. The first five are *locked*.
4. **Thresholds:** the owner sets a **floor**; the system may raise a topic's threshold above it and relax it back
   down, but **never below the floor**.

## Graduated autonomy per topic

```
learning ──> shadow ──> suggest ──> auto
   ^           ^           │          │
   └───────────┴───────────┴──────────┘   automatic demotion
```

| Stage | Meaning | Moves up when | Moves down when |
| --- | --- | --- | --- |
| `learning` | topic exists, no evidence yet | approved knowledge exists **and** required fields are defined | — |
| `shadow` | silent drafts compared with the human's real reply | confidence measured, ≥ 20 shadow/backtest samples, lower bound ≥ threshold − 0.15 | — |
| `suggest` | human gets a one-click draft | tenant switch on, measured, ≥ 20 shadow samples, lower bound ≥ threshold | lower bound < threshold − 0.2 → `shadow` |
| `auto` | CIMA answers without a human | — | tenant switch off/paused, never-auto, ≥ 3 wrong automatic answers (→ `shadow`), or lower bound < threshold − 0.03 (→ `suggest`) |

The 0.03 hysteresis stops a topic flapping between `auto` and `suggest`.

## What "confidence" means

Not a model's self-reported score. It is the **Wilson lower bound (95%)** of how often a draft for this topic was
accepted by a human without material change, from real outcomes:

- outcomes: `accepted` (1 success), `edited` (½ success, ½ failure), `rejected` (1 failure), `wrong` (an automatic
  answer judged wrong — counts as **3 failures**);
- recent outcomes weigh more (half-life 45 days);
- with fewer than 30 effective samples the confidence is **`null`** ("not enough evidence"), never a low guess;
- being a lower bound, volume matters: 30 perfect answers ≈ 0.886, 40 ≈ 0.912, 200 ≈ 0.981.

Shadow comparison (`shadow-eval.mjs`) labels a draft against the human reply by token similarity, and **any number
(price, hours, quantity, phone) in the draft that the human did not say is an automatic rejection**, whatever the
similarity — a fluent answer with an invented figure is exactly what must not earn trust.

## Dynamic thresholds

`nextThreshold` starts at `max(floor, current)`. Any wrong automatic answer raises it by 0.02 each (cap 0.995).
After 50 clean automatic answers it relaxes by 0.01, never below the owner's floor.

## The final gate (`canAutoAnswer`)

An automatic answer is allowed only if **all** hold; otherwise every failing reason is returned for the UI:

tenant switch on and not paused · topic active, `auto`, not never-auto · threshold ≥ floor · measured confidence ≥
threshold · **every required field verified** (the "complete information" rule) · no risk block in the customer's
message · customer not opted out · provider messaging window open · thread not already handled or pending.

## Never automatic

Locked (the owner cannot unlock): live price, live stock, technical fit, financial commitment, complaints.
Also blocked by default: negotiation, order changes/cancellation, data deletion/privacy requests, sensitive domains,
requests for private data, and messages too short or vague to understand. These always go to a human.

## Schema (`20261122_cima_topic_autonomy.sql`)

`sima_autonomy_settings` (tenant switch, default floor, pause) · `sima_topics` · `sima_topic_fields` (required fields)
· `sima_topic_outcomes` (append-only evidence) · `sima_topic_transitions` (append-only audit).
RLS on; browser roles have no access; evidence/audit are insert-only even for `service_role`.

Defence in depth in the database itself: a never-auto or unreviewed topic cannot be `auto`; no topic of a tenant
with automatic replies off or paused can be `auto`; `threshold ≥ floor`; high-risk topics are forced never-auto;
turning automatic replies off or pausing **instantly demotes every automatic topic and writes an audit row**.

## Verification

- `node --test tests/cima-topic-autonomy.test.mjs` — 19 tests (phase 1)
- `node --test tests/cima-backtest.test.mjs` — 15 tests (phase 2: discovery, pairing, replay, knowledge suggestion, CLI, route containment); mutation-checked (scoring risky questions, bootstrapping risky knowledge, dropping never-auto each fail a test)
- `node --test tests/cima-topic-store.test.mjs tests/cima-topic-routes.test.mjs` — 15 tests (phase 3: tenant scoping of every query, idempotent replay, shadow-vs-backtest labelling, stage walk with the tenant switch, database refusal handling, route containment); mutation-checked (dropping a tenant filter, scoring proposed topics, losing idempotency, accepting any field each fail a test)
- `supabase/tests/cima-topic-runtime.sql` — activation stamp, bounded profile, once-per-interaction outcomes; removing the constraint or the trigger makes it fail
- (phase 1 detail) the engine, gate, shadow comparison, schema shape and purity checks (engine, gate, shadow comparison, schema shape, purity).
  Mutation-checked: removing the threshold check, the floor clamp, or the required-field gate each fails a test.
- `supabase/tests/cima-topic-autonomy.sql` — transactional DB tests (rolled back). Run against a real Postgres 16:
  the migration applies cleanly, is idempotent, and all assertions pass; with the guard trigger removed the test fails.

## Phase 2 — topic discovery and historical replay (read-only)

**Discovery** (`lib/crm/topic-discovery.mjs`) proposes topics from what customers actually ask. Inbound questions are
clustered on character trigrams of their words, because Persian suffixes and clitics (ساعت / ساعتی / ساعت‌هاشون) make short
questions share few whole words. Generic question words (چنده، هست، داره…) are ignored so unrelated topics do not glue
together; a second pass merges clusters whose centroids are clearly similar. A topic needs ≥ 5 questions from ≥ 3 different
customers. Each proposal is `proposed`, has an automatic label the owner must rename (`labelIsAuto`), **no required
fields** (so the completeness gate stays closed until the owner defines them), and a risk class computed from its own
questions: if ≥ 30% hit a block rule (price, stock, complaint…) it is `high` and `neverAuto`.

**Replay** (`lib/crm/backtest.mjs`) pairs each past customer question (a run of consecutive inbound messages) with the
next human reply on the same channel within 24 h, assigns it to a topic, and asks: would CIMA's grounded draft from
*approved* knowledge have matched what the human actually said?

- risky questions are **counted but never scored** toward automation;
- no approved knowledge for a question is a **coverage gap (`uncovered`), not a failure** — it tells the owner what FAQ to write;
- a draft with a number the human did not say is a rejection (shared with shadow mode);
- scored outcomes use source `backtest`, feed `topicConfidence`, and count as shadow evidence.

**Knowledge suggestions:** for topics where the owner's own past replies are consistent (medoid, ≥ 5 replies,
consistency ≥ 0.5) the most representative reply is offered as a **draft** FAQ. Never for risky topics; replies with
figures (hours, quantities) are flagged `containsNumbers` so the owner confirms they are still current. Always `draft`.

**Use it:**

```
node scripts/cima-backtest.mjs --input export.json [--output report.json] [--min-occurrences 5] [--now ISO]
# export.json: {"interactions":[{id,customer_id,channel,direction,kind,body,occurred_at}], "knowledge":[{id,title,question,answer,status,revision}]}
```

`GET /api/crm/topics/backtest` runs the same replay for the signed-in CRM tenant (auth + `has_active_crm`, reads only that
tenant's last 4,000 interactions and approved knowledge, writes nothing, flags truncation).

**Known limits (be honest with the numbers):**

- On synthetic data with approved knowledge matching the owner's reply, only 2 of 8 hour-questions were covered: the
  existing knowledge retrieval (`rankKnowledge`) is token-overlap and conservative. Coverage will be low until FAQ
  entries cover paraphrases. The report shows this gap instead of hiding it; improving retrieval is a separate, deliberate change.
- Auto labels are rough (e.g. a stray function word). The owner renames topics before activating them.
- Pairing assumes the next outbound message answers the question; a human reply to something else is noise the confidence
  engine absorbs, not something it can detect.
- The route and the CLI are unit/integration-tested; the route has **not** been exercised against a real database.

## Phase 3 — persistence, owner screen and shadow evidence

**The owner's flow** (Sima → مدیریت → «موضوع‌ها و پاسخ خودکار»):

1. *Discover* — CIMA proposes topics from past questions (`proposed`; existing topics and the owner's edits are never overwritten).
2. *Rename*, and choose the **required information** for the topic from the tenant's own enabled custom fields. Without any, the
   topic stays in `learning` however much evidence exists (the "complete information" rule).
3. *Set a floor* (default 90%): CIMA may raise the threshold above it, never below.
4. *Activate* — only now does the topic start collecting evidence.
5. *Run replay* — historical question/answer pairs are replayed with the stored topic profiles; outcomes are saved and stages
   re-evaluated (`learning → shadow → suggest`; `auto` needs the tenant switch, which does not exist yet).
6. Review **knowledge suggestions** drawn from the owner's own consistent replies and turn any into a *draft* FAQ.

**Shadow semantics.** Outcomes for replies made *before* a topic was activated are stored as `backtest`; replies made *after* it
(real-time) as `shadow`. The database stamps `activated_at` and a unique key `(tenant, topic, source, interaction)` makes every
replay idempotent. Shadow evidence is computed when a replay runs, from the *current* approved knowledge — not the knowledge
as it was at the time of each reply (revisions are not reconstructed). There is no scheduled run yet: the owner presses
«اجرای بازپخش»; a cron can call the same function later.

**API** `/api/crm/topics`: `GET` (topics, confidence, required fields, available fields) and `POST` actions `discover`, `replay`,
`rename`, `activate`, `retire`, `set_fields`, `set_floor`. Authenticated, CRM-entitled, same-origin, bounded body, ids validated;
every query goes through `lib/crm/topic-store.mjs`, which scopes each one to the tenant. It never touches the autonomy switch
and never modifies CRM records.

**Migration order:** `20261122_cima_topic_autonomy.sql`, then `20261123_cima_topic_runtime.sql` (additive, idempotent, verified on
Postgres 16 including negative controls). **Until both are applied the screen shows "topic list unavailable"** — it fails closed.

**Known limits:**

- The store is tested against an in-memory fake that mirrors unique keys and the activation trigger and records every query
  to prove tenant scoping; it has **not** run against PostgREST/Supabase. The database guards themselves are tested on real Postgres.
- Setting required fields is delete-then-insert (not one transaction); if the insert fails the previous set is lost and the
  topic simply returns to needing fields, which is the safe direction.
- Pairing, retrieval and label limits from phase 2 still apply.

## Not in this change (next phase)

4. Automatic sender through the existing human-send outbox (idempotency, receipts, UNKNOWN state, window check), the tenant
   master switch UI + kill switch, runtime "verified field" check per customer, scheduled replay, per-topic dashboard,
   and improved knowledge retrieval so coverage is not artificially low.

The `sima_response_candidates.confidence is null` database check is intentionally left as is until phase 4: per-topic
confidence lives in this engine, not on individual drafts.

## Operations

The migration has **not** been applied to any production database by this change. Apply through the normal process
after review; it is additive and idempotent.

# CIMA — topic-level learning and automatic answers (phases 1–5)

Status: phases 1–3 (decision engine, discovery/replay, owner screen + shadow evidence) and **phase 4 (automatic sending)** are in.

> **Safety posture.** Phase 4 is the first code in this project that can message a customer without a human. It ships **OFF**:
> the server mode `CIMA_AUTO_MODE` defaults to `off` (anything unrecognised means off), the scheduled runner is **not**
> scheduled by this repository, and a tenant must also switch automatic replies on with an explicit acknowledgement.
> It has **never sent a real message**: every send path was tested with a fake provider and, for the database functions,
> on a real Postgres. Treat the first live run as an experiment: start with `dry_run`.

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
- `node --test tests/cima-auto-answer.test.mjs tests/cima-auto-runner.test.mjs tests/cima-auto-store.test.mjs tests/cima-auto-routes.test.mjs` — 34 tests
  (phase 4: the decision, exactly-once sending, every refusal, provider outcomes, circuit breaker, tenant scoping, owner controls,
  route containment, human path untouched). Mutation-checked: dropping the opt-out, required-field, sender, circuit-breaker,
  already-decided, acknowledgement, "sent-only" and "once-only" rules, or treating a 503 / a missing receipt as accepted, each fails a test.
  One mutation (dropping the word-for-word check) initially survived because the test masked it behind another check; the test was
  corrected until that mutation failed. A flaky ordering in the fake database (6 of 30 runs failed) was root-caused and fixed (0 of 30).
- `supabase/tests/cima-auto-send.sql` — **on the real migration chain**: 35 refusal assertions (conversation, subscription, switch, topic, knowledge, caps, table guards, privileges — each negative changes one thing and must be refused by the database itself),
  the happy path (exact approved text, trusted conversation), claim semantics, kill switch at claim time, human items untouched,
  privileges. Four sabotage controls (verbatim check, topic stage, kill switch at claim, hourly cap) each make it fail.
- Two real bugs were found by tests while building phase 4 and fixed: a demotion that the same evaluation loop immediately undid,
  and a threshold that ratcheted up on every evaluation instead of once per wrong mark.
- `node --test tests/cima-knowledge-match.test.mjs` — 8 tests (phase 5: coverage vs the old matcher, topic scoping, no forced nearest
  match, unusable entries, ambiguity, determinism, replay integration, purity). Five mutations (any-topic candidates, no floor, ignoring
  ambiguity, accepting expired or unapproved entries) each fail a test; the readiness and reset behaviour are covered in the store tests.
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

- *(Superseded by phase 5.)* On synthetic data only 2 of 8 hour-questions were covered by the Copilot's token matcher. The replay and the
  automatic path now use the topic-scoped matcher described in phase 5.
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

## Phase 4 — automatic sending (off by default)

**What an automatic answer is.** Always the **exact text of an approved knowledge entry** that belongs to the matched topic. The
model never writes free text to a customer; the database enforces it (see below). An approved answer that itself mentions price,
stock or commitments is not sent automatically.

**Every condition must hold at once** (`lib/crm/auto-answer.mjs`): tenant switch on and not paused · topic active, in stage `auto`,
not never-auto · freshly measured confidence ≥ threshold ≥ owner floor · every required field **confirmed** for this customer ·
no risk block in the customer's *whole current turn* (all consecutive inbound messages, not only the last) · not opted out ·
inside the 23 h window · no send already pending · hourly and per-customer caps not reached.

**Three server modes** (`CIMA_AUTO_MODE`): `off` (default; nothing is even evaluated), `dry_run` (decides and records the answer it
*would* send, sends nothing), `live`. Dry-run decisions never count toward live caps.

**Exactly once.** A decision row is inserted *before* anything external happens and is unique per customer turn, so a repeated or
overlapping run skips it. Sending = database `prepare` → atomic `claim` → **one** dispatch → `finalize` with the same pessimistic
rules as the human path: only a definite refusal (400/401/403/422/429) is `rejected`; a timeout, 5xx, 409-in-flight, missing
receipt or partial failure is `unknown` and is **never retried**. The Zernio idempotency key is the outbox id.

**Defence in depth, in the database** (`20261124_cima_auto_send.sql`, service-only entry points, never callable by browser roles).
`sima_prepare_auto_send` re-verifies, regardless of what the application says: active CRM subscription; automatic replies on and
not paused; topic active, `auto`, not never-auto; **the text equals the approved, unexpired entry's answer word for word at the same
revision**; hourly and per-customer caps; and every rule the human path enforces (23 h window, opt-out, no newer business reply,
one send per turn, verified identity, trusted conversation). `sima_claim_auto_send` re-checks the kill switch at the last moment and
refuses human outbox items. Decisions are audited in `sima_auto_answers` (identity immutable, final statuses final).

**Controls for the owner** (Sima → مدیریت → «موضوع‌ها و پاسخ خودکار» → «پاسخ خودکار»): turning ON or resuming needs an explicit
acknowledgement; **«توقف فوری» is always available and needs none** — pausing makes the database demote every automatic topic at
once. Caps are editable. The decision log shows every decision *including refusals and their reasons*, and **«اشتباه بود»** on a sent
answer records a heavy failure (counts ×3), raises that topic's threshold by 0.02 (once per mark, never above 0.995, never below the
floor) and re-evaluates it immediately.

**Automatic demotion.** A circuit breaker pauses the tenant after three consecutive provider failures. A topic leaves `auto` when its
confidence falls clearly below the threshold — with thin evidence one wrong answer is enough — or after three wrong answers in 30 days
even with strong evidence (→ `shadow`). A demotion is final for that evaluation (it can no longer be undone by the same pass).

**Rollout (suggested):**

1. Apply migrations `20261122`, `20261123`, `20261124`.
2. Set `CIMA_AUTO_CRON_SECRET` (≥ 32 random chars) and `CIMA_AUTO_MODE=dry_run`. Schedule `POST /api/crm/auto/run` with
   `Authorization: Bearer <secret>` (e.g. every 5 minutes). Nothing is scheduled by the repository.
3. Define required fields, activate topics, run replay until a topic reaches `auto`, switch the tenant's automatic replies on.
4. Watch the decision log for days. Compare what CIMA *would* have sent with what you sent.
5. Only then `CIMA_AUTO_MODE=live`, for one tenant first. Keep «توقف فوری» in reach; unset `CIMA_AUTO_MODE` (or set `off`) is the
   global kill switch.

**Known limits (be honest with the numbers):**

- The application layer is tested against an in-memory fake database and a fake Zernio. The database functions are tested on a real
  Postgres 16 **built from the repository's real migrations** (outbox, human review, Zernio, knowledge, phases 1–4) — but
  that chain needed stubs for objects the repository itself does not create (see "Repository gaps"). Nothing ran against Supabase,
  PostgREST or Zernio.
- Confidence comes from replay/shadow evidence and from "wrong" marks. A sent answer is **not** automatically counted as correct
  (there is no signal for that), so live use can lower confidence but only replay/shadow can raise it.
- The threshold rises on wrong marks; **relaxing it is not implemented** (the pure function exists, nothing calls it).
- *(Superseded by phase 5.)* Knowledge matching for automatic replies is now the topic-scoped matcher; the Copilot for human review keeps its own.
- Only Instagram, only through the existing Zernio path. No scheduled runner, no per-customer verification beyond confirmed fields.

## Phase 5 — coverage and clarity (no schema change)

**Why.** Automation can only be trusted on evidence, and evidence only accrues when a customer message is matched to an approved
answer. The Copilot's token matcher needs the customer's words to overlap the entry's question word for word, so on synthetic Persian
paraphrases it covered **4 of 16** questions; evidence would have accrued far too slowly for confidence to ever rise.

**Topic-scoped knowledge matching** (`lib/crm/knowledge-match.mjs`, used by replay and by the automatic decision; **the Copilot for human
review is untouched**):

1. only approved, unexpired entries whose own question belongs to the matched topic are candidates;
2. scoring is character-trigram overlap after dropping generic question words (robust to Persian suffixes/clitics);
3. a floor (0.30) and a margin (0.08) apply: two *different* answers about equally close are **ambiguous** and nothing is sent; an
   unrelated message gets "no close answer", never the nearest entry by force.

On the synthetic conversations this covers **15 of 16** questions with no confusion between topics (related questions scored 0.29–1.00;
unrelated and cross-topic pairs exactly 0.00). **That is synthetic data.** Real precision is unknown; this module deliberately does not hide a wrong match — it
shows up as a *rejected* replay outcome, which lowers the topic's confidence and keeps it out of automatic mode. Replay and live decisions
use the same matcher, so the evidence measures what automation would really do. Replay reports now also count `ambiguous` pairs.

**"Why hasn't this topic gone automatic?"** Each topic card now shows, from the same decision the evaluator takes (computed read-only,
nothing is written): what is missing (an approved related answer, required information), that evidence is still being collected
(n of 30), that confidence has not reached the threshold, that the tenant switch is off, or that it is ready. It also shows how many
approved answers belong to the topic.

**Owner can reset the threshold.** The threshold rises by itself only when the owner marks an answer wrong; lowering it back to the floor
is a deliberate owner action (`reset_threshold`, with a confirmation). Automatic relaxation stays unimplemented on purpose.

**Known limits:** precision on real conversations is unmeasured; the floor and margin are fixed defaults, not tuned; one short
paraphrase in the synthetic set («تا چه ساعتی پاسخگو هستید؟», score 0.29, just under the 0.30 floor) is still missed — the safe direction; knowledge entries still carry one question each, so the owner
adding a few variants will raise coverage further.

**Repository gaps found while testing.** The repository's migrations do not rebuild the database on their own: `crm_learning_suggestions`
(referenced by `20261019_cima_human_review_foundation.sql`) is never created in any file, `20261021_cima_verified_identity_projection.sql`
needs `crm_zernio_*` columns that no file adds, and `service_code` / `is_admin()` come from files outside `supabase/migrations`.
They were evidently applied directly to the database. This does not affect running production, but a fresh environment cannot be
rebuilt from the repository.

The `sima_response_candidates.confidence is null` database check is intentionally left as is: per-topic confidence lives in this
engine, not on individual drafts.

## Operations

The migration has **not** been applied to any production database by this change. Apply through the normal process
after review; it is additive and idempotent.

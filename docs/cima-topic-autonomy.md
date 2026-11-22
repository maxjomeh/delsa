# CIMA — topic-level learning and automatic answers (phase 1: foundation)

Status: foundation only. **Nothing in this change sends a message, calls a provider, or reads/writes customer data.**
It adds the decision engine, the database schema and the tests that every later phase must pass through.

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

- `node --test tests/cima-topic-autonomy.test.mjs` — 19 tests (engine, gate, shadow comparison, schema shape, purity).
  Mutation-checked: removing the threshold check, the floor clamp, or the required-field gate each fails a test.
- `supabase/tests/cima-topic-autonomy.sql` — transactional DB tests (rolled back). Run against a real Postgres 16:
  the migration applies cleanly, is idempotent, and all assertions pass; with the guard trigger removed the test fails.

## Not in this change (next phases)

2. Topic discovery from inbound questions + historical **backtest runner** (needs read access to the CRM database).
3. Shadow mode wired into the copilot: draft silently, record the outcome when the human replies.
4. Automatic sender through the existing human-send outbox (idempotency, receipts, UNKNOWN state, window check),
   tenant master switch UI and kill switch, per-topic dashboard.

The `sima_response_candidates.confidence is null` database check is intentionally left as is until phase 4: per-topic
confidence lives in this engine, not on individual drafts.

## Operations

The migration has **not** been applied to any production database by this change. Apply through the normal process
after review; it is additive and idempotent.

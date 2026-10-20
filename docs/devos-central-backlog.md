# DELSA DevOS — Central Backlog (Sprint 01)

Source of truth for all product and non-product development: architecture, infrastructure, security, experiments, operations and improvements.

## Entry point
Admin: /admin?tab=development → Central Backlog.

## Model
- Scopes: product (one), cross_product (many), platform (not tied to products).
- Every task has a stable key (DEV-000001 for new tasks, CIMA-001…008 for seed), priority, type, workstream, acceptance criteria, dependencies, revision and immutable history.
- Sprint CIMA-S01 contains 8 P0 stabilization tasks, all initially ready (not completed).
- GitHub PR titles containing an exact task key can be linked by user-initiated sync or periodic sync while dashboard open. PR evidence never equals production readiness.
- Released requires passed production_deployed evidence; verified requires passed production_e2e evidence. Track actual SHA, preview, production and regression links.
- Server API admin auth via Supabase session and profiles.role; service-role DB client is server-side only; RLS and grants block anonymous/authenticated table access; service-role-only privileged functions guard optimistic updates and dependencies.
- Product progress score remains separately audited; completing a checklist does not prove AI confidence.
- Start each new change in this Backlog and connect reviewed PRs to the task.

## Rollout
1. Apply additive migration 20261020_devos_central_backlog_sprint01.sql.
2. Run node --test tests/*.test.mjs and npm run build.
3. Deploy preview, inspect authenticated admin Backlog; test creation, revision conflicts, dependencies, evidence and history.
4. User promotes after review; verify final Production.

## Sprint 01 CIMA
CIMA-001 Production audit
CIMA-002 Desktop/mobile regression
CIMA-003 Instagram inbound identity
CIMA-004 Human send and receipt
CIMA-005 Pending outbox reconciliation
CIMA-006 Message deduplication
CIMA-007 Security and regression CI
CIMA-008 Preview and production acceptance

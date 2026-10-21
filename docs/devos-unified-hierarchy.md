# DELSA DevOS — Unified Development Hierarchy

One canonical development tree replaces two separate visual sections for Roadmap and Sprint.

## Navigation
DELSA → Product or global/cross-product area → Phase → Capability → Work item → Subtasks (unbounded recursive depth).

- Roadmap phase/capability scores come from the EXISTING audited product portfolio, never from task counts.
- Tasks live in devos_tasks; parent_task_id supports recursive nesting, feature_ref links the root task to its audited capability. Old phase_ref values are backfilled to feature_ref.
- Sprint is a schedule attribute and a cross-tree filter. A task remains in its capability or parent branch while its sprint changes.
- Tasks without feature_ref remain directly under their product. Cross-product and platform tasks appear in separate first-level areas of the SAME tree.
- Selecting a node opens ONE inspector panel for metrics and actions; project/phase/capability reviews and task/history/evidence are preserved.
- API mutations keep admin authentication and revision-based changes; database trigger prevents ancestry cycles, missing parents and cross-scope attachments. Existing task keys/history/weights are preserved.
- A reviewed feature can have a different readiness score from the status of its tasks; never mark a task verified solely due to CI or deployment.
- For a non-product-anchored task, select the platform branch or product branch. Add a subtask from an existing task to nest it. Moving tasks is guarded by SQL and revision control.
- All original eight CIMA-S01 tasks remain in place; no score or Sprint status migration overwrites them.

## Release checklist
1. Apply additive migration devos_unified_multilevel_tree before testing UI API.
2. Confirm all existing tasks and reviews remain present with their statuses/weights unchanged.
3. Confirm nested create, move/cycle rejection, feature assignment, Sprint filter, evidence, search, edit review, dark and light themes, RTL, desktop/mobile.
4. Run node --test tests/*.test.mjs and npm run build via GitHub Actions and Vercel.
5. Preview only; do not automatically promote Production. After promotion run admin E2E checks and add operational evidence.

# DELSA DevOS · Donut progress refresh

## Presentation
Keep the current unified RTL multi-level tree. Show four accessible animated percentage donuts above it: audited overall, implementation, operational readiness, and documented execution. Preserve text percentages and metric names. Show small donuts at product, phase, capability, task and subtask level.

## Semantics
Roadmap percentages remain derived from the audited product scores; progress_percent is a human-entered 0–100 value only for leaf work items. Parent task percentage is calculated recursively over leaf descendants; unknown leaves conservatively contribute 0 to aggregate execution, with the number assessed displayed; an entirely unassessed parent uses an unknown donut. CI success or task statuses never inflate scores. Neither SQL nor UI auto-sends messages.

## Filters
Remove text labels above Sprint and task Status filters, use accessible aria-label on the selects and align with search and Create Sprint in RTL desktop; responsive layout on mobile.

## Deployment
Additive migration must be applied to the active Supabase project before Preview API writes. Run test suite and Next build; promote only after authenticated visual verification.
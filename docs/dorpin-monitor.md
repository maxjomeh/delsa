# DorPin supplier monitor — first implementation

## Delivered

- Lazy-loaded customer dashboard tab for active `dorpin` subscriptions.
- Manual product mapping by canonical Digikala URL/DKP, searchable monitor list.
- Fixed-origin server adapter for `/v2/product/:id/`, anonymous same-URL CDN session handshake, bounded timeout, no arbitrary URL fetches.
- Positive integer IRR storage, Toman display, explicit marketable stock; excludes membership-only pricing and minimum quantities above one.
- Grouping by color, size, warranty and returned theme attributes. User first selects a precise offer to establish the comparison group.
- Approval, automatic and locked selection; excluded sellers; minimum savings; current vs cheapest returned eligible offer.
- Thirty successful snapshots / selection events per product. Upstream failures preserve offers and mark them stale.
- RLS reads, subscription-checked server-only mutation RPC, scan leases and one-minute rate limiting.
- Authenticated scheduler endpoint: `GET /api/dorpin/cron`, `Authorization: Bearer <DORPIN_CRON_SECRET>`. Each invocation handles up to three due products, oldest attempt first. Invoke every minute from an existing server scheduler; do not expose the secret to a client. Per-product interval defaults to six hours.

## Database

`supabase/dorpin-monitor.sql` was applied to the existing delsa-backend project during implementation. It depends on the existing customer subscriptions, store products and `has_active_dorpin()` function. The new table does not alter existing DorPin product/order/supplier data.

Server requires existing Supabase URL/publishable key and `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`. Scheduler additionally requires `DORPIN_CRON_SECRET`. Configure in the hosting secret store, never source control.

## Validation

- `node --test tests/dorpin.test.mjs`
- `npm run build`
- `supabase/tests/dorpin-monitor.sql`: transactional integration tests, rolled back, using an existing active DorPin subscription; no customer data is retained or modified.
- Live sample product DKP 21190850 returned eight variants using an anonymous cookie session. This is not a guarantee of all sellers or production-host reachability.

## Rollout limits

This is the supplier-monitoring foundation, not a released full dropshipping system. No Digify write-back, automatic product matching, purchases or source-price update is performed. Product linking uses a supplied DKP URL, not a store import. Shipping price is unknown; rankings are explicitly item-price only. Returned variants may omit sellers, so the UI does not promise global lowest price. Automated scheduling must be configured and production-host fetching verified before activation. Browser/session-based end-to-end QA remains pending. Avoid deploying over the separate homepage branch without reconciling its changes.

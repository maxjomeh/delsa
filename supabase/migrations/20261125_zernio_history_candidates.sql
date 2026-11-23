-- Cuts the PostgREST egress of the history worker (Supabase "Egress" quota).
-- Every 2 minutes app/api/crm/zernio/history/cron/route.js downloaded the full JSON payload of up to 3000 events only to find
-- which (tenant, account) pairs exist. This function does the same selection INSIDE the database and returns just the pairs.
-- Same semantics as before: look at the newest 3000 account.connected / message.received events, keep Instagram/Facebook accounts
-- with a valid 24-hex account id, newest event per (tenant, account). Read-only, service role only, no new table.
begin;
create or replace function public.crm_zernio_history_candidates()
returns table(tenant_id uuid, profile_id text, account_id text)
language sql stable security definer set search_path = '' as $$
 select distinct on (w.tenant_id, w.account_id) w.tenant_id, w.profile_id, w.account_id
 from (
   select e.tenant_id, e.profile_id, e.account_id, e.payload->'account'->>'platform' as platform, e.received_at
   from public.crm_zernio_events e
   where e.event_type in ('account.connected', 'message.received')
   order by e.received_at desc
   limit 3000
 ) w
 where w.account_id ~* '^[a-f0-9]{24}$' and w.platform in ('instagram', 'facebook')
 order by w.tenant_id, w.account_id, w.received_at desc;
$$;
revoke all on function public.crm_zernio_history_candidates() from public, anon, authenticated;
grant execute on function public.crm_zernio_history_candidates() to service_role;
commit;

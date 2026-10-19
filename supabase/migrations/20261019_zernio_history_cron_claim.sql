-- Server-only fair claiming of queued history work across all tenants.
begin;
create or replace function public.crm_zernio_claim_next_history_job()
returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.crm_zernio_history_jobs%rowtype;
begin
 select * into j from public.crm_zernio_history_jobs
 where status in ('queued','running')
 and (lease_until is null or lease_until<now())
 order by coalesce(last_run_at,started_at),account_id limit 1 for update skip locked;
 if not found then return null;end if;
 update public.crm_zernio_history_jobs
 set lease_until=now()+interval '45 seconds',lease_token=gen_random_uuid(),status='running'
 where tenant_id=j.tenant_id and account_id=j.account_id returning * into j;
 return to_jsonb(j);
end $$;
revoke all on function public.crm_zernio_claim_next_history_job() from public,anon,authenticated;
grant execute on function public.crm_zernio_claim_next_history_job() to service_role;
commit;
begin;
alter table public.crm_zernio_history_jobs add column if not exists lease_until timestamptz;
alter table public.crm_zernio_history_jobs add column if not exists lease_token uuid;
create or replace function public.crm_zernio_claim_history_job(p_tenant uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.crm_zernio_history_jobs%rowtype;
begin
 select * into v from public.crm_zernio_history_jobs
 where tenant_id=p_tenant and status in ('queued','running','error')
  and (lease_until is null or lease_until<now())
 order by coalesce(last_run_at,started_at),account_id limit 1 for update skip locked;
 if not found then return null;end if;
 update public.crm_zernio_history_jobs
 set lease_token=gen_random_uuid(),lease_until=now()+interval '45 seconds',status='running'
 where tenant_id=v.tenant_id and account_id=v.account_id
 returning * into v;
 return to_jsonb(v);
end $$;
revoke all on function public.crm_zernio_claim_history_job(uuid) from public,anon,authenticated;
grant execute on function public.crm_zernio_claim_history_job(uuid) to service_role;
commit;
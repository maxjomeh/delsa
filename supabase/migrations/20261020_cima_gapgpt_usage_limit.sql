-- Per-tenant pilot cap for paid model inference, enforced atomically.
begin;
create table if not exists public.sima_model_daily_usage(
 tenant_id uuid not null references public.profiles(id),
 usage_day date not null,
 request_count integer not null default 0 check(request_count>=0),
 updated_at timestamptz not null default now(),
 primary key(tenant_id,usage_day)
);
alter table public.sima_model_daily_usage enable row level security;
revoke all on public.sima_model_daily_usage from public,anon,authenticated;
grant select,insert,update on public.sima_model_daily_usage to service_role;
create or replace function public.sima_claim_model_quota(p_tenant uuid)
returns boolean language plpgsql security definer set search_path='' as $fn$
declare allowed integer;
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' then
  raise exception 'service_role_required';
 end if;
 if p_tenant is null then return false;end if;
 insert into public.sima_model_daily_usage(tenant_id,usage_day,request_count)
 values(p_tenant,(now() at time zone 'UTC')::date,1)
 on conflict(tenant_id,usage_day) do update
 set request_count=public.sima_model_daily_usage.request_count+1,updated_at=now()
 where public.sima_model_daily_usage.request_count<20
 returning request_count into allowed;
 return allowed is not null;
end $fn$;
revoke all on function public.sima_claim_model_quota(uuid) from public,anon,authenticated;
grant execute on function public.sima_claim_model_quota(uuid) to service_role;
commit;
-- DELSA site builder, step 3: separate monthly quota for AI product suggestions made from Instagram captions.
-- PENDING EXPLICIT APPROVAL: not applied to any real database. Independent of the CRM's daily model quota.
-- Tested on a local Postgres (supabase/tests/local-postgres/run.sh supabase/tests/builder-instagram-ai.sql).
--  * One row per owner and month; builder_ai_claim(owner,count,cap) adds `count` suggestions atomically and refuses (returns -1)
--    when that would pass the cap, so concurrent requests can never overshoot. Returns the remaining allowance otherwise.
--  * Service-role only; the browser never talks to this table.
-- Run once. Rollback: supabase/builder-instagram-ai-rollback.sql.
begin;
create table public.builder_ai_usage(
 owner_id uuid not null references public.profiles(id) on delete cascade,
 usage_month date not null,
 used integer not null default 0 check(used>=0),
 updated_at timestamptz not null default now(),
 primary key(owner_id,usage_month)
);
alter table public.builder_ai_usage enable row level security;
revoke all on public.builder_ai_usage from public,anon,authenticated;
grant select on public.builder_ai_usage to service_role;

create function private.builder_ai_claim(p_owner uuid,p_count integer,p_cap integer) returns integer language plpgsql security definer set search_path='' as $$
declare m date:=date_trunc('month',now() at time zone 'UTC')::date;u integer;begin
 if p_owner is null or p_count is null or p_count<1 or p_count>50 or p_cap is null or p_cap<1 or p_cap>100000 then raise exception 'builder_ai_invalid';end if;
 if not exists(select 1 from public.profiles where id=p_owner) then raise exception 'builder_ai_invalid';end if;
 if p_count>p_cap then return -1;end if;
 insert into public.builder_ai_usage(owner_id,usage_month,used) values(p_owner,m,p_count)
  on conflict(owner_id,usage_month) do update set used=public.builder_ai_usage.used+p_count,updated_at=now() where public.builder_ai_usage.used+p_count<=p_cap
  returning used into u;
 if u is null then return -1;end if;
 return p_cap-u;
end $$;
-- Gives units back when a request fails before the model was called (so a failed analysis does not burn the allowance).
create function private.builder_ai_release(p_owner uuid,p_count integer) returns void language sql security definer set search_path='' as $$
 update public.builder_ai_usage set used=greatest(0,used-greatest(0,least(p_count,50))),updated_at=now() where owner_id=p_owner and usage_month=date_trunc('month',now() at time zone 'UTC')::date;
$$;
create function private.builder_ai_remaining(p_owner uuid,p_cap integer) returns integer language sql security definer set search_path='' as $$
 select greatest(0,p_cap-coalesce((select used from public.builder_ai_usage where owner_id=p_owner and usage_month=date_trunc('month',now() at time zone 'UTC')::date),0));
$$;
grant usage on schema private to service_role;
create function public.builder_ai_claim(p_owner uuid,p_count integer,p_cap integer) returns integer language sql security invoker set search_path='' as $$ select private.builder_ai_claim(p_owner,p_count,p_cap); $$;
create function public.builder_ai_release(p_owner uuid,p_count integer) returns void language sql security invoker set search_path='' as $$ select private.builder_ai_release(p_owner,p_count); $$;
create function public.builder_ai_remaining(p_owner uuid,p_cap integer) returns integer language sql security invoker set search_path='' as $$ select private.builder_ai_remaining(p_owner,p_cap); $$;
revoke all on function public.builder_ai_claim(uuid,integer,integer),public.builder_ai_release(uuid,integer),public.builder_ai_remaining(uuid,integer),private.builder_ai_claim(uuid,integer,integer),private.builder_ai_release(uuid,integer),private.builder_ai_remaining(uuid,integer) from public,anon,authenticated;
grant execute on function public.builder_ai_claim(uuid,integer,integer),public.builder_ai_release(uuid,integer),public.builder_ai_remaining(uuid,integer),private.builder_ai_claim(uuid,integer,integer),private.builder_ai_release(uuid,integer),private.builder_ai_remaining(uuid,integer) to service_role;
commit;

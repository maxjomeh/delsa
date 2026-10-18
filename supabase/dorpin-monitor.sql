begin;
create table if not exists public.dorpin_monitors (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 dkp text not null check(dkp ~ '^[1-9][0-9]{0,11}$'), label text not null check(length(label) between 1 and 300),
 title text, offers jsonb not null default '[]', checked_at timestamptz, attempted_at timestamptz,
 error text, scan_token uuid, scan_started timestamptz,
 variant_group text, selected_offer text, excluded text[] not null default '{}',
 mode text not null default 'approval' check(mode in ('approval','automatic','locked')),
 min_saving bigint not null default 0 check(min_saving>=0), interval_minutes integer not null default 360 check(interval_minutes between 60 and 10080),
 history jsonb not null default '[]', created_at timestamptz not null default now(), unique(user_id,dkp)
);
alter table public.dorpin_monitors enable row level security;
revoke all on public.dorpin_monitors from anon,authenticated;
grant select on public.dorpin_monitors to authenticated;
grant all on public.dorpin_monitors to service_role;
create policy dorpin_monitor_owner on public.dorpin_monitors for select to authenticated using(user_id=(select auth.uid()) and public.has_active_dorpin());
create index on public.dorpin_monitors(user_id);
-- All writes are server-only. Row locking prevents concurrent scans/selections from losing updates.
create or replace function public.dorpin_monitor_action(p_user uuid,p_id uuid,p_action text,p_body jsonb default '{}') returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.dorpin_monitors; token uuid; candidate jsonb; current_offer jsonb; next_id text; event jsonb;
begin
 if not exists(select 1 from public.customer_subscriptions s join public.store_products p on p.id=s.product_id where s.customer_id=p_user and p.service_code='dorpin' and s.starts_at<=now() and s.expires_at>now()) then raise exception 'subscription_required'; end if;
 select * into r from public.dorpin_monitors where id=p_id and user_id=p_user for update;
 if not found then raise exception 'not_found'; end if;
 if p_action='claim' then
  if r.attempted_at>now()-interval '60 seconds' or r.scan_started>now()-interval '45 seconds' then return jsonb_build_object('busy',true);end if;
  token=gen_random_uuid();update public.dorpin_monitors set scan_token=token,scan_started=now(),attempted_at=now() where id=r.id;
  return jsonb_build_object('token',token,'dkp',r.dkp);
 elsif p_action='finish' then
  if r.scan_token is distinct from (p_body->>'token')::uuid then return jsonb_build_object('ignored',true);end if;
  if p_body ? 'error' then
   update public.dorpin_monitors set error=left(p_body->>'error',500),scan_started=null,scan_token=null where id=r.id;
   return jsonb_build_object('ok',true);
  end if;
  if jsonb_typeof(p_body->'offers') is distinct from 'array' then raise exception 'invalid_offers';end if;
  next_id=r.selected_offer;
  if r.mode='automatic' and r.variant_group is not null then
   select o into candidate from jsonb_array_elements(p_body->'offers') o where o->>'group'=r.variant_group and not(o->>'sellerId'=any(r.excluded)) order by (o->>'price')::bigint,o->>'id' limit 1;
   select o into current_offer from jsonb_array_elements(p_body->'offers') o where o->>'id'=r.selected_offer and o->>'group'=r.variant_group and not(o->>'sellerId'=any(r.excluded));
   if candidate is not null and (current_offer is null or (current_offer->>'price')::bigint-(candidate->>'price')::bigint>r.min_saving) then next_id=candidate->>'id'; end if;
  end if;
  event=jsonb_build_object('at',now(),'kind','scan','count',jsonb_array_length(p_body->'offers'),'previous',r.selected_offer,'selected',next_id,'offers',p_body->'offers');
  update public.dorpin_monitors set offers=p_body->'offers',title=left(p_body->>'title',300),checked_at=now(),error=null,scan_started=null,scan_token=null,selected_offer=next_id,
   history=(select coalesce(jsonb_agg(x),'[]') from (select x from jsonb_array_elements(jsonb_build_array(event)||r.history) x limit 30) h) where id=r.id;
 elsif p_action='configure' then
  if (p_body->>'mode') not in ('approval','automatic','locked') or (p_body->>'min_saving')::bigint<0 or (p_body->>'interval_minutes')::integer not between 60 and 10080 then raise exception 'invalid_settings';end if;
  update public.dorpin_monitors set mode=p_body->>'mode',min_saving=(p_body->>'min_saving')::bigint,interval_minutes=(p_body->>'interval_minutes')::integer where id=r.id;
 elsif p_action='select' then
  if r.checked_at is null or r.checked_at<now()-interval '1 hour' or r.error is not null then raise exception 'refresh_required';end if;
  select o into candidate from jsonb_array_elements(r.offers) o where o->>'id'=p_body->>'offer' and not(o->>'sellerId'=any(r.excluded));
  if candidate is null then raise exception 'offer_missing';end if;
  update public.dorpin_monitors set selected_offer=candidate->>'id',variant_group=candidate->>'group',history=(select coalesce(jsonb_agg(x),'[]') from (select x from jsonb_array_elements(jsonb_build_array(jsonb_build_object('at',now(),'kind','selection','previous',r.selected_offer,'selected',candidate->>'id'))||r.history) x limit 30) h) where id=r.id;
 elsif p_action='exclude' then
  if length(p_body->>'seller') not between 1 and 40 then raise exception 'invalid_seller';end if;
  update public.dorpin_monitors set excluded=case when p_body->>'seller'=any(r.excluded) then array_remove(r.excluded,p_body->>'seller') else array_append(r.excluded,p_body->>'seller') end where id=r.id;
 else raise exception 'invalid_action';end if;
 return jsonb_build_object('ok',true);
end; $$;
revoke all on function public.dorpin_monitor_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.dorpin_monitor_action(uuid,uuid,text,jsonb) to service_role;
create or replace function public.dorpin_due_monitors() returns table(id uuid,user_id uuid) language sql stable security invoker set search_path='' as $$
 select m.id,m.user_id from public.dorpin_monitors m
 where (m.attempted_at is null or m.attempted_at<=now()-make_interval(mins=>m.interval_minutes))
 and (m.scan_started is null or m.scan_started<now()-interval '45 seconds')
 and exists(select 1 from public.customer_subscriptions s join public.store_products p on p.id=s.product_id where s.customer_id=m.user_id and p.service_code='dorpin' and s.starts_at<=now() and s.expires_at>now())
 order by m.attempted_at asc nulls first limit 3;
$$;
revoke all on function public.dorpin_due_monitors() from public,anon,authenticated;
grant execute on function public.dorpin_due_monitors() to service_role;
commit;

create table if not exists public.customer_stores (
  customer_id uuid primary key references public.profiles(id) on delete cascade,
  name text not null default '' check (char_length(name) <= 120),
  website text not null default '' check (char_length(website) <= 2048),
  updated_at timestamptz not null default now()
);
create table if not exists public.customer_subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.store_products(id) on delete cascade,
  plan text not null check (plan in ('demo','month','quarter','year')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique(customer_id,product_id)
);
create index if not exists customer_subscriptions_customer_idx on public.customer_subscriptions(customer_id);
alter table public.customer_stores enable row level security;
alter table public.customer_subscriptions enable row level security;
create policy "admins manage customer stores" on public.customer_stores for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins manage customer subscriptions" on public.customer_subscriptions for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
grant select,insert,update,delete on public.customer_stores,public.customer_subscriptions to authenticated;
create or replace function public.admin_set_customer_role(target_id uuid,new_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if not public.is_admin() or target_id = auth.uid() or new_role not in ('user','admin') then
   raise exception 'Permission denied';
 end if;
 update public.profiles set role=new_role where id=target_id;
 if not found then raise exception 'Customer not found'; end if;
end $$;
revoke all on function public.admin_set_customer_role(uuid,text) from public;
grant execute on function public.admin_set_customer_role(uuid,text) to authenticated;

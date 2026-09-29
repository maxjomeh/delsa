create table if not exists public.apu_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  url text not null default '' check (char_length(url) <= 2048),
  pricing_model text not null default 'source_price' check (pricing_model in ('source_price','usd_subscription','fixed_price')),
  currency text not null default 'IRR' check (currency in ('IRR','USD')),
  subscription_amount numeric(14,2),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (subscription_amount is null or subscription_amount >= 0)
);
create index if not exists apu_sources_user_updated_idx on public.apu_sources(user_id, updated_at desc);
alter table public.apu_sources enable row level security;
revoke all on public.apu_sources from anon, authenticated;
grant select, insert, update, delete on public.apu_sources to authenticated;
create policy "Customers manage own APU sources"
on public.apu_sources for all to authenticated
using ((select auth.uid()) = user_id or (select public.is_admin()))
with check ((select auth.uid()) = user_id or (select public.is_admin()));

create table if not exists public.apu_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  rule_type text not null default 'custom' check (rule_type in ('maximum_change_percent','minimum_margin_percent','fixed_price','custom')),
  value text not null check (char_length(value) between 1 and 500),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists apu_rules_user_updated_idx on public.apu_rules(user_id, updated_at desc);
alter table public.apu_rules enable row level security;
revoke all on public.apu_rules from anon, authenticated;
grant select, insert, update, delete on public.apu_rules to authenticated;
create policy "Customers manage own APU rules"
on public.apu_rules for all to authenticated
using ((select auth.uid()) = user_id or (select public.is_admin()))
with check ((select auth.uid()) = user_id or (select public.is_admin()));

create table if not exists public.apu_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('completed','partial','failed')),
  source_count integer not null default 0 check (source_count >= 0),
  updated_count integer not null default 0 check (updated_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  summary text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists apu_runs_user_created_idx on public.apu_runs(user_id, created_at desc);
alter table public.apu_runs enable row level security;
revoke all on public.apu_runs from anon, authenticated;
grant select on public.apu_runs to authenticated;
create policy "Customers read own APU runs"
on public.apu_runs for select to authenticated
using ((select auth.uid()) = user_id or (select public.is_admin()));

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('customer','admin')),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists support_messages_user_created_idx on public.support_messages(user_id, created_at);
alter table public.support_messages enable row level security;
revoke all on public.support_messages from anon, authenticated;
grant select, insert on public.support_messages to authenticated;
create policy "Customers read own support messages"
on public.support_messages for select to authenticated
using ((select auth.uid()) = user_id or (select public.is_admin()));
create policy "Customers send support messages"
on public.support_messages for insert to authenticated
with check ((select auth.uid()) = user_id and (select auth.uid()) = sender_id and sender_role = 'customer');
create policy "Admins reply to support messages"
on public.support_messages for insert to authenticated
with check ((select public.is_admin()) and sender_role = 'admin' and (select auth.uid()) = sender_id);

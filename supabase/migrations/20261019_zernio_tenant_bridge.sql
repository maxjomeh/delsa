-- Zernio tenant bridge. Apply before setting ZERNIO_API_KEY on the server.
-- No consumer/social identity is merged across platforms here.
begin;
create table if not exists public.crm_zernio_profiles (
 tenant_id uuid primary key references public.profiles(id) on delete cascade,
 profile_id text not null unique check (profile_id ~ '^[a-f0-9]{24}$'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (tenant_id, profile_id)
);
alter table public.crm_zernio_profiles enable row level security;
revoke all on public.crm_zernio_profiles from public, anon, authenticated;
grant select, insert on public.crm_zernio_profiles to service_role;

-- Durable, idempotent intake queue. No browser role can read social message content.
-- Workers will process events in a later gated migration; never acknowledge
-- a webhook before its insert succeeds.
create table if not exists public.crm_zernio_events (
 event_id uuid primary key,
 tenant_id uuid not null,
 profile_id text not null,
 account_id text not null check (account_id ~ '^[a-f0-9]{24}$'),
 event_type text not null check (event_type in ('account.connected','account.disconnected','message.received','comment.received')),
 payload jsonb not null check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=262144),
 status text not null default 'pending' check (status in ('pending','processing','processed','failed')),
 received_at timestamptz not null default now(),
 processed_at timestamptz,
 last_error text,
 foreign key (tenant_id, profile_id) references public.crm_zernio_profiles(tenant_id, profile_id)
);
create index if not exists crm_zernio_events_pending on public.crm_zernio_events(status, received_at) where status in ('pending','failed');
create index if not exists crm_zernio_events_tenant on public.crm_zernio_events(tenant_id, received_at desc);
alter table public.crm_zernio_events enable row level security;
revoke all on public.crm_zernio_events from public, anon, authenticated;
grant select, insert, update on public.crm_zernio_events to service_role;
commit;

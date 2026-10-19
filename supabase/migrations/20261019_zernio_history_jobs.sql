-- Durable, tenant-scoped pagination checkpoints for Zernio history import.
-- Cursor values are opaque, private and never returned to the browser.
begin;
create table if not exists public.crm_zernio_history_jobs(
 tenant_id uuid not null references public.profiles(id),
 profile_id text not null,
 account_id text not null check(account_id ~ '^[a-f0-9]{24}$'),
 status text not null default 'queued' check(status in ('queued','running','complete','error')),
 conversation_cursor text,
 conversation_queue jsonb not null default '[]' check(jsonb_typeof(conversation_queue)='array' and octet_length(conversation_queue::text)<262144),
 queue_index integer not null default 0,
 current_conversation text,
 current_participant jsonb not null default '{}' check(jsonb_typeof(current_participant)='object' and octet_length(current_participant::text)<8192),
 message_cursor text,
 next_conversation_cursor text,
 completed_conversations integer not null default 0,
 imported_messages integer not null default 0,
 errors integer not null default 0,
 last_error_code text,
 last_run_at timestamptz,
 started_at timestamptz not null default now(),
 completed_at timestamptz,
 primary key(tenant_id,account_id),
 foreign key(tenant_id,profile_id) references public.crm_zernio_profiles(tenant_id,profile_id)
);
alter table public.crm_zernio_history_jobs enable row level security;
revoke all on public.crm_zernio_history_jobs from public,anon,authenticated;
grant select,insert,update on public.crm_zernio_history_jobs to service_role;
create index if not exists crm_zernio_history_running on public.crm_zernio_history_jobs(status,last_run_at);
-- Add read-only social image metadata: no media bytes or credentials are persisted.
alter table public.crm_zernio_contacts add column if not exists avatar_url text check(avatar_url is null or length(avatar_url)<=2048);
alter table public.crm_zernio_contacts add column if not exists username text check(username is null or length(username)<=100);
commit;

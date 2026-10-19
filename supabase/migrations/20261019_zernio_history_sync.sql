begin;
create table if not exists public.crm_zernio_history_sync(
 tenant_id uuid primary key references public.profiles(id),
 profile_id text not null,
 list_cursor text,
 status text not null default 'idle' check(status in('idle','running','completed','error')),
 conversations_scanned integer not null default 0,
 messages_discovered integer not null default 0,
 last_error text,
 updated_at timestamptz not null default now()
);
alter table public.crm_zernio_history_sync enable row level security;
revoke all on public.crm_zernio_history_sync from public,anon,authenticated;
grant select,insert,update on public.crm_zernio_history_sync to service_role;
commit;
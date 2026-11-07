-- Safe account removal for tenants with CRM, builder or storage foreign keys.
-- Run before deploying code that filters profiles.archived_at.
alter table public.profiles add column if not exists archived_at timestamptz;
create index if not exists profiles_active_accounts_idx
  on public.profiles(created_at desc) where archived_at is null;
comment on column public.profiles.archived_at is
  'When set, the customer auth identity has been soft-deleted; linked business records are retained for safe archival.';

-- Safe account removal for tenants with CRM, builder or storage foreign keys.
-- Run before deploying code that filters profiles.archived_at.
alter table public.profiles add column if not exists archived_at timestamptz;
create index if not exists profiles_active_accounts_idx
  on public.profiles(created_at desc) where archived_at is null;
comment on column public.profiles.archived_at is
  'When set, the customer auth identity has been soft-deleted; linked business records are retained for safe archival.';

-- Prevent self-service profile updates from forging an account removal.
create or replace function public.protect_profile_archive_flag()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.archived_at is distinct from old.archived_at
    and current_user not in ('postgres','service_role','supabase_admin') then
   raise exception 'Only the server may change the account archive status';
 end if;
 return new;
end $$;
drop trigger if exists protect_profile_archive_flag on public.profiles;
create trigger protect_profile_archive_flag before update on public.profiles
  for each row execute function public.protect_profile_archive_flag();

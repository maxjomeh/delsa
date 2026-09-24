-- Run this in Supabase SQL Editor before enabling sign-up.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  phone text unique,
  full_name text not null default '',
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

-- Upgrade an existing email-based profiles table for phone/password accounts.
alter table public.profiles alter column email drop not null;
alter table public.profiles add column if not exists phone text;
create unique index if not exists profiles_phone_unique_idx
  on public.profiles(phone) where phone is not null;

update public.profiles as profile
set phone = auth_user.phone
from auth.users as auth_user
where profile.id = auth_user.id
  and profile.phone is null
  and auth_user.phone is not null;

alter table public.profiles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create policy "read own profile or admin reads all"
on public.profiles for select to authenticated
using ((select auth.uid()) = id or (select public.is_admin()));

create policy "user edits own display name"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id and role = 'user');

grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, phone, full_name, role)
  values (new.id, new.email, new.phone, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'user');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- To promote an administrator after signup, run this manually using their E.164 phone:
-- update public.profiles set role = 'admin' where phone = '+989123456789';

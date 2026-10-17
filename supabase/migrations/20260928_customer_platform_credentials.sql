-- Customer platform passwords are stored as AES-256-GCM ciphertext by the server.
create table if not exists public.customer_platform_credentials (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (char_length(platform) between 1 and 80),
  username text not null check (char_length(username) between 1 and 255),
  password_ciphertext text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists customer_platform_credentials_customer_created_idx
  on public.customer_platform_credentials(customer_id, created_at desc);
alter table public.customer_platform_credentials enable row level security;
drop policy if exists "admins manage customer platform credentials" on public.customer_platform_credentials;
create policy "admins manage customer platform credentials"
  on public.customer_platform_credentials for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
grant select, insert, delete on public.customer_platform_credentials to authenticated;

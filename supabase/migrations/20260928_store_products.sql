create table if not exists public.store_products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  description text not null default '' check (char_length(description) <= 1200),
  price numeric(12, 0) check (price is null or price >= 0),
  image_url text check (image_url is null or char_length(image_url) <= 2048),
  is_published boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists store_products_published_created_idx on public.store_products(is_published, created_at desc);
alter table public.store_products enable row level security;

drop policy if exists "public reads published store products" on public.store_products;
create policy "public reads published store products" on public.store_products for select to anon using (is_published = true);
drop policy if exists "authenticated read published or admin store products" on public.store_products;
create policy "authenticated read published or admin store products" on public.store_products for select to authenticated using (is_published = true or (select public.is_admin()));
drop policy if exists "admins insert store products" on public.store_products;
create policy "admins insert store products" on public.store_products for insert to authenticated with check ((select public.is_admin()) and created_by = (select auth.uid()));
drop policy if exists "admins update store products" on public.store_products;
create policy "admins update store products" on public.store_products for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "admins delete store products" on public.store_products;
create policy "admins delete store products" on public.store_products for delete to authenticated using ((select public.is_admin()));

grant select on public.store_products to anon, authenticated;
grant insert, update, delete on public.store_products to authenticated;

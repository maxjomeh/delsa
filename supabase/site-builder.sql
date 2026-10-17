-- DELSA site builder v1: private drafts, public publication snapshots and isolated CRM.
create schema if not exists private;
alter table public.store_products drop constraint if exists store_products_service_code_check;
alter table public.store_products add constraint store_products_service_code_check check(service_code is null or service_code in ('apu','site_builder'));
insert into public.store_products(id,name,description,price,is_published,service_code)
values('38ba2004-0021-4717-b06f-dc21493b83b5','سایت‌ساز دلسا','ساخت و انتشار صفحات با قالب‌های آماده، ویرایشگر بلوکی و دفتر مشتریان مستقل. نسخهٔ آغازین؛ فعال‌سازی اشتراک توسط مدیر دلسا.',null,true,'site_builder') on conflict(id) do nothing;
create or replace function public.has_site_builder_access() returns boolean language sql stable security invoker set search_path='' as $$
select public.is_admin() or exists(select 1 from public.customer_subscriptions s join public.store_products p on p.id=s.product_id where s.customer_id=auth.uid() and s.starts_at<=now() and s.expires_at>now() and p.service_code='site_builder')
$$;
revoke all on function public.has_site_builder_access() from public,anon;
grant execute on function public.has_site_builder_access() to authenticated;
create table public.builder_sites(
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 name text not null check(length(name) between 2 and 120),
 slug text unique not null check(slug ~ '^[a-z0-9][a-z0-9-]{2,47}$'),
 draft jsonb not null check(jsonb_typeof(draft)='object' and octet_length(draft::text)<=100000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index builder_sites_owner_idx on public.builder_sites(owner_id,created_at desc);
alter table public.builder_sites enable row level security;
revoke all on public.builder_sites from anon,authenticated;
grant select,insert on public.builder_sites to authenticated;
grant update(name,draft,updated_at) on public.builder_sites to authenticated;
create policy builder_sites_read on public.builder_sites for select to authenticated using(owner_id=(select auth.uid()) or (select public.is_admin()));
create policy builder_sites_insert on public.builder_sites for insert to authenticated with check(owner_id=(select auth.uid()) and (select public.has_site_builder_access()));
create policy builder_sites_update on public.builder_sites for update to authenticated using((owner_id=(select auth.uid()) or (select public.is_admin())) and (select public.has_site_builder_access())) with check((owner_id=(select auth.uid()) or (select public.is_admin())) and (select public.has_site_builder_access()));
create table public.builder_publications(
 site_id uuid primary key references public.builder_sites(id), slug text unique not null,
 name text not null, document jsonb not null check(jsonb_typeof(document)='object' and octet_length(document::text)<=100000),
 is_live boolean not null default true, published_at timestamptz not null default now()
);
alter table public.builder_publications enable row level security;
revoke all on public.builder_publications from anon,authenticated;
grant select on public.builder_publications to anon,authenticated;
grant insert,update on public.builder_publications to authenticated;
create policy builder_public_read on public.builder_publications for select to anon,authenticated using(is_live);
create policy builder_owner_read on public.builder_publications for select to authenticated using(exists(select 1 from public.builder_sites s where s.id=site_id and (s.owner_id=(select auth.uid()) or (select public.is_admin()))));
create policy builder_publish_insert on public.builder_publications for insert to authenticated with check((select public.has_site_builder_access()) and exists(select 1 from public.builder_sites s where s.id=site_id and s.slug=builder_publications.slug and (s.owner_id=(select auth.uid()) or (select public.is_admin()))));
create policy builder_publish_update on public.builder_publications for update to authenticated using((select public.has_site_builder_access()) and exists(select 1 from public.builder_sites s where s.id=site_id and (s.owner_id=(select auth.uid()) or (select public.is_admin())))) with check((select public.has_site_builder_access()) and exists(select 1 from public.builder_sites s where s.id=site_id and s.slug=builder_publications.slug and (s.owner_id=(select auth.uid()) or (select public.is_admin()))));
create table public.builder_versions(
 id bigint generated always as identity primary key, site_id uuid not null references public.builder_sites(id),
 document jsonb not null check(jsonb_typeof(document)='object' and octet_length(document::text)<=100000), created_at timestamptz not null default now()
);
create index builder_versions_site_idx on public.builder_versions(site_id,id desc);
alter table public.builder_versions enable row level security;
revoke all on public.builder_versions from anon,authenticated;
grant select,insert on public.builder_versions to authenticated;
grant usage,select on sequence public.builder_versions_id_seq to authenticated;
create policy builder_versions_read on public.builder_versions for select to authenticated using(exists(select 1 from public.builder_sites s where s.id=site_id and (s.owner_id=(select auth.uid()) or (select public.is_admin()))));
create policy builder_versions_insert on public.builder_versions for insert to authenticated with check((select public.has_site_builder_access()) and exists(select 1 from public.builder_sites s where s.id=site_id and (s.owner_id=(select auth.uid()) or (select public.is_admin()))));
create or replace function public.publish_builder_site(p_site uuid) returns void language plpgsql security invoker set search_path='' as $$
declare s public.builder_sites;
begin
 if not public.has_site_builder_access() then raise exception 'active subscription required'; end if;
 select * into s from public.builder_sites where id=p_site and (owner_id=auth.uid() or public.is_admin()) for update;
 if not found then raise exception 'site unavailable'; end if;
 insert into public.builder_versions(site_id,document) values(s.id,s.draft);
 insert into public.builder_publications(site_id,slug,name,document,is_live,published_at) values(s.id,s.slug,s.name,s.draft,true,now())
 on conflict(site_id) do update set name=excluded.name,document=excluded.document,is_live=true,published_at=now();
end $$;
revoke all on function public.publish_builder_site(uuid) from public,anon;
grant execute on function public.publish_builder_site(uuid) to authenticated;
create table public.builder_customers(
 id uuid primary key default gen_random_uuid(),site_id uuid not null references public.builder_sites(id),
 full_name text not null check(length(full_name) between 2 and 120),phone text not null default '' check(length(phone)<=24),
 tags text not null default '' check(length(tags)<=300),status text not null default 'new' check(status in ('new','followup','active','inactive')),
 notes text not null default '' check(length(notes)<=4000),next_followup date,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index builder_customers_site_idx on public.builder_customers(site_id,created_at desc);
alter table public.builder_customers enable row level security;
revoke all on public.builder_customers from anon,authenticated;
grant select,insert on public.builder_customers to authenticated;
grant update(full_name,phone,tags,status,notes,next_followup,updated_at) on public.builder_customers to authenticated;
create policy builder_customers_read on public.builder_customers for select to authenticated using(exists(select 1 from public.builder_sites s where s.id=site_id and (s.owner_id=(select auth.uid()) or (select public.is_admin()))));
create policy builder_customers_insert on public.builder_customers for insert to authenticated with check((select public.has_site_builder_access()) and exists(select 1 from public.builder_sites s where s.id=site_id and (s.owner_id=(select auth.uid()) or (select public.is_admin()))));
create policy builder_customers_update on public.builder_customers for update to authenticated using((select public.has_site_builder_access()) and exists(select 1 from public.builder_sites s where s.id=site_id and (s.owner_id=(select auth.uid()) or (select public.is_admin())))) with check((select public.has_site_builder_access()) and exists(select 1 from public.builder_sites s where s.id=site_id and (s.owner_id=(select auth.uid()) or (select public.is_admin()))));

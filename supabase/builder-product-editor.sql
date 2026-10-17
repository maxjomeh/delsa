-- Product editor: durable categories/brands and atomic per-store SKU allocation.
create table public.builder_catalog_terms (
 site_id uuid not null references public.builder_sites(id),kind text not null check(kind in ('category','brand')),
 name text not null check(length(trim(name)) between 1 and 120),active boolean not null default true,
 primary key(site_id,kind,name)
);
alter table public.builder_catalog_terms enable row level security;
revoke all on public.builder_catalog_terms from public,anon,authenticated;
grant select,insert,update on public.builder_catalog_terms to authenticated;
create policy catalog_terms_read on public.builder_catalog_terms for select to authenticated using(exists(select 1 from public.builder_sites s where s.id=site_id and (s.owner_id=(select auth.uid()) or (select public.is_admin()))));
create policy catalog_terms_write on public.builder_catalog_terms for all to authenticated using((select public.has_site_builder_access()) and exists(select 1 from public.builder_sites s where s.id=site_id and (s.owner_id=(select auth.uid()) or (select public.is_admin())))) with check((select public.has_site_builder_access()) and exists(select 1 from public.builder_sites s where s.id=site_id and (s.owner_id=(select auth.uid()) or (select public.is_admin()))));
insert into public.builder_catalog_terms(site_id,kind,name)
select distinct site_id,'category',category from public.builder_products where category<>''
union select distinct site_id,'brand',brand from public.builder_products where brand<>'';
create table private.builder_sku_counters(site_id uuid primary key references public.builder_sites(id),last_value bigint not null default 100000);
alter table private.builder_sku_counters enable row level security;
create policy sku_counter_no_direct_access on private.builder_sku_counters for all to authenticated using(false) with check(false);
revoke all on private.builder_sku_counters from public,anon,authenticated;
-- Definer only exposes the next reserved number, never direct counter mutation.
create function private.next_builder_sku(p_site uuid) returns text language plpgsql security definer set search_path='' as $$
declare n bigint;
begin
 if auth.uid() is null or not public.has_site_builder_access() or not exists(select 1 from public.builder_sites where id=p_site and deleted_at is null and (owner_id=auth.uid() or public.is_admin())) then raise exception 'store_access_denied';end if;
 insert into private.builder_sku_counters(site_id) values(p_site) on conflict do nothing;
 loop
 update private.builder_sku_counters set last_value=last_value+1 where site_id=p_site returning last_value into n;
 exit when not exists(select 1 from public.builder_variants where site_id=p_site and sku=n::text);
 end loop;
 return n::text;
end $$;
revoke all on function private.next_builder_sku(uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.next_builder_sku(uuid) to authenticated;
create function public.generate_builder_sku(p_site uuid) returns text language sql security invoker set search_path='' as $$ select private.next_builder_sku(p_site) $$;
revoke all on function public.generate_builder_sku(uuid) from public,anon;
grant execute on function public.generate_builder_sku(uuid) to authenticated;
create function public.remove_builder_catalog_term(p_site uuid,p_kind text,p_name text) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not public.has_site_builder_access() or not exists(select 1 from public.builder_sites where id=p_site and (owner_id=auth.uid() or public.is_admin())) then raise exception 'store_access_denied';end if;
 if p_kind='category' then update public.builder_products set category='',updated_at=clock_timestamp() where site_id=p_site and category=p_name;
 elsif p_kind='brand' then update public.builder_products set brand='',updated_at=clock_timestamp() where site_id=p_site and brand=p_name;
 else raise exception 'invalid_kind';end if;
 update public.builder_catalog_terms set active=false where site_id=p_site and kind=p_kind and name=p_name;
end $$;
revoke all on function public.remove_builder_catalog_term(uuid,text,text) from public,anon;
grant execute on function public.remove_builder_catalog_term(uuid,text,text) to authenticated;
alter table public.builder_products alter column status set default 'published';

create or replace function public.save_builder_product(p_site uuid,p_product uuid,p_document jsonb,p_variants jsonb,p_expected timestamptz default null) returns uuid language plpgsql security invoker set search_path='' as $$
declare pid uuid; v jsonb; vid uuid; keep uuid[]='{}'; old public.builder_products; current_stock integer; candidate text; base_slug text; suffix integer=1;
begin
 if not public.has_site_builder_access() or not exists(select 1 from public.builder_sites where id=p_site and (owner_id=auth.uid() or public.is_admin())) then raise exception 'store_access_denied';end if;
 perform 1 from public.builder_sites where id=p_site for update;
 if p_product is null and coalesce((p_document->>'auto_slug')::boolean,false) then
 base_slug=left(p_document->>'slug',70);candidate=base_slug;
 while exists(select 1 from public.builder_products where site_id=p_site and slug=candidate) loop
 suffix=suffix+1;candidate=base_slug||'-'||suffix;
 end loop;
 p_document=jsonb_set(p_document,'{slug}',to_jsonb(candidate));
 end if;
 if jsonb_typeof(p_variants)<>'array' or jsonb_array_length(p_variants) not between 1 and 100 then raise exception 'invalid_variants';end if;
 if p_document->>'kind'='simple' and jsonb_array_length(p_variants)<>1 then raise exception 'simple_requires_one_variant';end if;
 if p_product is not null then
 select * into old from public.builder_products where id=p_product and site_id=p_site for update;
 if not found or old.updated_at is distinct from p_expected then raise exception 'product_changed';end if;pid=p_product;
 update public.builder_products set title=p_document->>'title',slug=p_document->>'slug',kind=p_document->>'kind',status=p_document->>'status',description=coalesce(p_document->>'description',''),summary=coalesce(p_document->>'summary',''),category=coalesce(p_document->>'category',''),brand=coalesce(p_document->>'brand',''),images=array(select jsonb_array_elements_text(coalesce(p_document->'images','[]'))),tags=array(select jsonb_array_elements_text(coalesce(p_document->'tags','[]'))),attributes=coalesce(p_document->'attributes','{}'),featured=coalesce((p_document->>'featured')::boolean,false),weight_grams=coalesce((p_document->>'weight_grams')::integer,0),updated_at=clock_timestamp() where id=pid;
 else
 insert into public.builder_products(site_id,title,slug,kind,status,description,summary,category,brand,images,tags,attributes,featured,weight_grams) values(p_site,p_document->>'title',p_document->>'slug',p_document->>'kind',p_document->>'status',coalesce(p_document->>'description',''),coalesce(p_document->>'summary',''),coalesce(p_document->>'category',''),coalesce(p_document->>'brand',''),array(select jsonb_array_elements_text(coalesce(p_document->'images','[]'))),array(select jsonb_array_elements_text(coalesce(p_document->'tags','[]'))),coalesce(p_document->'attributes','{}'),coalesce((p_document->>'featured')::boolean,false),coalesce((p_document->>'weight_grams')::integer,0)) returning id into pid;
 end if;
 for v in select value from jsonb_array_elements(p_variants) loop
 if coalesce(trim(v->>'sku'),'')='' then v=jsonb_set(v,'{sku}',to_jsonb(private.next_builder_sku(p_site)));end if;
 vid=coalesce(nullif(v->>'id','')::uuid,gen_random_uuid());
 select stock into current_stock from public.builder_variants where id=vid and product_id=pid for update;
 if found and (v->>'expected_stock') is not null and current_stock<>(v->>'expected_stock')::integer then raise exception 'stock_changed';end if;
 if vid=any(keep) then raise exception 'invalid_variants';end if;
 if exists(select 1 from public.builder_variants where id=vid and (site_id<>p_site or product_id<>pid)) then raise exception 'variant_access_denied';end if;
 insert into public.builder_variants(id,site_id,product_id,label,sku,price,sale_price,stock,manage_stock,attributes,enabled) values(vid,p_site,pid,v->>'label',v->>'sku',(v->>'price')::bigint,nullif(v->>'sale_price','')::bigint,(v->>'stock')::integer,(v->>'manage_stock')::boolean,coalesce(v->'attributes','{}'),true)
 on conflict(id) do update set label=excluded.label,sku=excluded.sku,price=excluded.price,sale_price=excluded.sale_price,stock=excluded.stock,manage_stock=excluded.manage_stock,attributes=excluded.attributes,enabled=true;
 keep=array_append(keep,vid);
 end loop;
 update public.builder_variants set enabled=false where product_id=pid and site_id=p_site and not(id=any(keep));
 insert into public.builder_catalog_terms(site_id,kind,name,active)
 select p_site,x.kind,x.name,true from (values('category',trim(p_document->>'category')),('brand',trim(p_document->>'brand'))) x(kind,name) where coalesce(x.name,'')<>''
 on conflict(site_id,kind,name) do update set active=true;
 return pid;
end $$;
revoke all on function public.save_builder_product(uuid,uuid,jsonb,jsonb,timestamptz) from public,anon;
grant execute on function public.save_builder_product(uuid,uuid,jsonb,jsonb,timestamptz) to authenticated;

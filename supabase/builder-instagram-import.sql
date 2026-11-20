-- DELSA site builder, step 2 of "Instagram posts -> products": link between a product and the post it came from,
-- product videos, the video bucket and the per-site media quota.
-- PENDING EXPLICIT APPROVAL: not applied to any real database. Requires supabase/builder-instagram.sql and builder-commerce.sql.
-- Tested on a local Postgres (supabase/tests/local-postgres/run.sh supabase/tests/builder-instagram-import.sql).
--  * builder_instagram_imports: one row per (site, Instagram media) - prevents importing the same post twice and keeps the
--    permalink/caption for the "view on Instagram" button and later sync. Readable by the site owner only (public read comes later).
--  * builder_product_videos: videos copied into our storage, publicly readable exactly like published products.
--  * Writes happen only through service-role functions called by the authenticated server route, which verifies the owner.
-- Run once. Rollback: supabase/builder-instagram-import-rollback.sql.
begin;
create table public.builder_instagram_imports(
 id uuid primary key default gen_random_uuid(),
 site_id uuid not null, product_id uuid not null,
 foreign key(product_id,site_id) references public.builder_products(id,site_id) on delete cascade,
 account_row uuid references public.builder_instagram_accounts(id) on delete set null,
 media_id text not null check(media_id~'^[0-9]{1,40}$'),
 kind text not null check(kind in ('image','carousel','video','reel','story')),
 permalink text not null default '' check(length(permalink)<=300),
 caption text not null default '' check(length(caption)<=2200),
 posted_at timestamptz,
 show_link boolean not null default true,
 imported_at timestamptz not null default now(),
 unique(site_id,media_id)
);
create index builder_instagram_imports_product on public.builder_instagram_imports(product_id);
alter table public.builder_instagram_imports enable row level security;
revoke all on public.builder_instagram_imports from public,anon,authenticated;
grant select on public.builder_instagram_imports to authenticated;
create policy owner_read on public.builder_instagram_imports for select to authenticated using(exists(select 1 from public.builder_sites s where s.id=builder_instagram_imports.site_id and (s.owner_id=(select auth.uid()) or (select public.is_admin()))));

create table public.builder_product_videos(
 id uuid primary key default gen_random_uuid(),
 site_id uuid not null, product_id uuid not null,
 foreign key(product_id,site_id) references public.builder_products(id,site_id) on delete cascade,
 url text not null check(url~'^https://' and length(url)<=2048),
 poster text not null default '' check(poster='' or (poster~'^https://' and length(poster)<=2048)),
 bytes bigint not null check(bytes between 1 and 52428800),
 position smallint not null default 0 check(position between 0 and 2),
 created_at timestamptz not null default now()
);
create index builder_product_videos_product on public.builder_product_videos(product_id,position);
alter table public.builder_product_videos enable row level security;
revoke all on public.builder_product_videos from public,anon,authenticated;
grant select on public.builder_product_videos to anon,authenticated;
create policy public_read on public.builder_product_videos for select to anon,authenticated using(exists(select 1 from public.builder_products p where p.id=product_id and p.site_id=builder_product_videos.site_id and p.status='published' and exists(select 1 from public.builder_publications b where b.site_id=p.site_id and b.is_live)));
create policy owner_read on public.builder_product_videos for select to authenticated using(exists(select 1 from public.builder_sites s where s.id=builder_product_videos.site_id and (s.owner_id=(select auth.uid()) or (select public.is_admin()))));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('builder-product-videos','builder-product-videos',true,52428800,array['video/mp4','video/quicktime']) on conflict(id) do nothing;

create function private.builder_instagram_record_import(p_owner uuid,p_site uuid,p_product uuid,p_account uuid,p_media text,p_kind text,p_permalink text,p_posted timestamptz,p_caption text,p_videos jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;v jsonb;i smallint:=0;begin
 if not exists(select 1 from public.builder_sites where id=p_site and owner_id=p_owner) then raise exception 'builder_instagram_forbidden';end if;
 if not exists(select 1 from public.builder_products where id=p_product and site_id=p_site) then raise exception 'builder_instagram_forbidden';end if;
 if p_account is not null and not exists(select 1 from public.builder_instagram_accounts where id=p_account and owner_id=p_owner) then raise exception 'builder_instagram_forbidden';end if;
 if p_videos is not null and (jsonb_typeof(p_videos)<>'array' or jsonb_array_length(p_videos)>3) then raise exception 'builder_instagram_invalid';end if;
 insert into public.builder_instagram_imports(site_id,product_id,account_row,media_id,kind,permalink,caption,posted_at) values(p_site,p_product,p_account,p_media,p_kind,coalesce(p_permalink,''),left(coalesce(p_caption,''),2200),p_posted)
  on conflict(site_id,media_id) do nothing returning id into rid;
 if rid is null then raise exception 'builder_instagram_duplicate';end if;
 for v in select value from jsonb_array_elements(coalesce(p_videos,'[]'::jsonb)) loop
  insert into public.builder_product_videos(site_id,product_id,url,poster,bytes,position) values(p_site,p_product,v->>'url',coalesce(v->>'poster',''),(v->>'bytes')::bigint,i);i:=i+1;
 end loop;
 return rid;
end $$;
-- Total bytes a site has stored in the builder media buckets (images + videos); used for the per-site quota.
create function private.builder_site_media_bytes(p_site uuid) returns bigint language sql security definer set search_path='' as $$
 select coalesce(sum((o.metadata->>'size')::bigint),0)::bigint from storage.objects o where o.bucket_id in ('builder-product-images','builder-product-videos') and o.name like p_site::text||'/%';
$$;
grant usage on schema private to service_role;
create function public.builder_instagram_record_import(p_owner uuid,p_site uuid,p_product uuid,p_account uuid,p_media text,p_kind text,p_permalink text,p_posted timestamptz,p_caption text,p_videos jsonb) returns uuid language sql security invoker set search_path='' as $$ select private.builder_instagram_record_import(p_owner,p_site,p_product,p_account,p_media,p_kind,p_permalink,p_posted,p_caption,p_videos); $$;
create function public.builder_site_media_bytes(p_site uuid) returns bigint language sql security invoker set search_path='' as $$ select private.builder_site_media_bytes(p_site); $$;
revoke all on function public.builder_instagram_record_import(uuid,uuid,uuid,uuid,text,text,text,timestamptz,text,jsonb),public.builder_site_media_bytes(uuid),private.builder_instagram_record_import(uuid,uuid,uuid,uuid,text,text,text,timestamptz,text,jsonb),private.builder_site_media_bytes(uuid) from public,anon,authenticated;
grant execute on function public.builder_instagram_record_import(uuid,uuid,uuid,uuid,text,text,text,timestamptz,text,jsonb),public.builder_site_media_bytes(uuid),private.builder_instagram_record_import(uuid,uuid,uuid,uuid,text,text,text,timestamptz,text,jsonb),private.builder_site_media_bytes(uuid) to service_role;
commit;

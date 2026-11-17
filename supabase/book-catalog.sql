-- DELSA book catalog (site-builder phase 3b).
-- APPLIED to the delsa-backend database on 2026-11-17 (run once; the file is not idempotent). Tested on a local Postgres
-- (see supabase/tests/local-postgres/run.sh and supabase/tests/book-catalog.sql).
--
-- Design
--  * One shared catalog of BIBLIOGRAPHIC FACTS ONLY (works, editions, people, publishers). Prices, stock,
--    descriptions and every other customer-specific datum stay in the customer's own builder_products rows.
--  * builder_product_books links a customer's product to a catalog edition; nothing is merged across customers.
--  * Customers cannot write to the catalog tables. They contribute through catalog_upsert_edition(), which
--    validates every field, never overwrites an existing edition, marks new rows unverified and is rate limited.
--    Admins verify or correct rows (RLS: is_admin()).
--  * Provenance is stored per edition (source, source_ref, field_sources) so every datum can be traced.
--  * Reading is public (anon + authenticated) except the contributor columns, which are not granted.
create schema if not exists private;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------- text helpers
-- Persian-aware normalisation used for matching and de-duplication (mirrored by faNorm() in lib/book-isbn.js).
create or replace function public.fa_norm(p text) returns text language sql immutable parallel safe set search_path='' as $$
 select btrim(regexp_replace(regexp_replace(
  translate(lower(coalesce(p,'')),'يىكةۀأإ٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','ییکههاا01234567890123456789'),
  '[\u064B-\u065F\u0670\u0640]','','g'),
  '[\u200B-\u200D\u00A0[:space:]]+',' ','g'))
$$;

-- Normalises an ISBN-10 or ISBN-13 (hyphens, spaces, Persian digits allowed) to a valid ISBN-13, else NULL.
create or replace function public.book_isbn13(p text) returns text language plpgsql immutable parallel safe set search_path='' as $$
declare s text; i integer; total integer:=0; d integer; core text;
begin
 s=upper(regexp_replace(translate(coalesce(p,''),'۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩','01234567890123456789'),'[[:space:]‐‑–—-]','','g'));
 if s ~ '^97[89][0-9]{10}$' then
  for i in 1..12 loop total=total+substr(s,i,1)::integer*case when i%2=1 then 1 else 3 end; end loop;
  return case when (10-total%10)%10=substr(s,13,1)::integer then s end;
 elsif s ~ '^[0-9]{9}[0-9X]$' then
  for i in 1..9 loop total=total+substr(s,i,1)::integer*(11-i); end loop;
  d=case when substr(s,10,1)='X' then 10 else substr(s,10,1)::integer end;
  if (total+d)%11<>0 then return null; end if;
  core='978'||substr(s,1,9);total=0;
  for i in 1..12 loop total=total+substr(core,i,1)::integer*case when i%2=1 then 1 else 3 end; end loop;
  return core||((10-total%10)%10)::text;
 end if;
 return null;
end $$;

-- ---------------------------------------------------------------- catalog tables
create table public.book_publishers(
 id uuid primary key default gen_random_uuid(),
 name text not null check(char_length(name) between 1 and 160),
 name_norm text not null unique,
 created_at timestamptz not null default now()
);
create table public.book_people(
 id uuid primary key default gen_random_uuid(),
 name text not null check(char_length(name) between 1 and 120),
 name_norm text not null unique,
 created_at timestamptz not null default now()
);
create table public.book_works(
 id uuid primary key default gen_random_uuid(),
 title text not null check(char_length(title) between 1 and 300),
 title_norm text not null,
 created_at timestamptz not null default now()
);
create index book_works_title_idx on public.book_works(title_norm);
create table public.book_work_people(
 work_id uuid not null references public.book_works(id) on delete cascade,
 person_id uuid not null references public.book_people(id),
 role text not null default 'author' check(role='author'),
 position smallint not null default 0,
 primary key(work_id,person_id,role)
);
create index book_work_people_person_idx on public.book_work_people(person_id);
create table public.book_editions(
 id uuid primary key default gen_random_uuid(),
 work_id uuid not null references public.book_works(id) on delete cascade,
 isbn13 text not null unique check(isbn13 ~ '^97[89][0-9]{10}$'),
 title text not null check(char_length(title) between 1 and 300),
 title_norm text not null,
 publisher_id uuid references public.book_publishers(id),
 language text check(char_length(language)<=40),
 edition_label text check(char_length(edition_label)<=60),
 publish_year integer check(publish_year between 1200 and 2200),
 year_calendar text check(year_calendar in ('jalali','gregorian')),
 pages integer check(pages between 1 and 100000),
 cover text check(char_length(cover)<=60),
 cover_image_url text check(cover_image_url is null or (cover_image_url ~ '^https://' and char_length(cover_image_url)<=2048)),
 source text not null default 'manual' check(source in ('manual','open_library','import','national_library')),
 source_ref text check(char_length(source_ref)<=200),
 field_sources jsonb not null default '{}' check(jsonb_typeof(field_sources)='object' and octet_length(field_sources::text)<=2000),
 verified boolean not null default false,
 verified_by uuid references auth.users(id) on delete set null,
 verified_at timestamptz,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index book_editions_work_idx on public.book_editions(work_id);
create index book_editions_publisher_idx on public.book_editions(publisher_id);
create index book_editions_creator_idx on public.book_editions(created_by,created_at desc);
create index book_editions_title_trgm on public.book_editions using gin(title_norm extensions.gin_trgm_ops);
create index book_people_name_trgm on public.book_people using gin(name_norm extensions.gin_trgm_ops);
create index book_publishers_name_trgm on public.book_publishers using gin(name_norm extensions.gin_trgm_ops);
create table public.book_edition_people(
 edition_id uuid not null references public.book_editions(id) on delete cascade,
 person_id uuid not null references public.book_people(id),
 role text not null check(role in ('translator','illustrator','editor')),
 position smallint not null default 0,
 primary key(edition_id,person_id,role)
);
create index book_edition_people_person_idx on public.book_edition_people(person_id);
-- Lookups against the external source are rate limited per user (never exposed to the API roles).
create table public.book_isbn_lookup_log(
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 isbn13 text not null,
 created_at timestamptz not null default now()
);
create index book_isbn_lookup_log_user_idx on public.book_isbn_lookup_log(user_id,created_at desc);
-- Link between a customer's product and a catalog edition. (product_id,site_id) keeps it on the same site.
create table public.builder_product_books(
 product_id uuid primary key,
 site_id uuid not null,
 edition_id uuid not null references public.book_editions(id),
 created_at timestamptz not null default now(),
 foreign key(product_id,site_id) references public.builder_products(id,site_id) on delete cascade
);
create index builder_product_books_edition_idx on public.builder_product_books(edition_id);
create index builder_product_books_site_idx on public.builder_product_books(site_id);

-- ---------------------------------------------------------------- privileges and RLS
do $$ declare t text; begin
 foreach t in array array['book_publishers','book_people','book_works','book_work_people','book_editions','book_edition_people','book_isbn_lookup_log','builder_product_books'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
end $$;
-- Public read of bibliographic data. Contributor columns (created_by, verified_by) are not granted.
grant select on public.book_publishers,public.book_people,public.book_works,public.book_work_people,public.book_edition_people to anon,authenticated;
grant select(id,work_id,isbn13,title,title_norm,publisher_id,language,edition_label,publish_year,year_calendar,pages,cover,cover_image_url,source,source_ref,field_sources,verified,verified_at,created_at,updated_at) on public.book_editions to anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['book_publishers','book_people','book_works','book_work_people','book_editions','book_edition_people'] loop
  execute format('create policy %I on public.%I for select to anon,authenticated using(true)',t||'_read',t);
  -- Corrections and moderation are admin-only; customers contribute through catalog_upsert_edition().
  execute format('grant insert,update,delete on public.%I to authenticated',t);
  execute format('create policy %I on public.%I for all to authenticated using((select public.is_admin())) with check((select public.is_admin()))',t||'_admin',t);
 end loop;
end $$;
grant select,insert,delete on public.builder_product_books to authenticated;
grant select on public.builder_product_books to anon;
create policy builder_product_books_public on public.builder_product_books for select to anon,authenticated
 using(exists(select 1 from public.builder_publications p where p.site_id=builder_product_books.site_id and p.is_live));
create policy builder_product_books_owner_read on public.builder_product_books for select to authenticated
 using(exists(select 1 from public.builder_sites s where s.id=site_id and (s.owner_id=(select auth.uid()) or (select public.is_admin()))));
create policy builder_product_books_insert on public.builder_product_books for insert to authenticated
 with check((select public.has_site_builder_access()) and exists(select 1 from public.builder_sites s where s.id=site_id and s.deleted_at is null and (s.owner_id=(select auth.uid()) or (select public.is_admin()))));
create policy builder_product_books_delete on public.builder_product_books for delete to authenticated
 using((select public.has_site_builder_access()) and exists(select 1 from public.builder_sites s where s.id=site_id and (s.owner_id=(select auth.uid()) or (select public.is_admin()))));

-- ---------------------------------------------------------------- RPCs
-- Contribute an edition to the shared catalog (or get the existing one). Never overwrites existing rows.
-- p: {isbn,title,authors[],translators[],publisher,language,edition_label,publish_year,year_calendar,pages,
--     cover,cover_image_url,source,source_ref,field_sources{}}
create or replace function public.catalog_upsert_edition(p_site uuid,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid=auth.uid(); isbn text; ttl text; pub text; pubid uuid; wid uuid; eid uuid; pid uuid; nm text; i integer;
 authors text[]=array[]::text[]; translators text[]=array[]::text[]; src text; yr integer; pg integer; fs jsonb;
 cal text; cvr text; img text; lang text; lbl text; sref text; admin boolean; first_author uuid;
begin
 if uid is null or not public.has_site_builder_access() then raise exception 'store_access_denied'; end if;
 if not exists(select 1 from public.builder_sites s where s.id=p_site and s.deleted_at is null and (s.owner_id=uid or public.is_admin())) then raise exception 'store_access_denied'; end if;
 if p is null or jsonb_typeof(p)<>'object' then raise exception 'invalid_book'; end if;
 admin=public.is_admin();
 isbn=public.book_isbn13(p->>'isbn'); if isbn is null then raise exception 'invalid_isbn'; end if;
 ttl=btrim(coalesce(p->>'title','')); if char_length(ttl) not between 1 and 300 then raise exception 'invalid_book'; end if;
 pub=nullif(btrim(coalesce(p->>'publisher','')),''); if pub is not null and char_length(pub)>160 then raise exception 'invalid_book'; end if;
 lang=nullif(btrim(coalesce(p->>'language','')),''); lbl=nullif(btrim(coalesce(p->>'edition_label','')),''); cvr=nullif(btrim(coalesce(p->>'cover','')),'');
 sref=nullif(btrim(coalesce(p->>'source_ref','')),''); img=nullif(btrim(coalesce(p->>'cover_image_url','')),'');
 if char_length(coalesce(lang,''))>40 or char_length(coalesce(lbl,''))>60 or char_length(coalesce(cvr,''))>60 or char_length(coalesce(sref,''))>200 then raise exception 'invalid_book'; end if;
 if img is not null and (img !~ '^https://' or char_length(img)>2048) then raise exception 'invalid_book'; end if;
 if nullif(p->>'publish_year','') is not null then
  if (p->>'publish_year') !~ '^[0-9]{4}$' then raise exception 'invalid_book'; end if; yr=(p->>'publish_year')::integer;
  if yr not between 1200 and 2200 then raise exception 'invalid_book'; end if;
 end if;
 cal=nullif(p->>'year_calendar',''); if cal is not null and cal not in ('jalali','gregorian') then raise exception 'invalid_book'; end if;
 if nullif(p->>'pages','') is not null then
  if (p->>'pages') !~ '^[0-9]{1,6}$' then raise exception 'invalid_book'; end if; pg=(p->>'pages')::integer;
  if pg not between 1 and 100000 then raise exception 'invalid_book'; end if;
 end if;
 src=coalesce(nullif(p->>'source',''),'manual'); if src not in ('manual','open_library','import') and not (admin and src='national_library') then raise exception 'invalid_book'; end if;
 fs=coalesce(p->'field_sources','{}'::jsonb); if jsonb_typeof(fs)<>'object' or octet_length(fs::text)>2000 then raise exception 'invalid_book'; end if;
 for i in 0..1 loop
  declare arr jsonb=case when i=0 then p->'authors' else p->'translators' end; item jsonb; names text[]=array[]::text[];
  begin
   if arr is not null and jsonb_typeof(arr)<>'array' then raise exception 'invalid_book'; end if;
   if arr is not null then
    if jsonb_array_length(arr)>10 then raise exception 'invalid_book'; end if;
    for item in select * from jsonb_array_elements(arr) loop
     if jsonb_typeof(item)<>'string' then raise exception 'invalid_book'; end if;
     nm=btrim(item #>> '{}'); if nm='' then continue; end if;
     if char_length(nm)>120 then raise exception 'invalid_book'; end if;
     names=names||nm;
    end loop;
   end if;
   if i=0 then authors=names; else translators=names; end if;
  end;
 end loop;
 -- Existing edition: return it untouched (customers cannot overwrite shared data).
 select id into eid from public.book_editions where isbn13=isbn;
 if found then return jsonb_build_object('id',eid,'created',false); end if;
 if (select count(*) from public.book_editions where created_by=uid and created_at>now()-interval '1 day')>=300 then raise exception 'catalog_rate_limited'; end if;
 if pub is not null then
  insert into public.book_publishers(name,name_norm) values(pub,public.fa_norm(pub)) on conflict(name_norm) do update set name=public.book_publishers.name returning id into pubid;
 end if;
 -- Work: same normalised title and same first author (or both without authors).
 if array_length(authors,1)>0 then
  insert into public.book_people(name,name_norm) values(authors[1],public.fa_norm(authors[1])) on conflict(name_norm) do update set name=public.book_people.name returning id into first_author;
  select w.id into wid from public.book_works w join public.book_work_people wp on wp.work_id=w.id and wp.person_id=first_author and wp.role='author' where w.title_norm=public.fa_norm(ttl) order by w.created_at limit 1;
 else
  select w.id into wid from public.book_works w where w.title_norm=public.fa_norm(ttl) and not exists(select 1 from public.book_work_people x where x.work_id=w.id) order by w.created_at limit 1;
 end if;
 if wid is null then
  insert into public.book_works(title,title_norm) values(ttl,public.fa_norm(ttl)) returning id into wid;
  for i in 1..coalesce(array_length(authors,1),0) loop
   insert into public.book_people(name,name_norm) values(authors[i],public.fa_norm(authors[i])) on conflict(name_norm) do update set name=public.book_people.name returning id into pid;
   insert into public.book_work_people(work_id,person_id,role,position) values(wid,pid,'author',i-1) on conflict do nothing;
  end loop;
 end if;
 insert into public.book_editions(work_id,isbn13,title,title_norm,publisher_id,language,edition_label,publish_year,year_calendar,pages,cover,cover_image_url,source,source_ref,field_sources,verified,verified_by,verified_at,created_by)
 values(wid,isbn,ttl,public.fa_norm(ttl),pubid,lang,lbl,yr,cal,pg,cvr,img,src,sref,fs,admin,case when admin then uid end,case when admin then now() end,uid) returning id into eid;
 for i in 1..coalesce(array_length(translators,1),0) loop
  insert into public.book_people(name,name_norm) values(translators[i],public.fa_norm(translators[i])) on conflict(name_norm) do update set name=public.book_people.name returning id into pid;
  insert into public.book_edition_people(edition_id,person_id,role,position) values(eid,pid,'translator',i-1) on conflict do nothing;
 end loop;
 return jsonb_build_object('id',eid,'work_id',wid,'created',true);
end $$;

-- One edition by ISBN (10 or 13) with its people, publisher and the other editions of the same work.
create or replace function public.catalog_lookup_edition(p_isbn text) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'id',e.id,'work_id',e.work_id,'isbn13',e.isbn13,'title',e.title,'language',e.language,'edition_label',e.edition_label,
  'publish_year',e.publish_year,'year_calendar',e.year_calendar,'pages',e.pages,'cover',e.cover,'cover_image_url',e.cover_image_url,
  'source',e.source,'source_ref',e.source_ref,'verified',e.verified,
  'publisher',(select name from public.book_publishers where id=e.publisher_id),
  'authors',coalesce((select jsonb_agg(p.name order by wp.position) from public.book_work_people wp join public.book_people p on p.id=wp.person_id where wp.work_id=e.work_id),'[]'::jsonb),
  'translators',coalesce((select jsonb_agg(p.name order by ep.position) from public.book_edition_people ep join public.book_people p on p.id=ep.person_id where ep.edition_id=e.id and ep.role='translator'),'[]'::jsonb),
  'other_editions',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'isbn13',o.isbn13,'title',o.title,'edition_label',o.edition_label,'publish_year',o.publish_year,'publisher',(select name from public.book_publishers where id=o.publisher_id)) order by o.publish_year desc nulls last) from (select x.id,x.isbn13,x.title,x.edition_label,x.publish_year,x.publisher_id from public.book_editions x where x.work_id=e.work_id and x.id<>e.id order by x.publish_year desc nulls last limit 20) o),'[]'::jsonb))
 from public.book_editions e where e.isbn13=public.book_isbn13(p_isbn)
$$;

-- Search by title, author, publisher or ISBN. Persian variants (ي/ی، ك/ک، digits, ZWNJ) are normalised.
create or replace function public.catalog_search(p_q text,p_limit integer default 20) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare q text=public.fa_norm(p_q); lim integer=least(greatest(coalesce(p_limit,20),1),50); isbn text=public.book_isbn13(p_q); pat text; result jsonb;
begin
 if q='' then return '[]'::jsonb; end if;
 pat='%'||replace(replace(replace(q,'\','\\'),'%','\%'),'_','\_')||'%';
 select coalesce(jsonb_agg(row_to_json(r)::jsonb),'[]'::jsonb) into result from (
  select e.id,e.isbn13,e.title,e.edition_label,e.publish_year,e.verified,
   (select name from public.book_publishers where id=e.publisher_id) as publisher,
   coalesce((select jsonb_agg(p.name order by wp.position) from public.book_work_people wp join public.book_people p on p.id=wp.person_id where wp.work_id=e.work_id),'[]'::jsonb) as authors
  from public.book_editions e
  where (isbn is not null and e.isbn13=isbn) or e.title_norm like pat
   or exists(select 1 from public.book_work_people wp join public.book_people p on p.id=wp.person_id where wp.work_id=e.work_id and p.name_norm like pat)
   or exists(select 1 from public.book_publishers b where b.id=e.publisher_id and b.name_norm like pat)
  order by (isbn is not null and e.isbn13=isbn) desc,e.verified desc,e.created_at desc limit lim) r;
 return result;
end $$;

-- Called by the server route before it contacts the external book source: 60 lookups per user and hour.
create or replace function public.catalog_register_lookup(p_isbn text) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid=auth.uid(); isbn text=public.book_isbn13(p_isbn);
begin
 if uid is null or not public.has_site_builder_access() then raise exception 'store_access_denied'; end if;
 if isbn is null then raise exception 'invalid_isbn'; end if;
 if (select count(*) from public.book_isbn_lookup_log where user_id=uid and created_at>now()-interval '1 hour')>=60 then raise exception 'lookup_rate_limited'; end if;
 insert into public.book_isbn_lookup_log(user_id,isbn13) values(uid,isbn);
 delete from public.book_isbn_lookup_log where user_id=uid and created_at<now()-interval '7 days';
end $$;

-- Admin quality control.
create or replace function public.catalog_admin_set_verified(p_edition uuid,p_verified boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'store_access_denied'; end if;
 update public.book_editions set verified=p_verified,verified_by=case when p_verified then auth.uid() end,verified_at=case when p_verified then now() end,updated_at=now() where id=p_edition;
 if not found then raise exception 'not_found'; end if;
end $$;

revoke all on function public.catalog_upsert_edition(uuid,jsonb),public.catalog_register_lookup(text),public.catalog_admin_set_verified(uuid,boolean) from public,anon;
grant execute on function public.catalog_upsert_edition(uuid,jsonb),public.catalog_register_lookup(text),public.catalog_admin_set_verified(uuid,boolean) to authenticated;
revoke all on function public.catalog_lookup_edition(text),public.catalog_search(text,integer),public.fa_norm(text),public.book_isbn13(text) from public;
grant execute on function public.catalog_lookup_edition(text),public.catalog_search(text,integer),public.fa_norm(text),public.book_isbn13(text) to anon,authenticated;

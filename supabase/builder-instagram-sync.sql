-- DELSA site builder, step 4 of "Instagram posts -> products": new-post suggestions, change detection for imported posts and the
-- public "view on Instagram" button.
-- PENDING EXPLICIT APPROVAL: not applied to any real database. Requires builder-instagram.sql and builder-instagram-import.sql.
-- Tested on a local Postgres (supabase/tests/local-postgres/run.sh supabase/tests/builder-instagram-sync.sql).
--  * builder_instagram_suggestions: posts published AFTER the account was connected (stories excluded), found by the periodic check.
--    Nothing is created or published from them automatically; the customer imports or dismisses them.
--  * builder_instagram_imports gets source_state ('ok' | 'changed' | 'deleted') + the latest caption; a product is NEVER modified
--    automatically, the customer only sees a notice.
--  * show_link: owners can switch the public button off per product; the public may read only the permalink of published products.
-- Run once. Rollback: supabase/builder-instagram-sync-rollback.sql.
begin;
alter table public.builder_instagram_accounts add column last_checked_at timestamptz;
alter table public.builder_instagram_accounts add column last_seen_at timestamptz;
grant select(last_checked_at) on public.builder_instagram_accounts to authenticated;

alter table public.builder_instagram_imports add column source_state text not null default 'ok' check(source_state in ('ok','changed','deleted'));
alter table public.builder_instagram_imports add column latest_caption text check(latest_caption is null or length(latest_caption)<=2200);
alter table public.builder_instagram_imports add column checked_at timestamptz;
grant update(show_link,source_state,caption) on public.builder_instagram_imports to authenticated;
create policy owner_update on public.builder_instagram_imports for update to authenticated
 using(exists(select 1 from public.builder_sites s where s.id=builder_instagram_imports.site_id and s.owner_id=(select auth.uid())))
 with check(exists(select 1 from public.builder_sites s where s.id=builder_instagram_imports.site_id and s.owner_id=(select auth.uid())));
-- Public: only what the button needs, only for published products of live sites, only when the owner left it on and the post still exists
-- (source_state is used by the policy but is not readable by anon).
grant select(product_id,permalink,show_link) on public.builder_instagram_imports to anon;
create policy public_link on public.builder_instagram_imports for select to anon using(show_link and source_state<>'deleted' and permalink<>'' and exists(select 1 from public.builder_products p where p.id=product_id and p.site_id=builder_instagram_imports.site_id and p.status='published' and exists(select 1 from public.builder_publications b where b.site_id=p.site_id and b.is_live)));

create table public.builder_instagram_suggestions(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 account_row uuid not null references public.builder_instagram_accounts(id) on delete cascade,
 media_id text not null check(media_id~'^[0-9]{1,40}$'),
 kind text not null check(kind in ('image','carousel','video','reel')),
 caption text not null default '' check(length(caption)<=2200),
 permalink text not null default '' check(length(permalink)<=300),
 posted_at timestamptz,
 status text not null default 'new' check(status in ('new','dismissed','imported')),
 created_at timestamptz not null default now(),
 unique(account_row,media_id)
);
create index builder_instagram_suggestions_owner on public.builder_instagram_suggestions(owner_id,status);
alter table public.builder_instagram_suggestions enable row level security;
revoke all on public.builder_instagram_suggestions from public,anon,authenticated;
grant select on public.builder_instagram_suggestions to authenticated;
grant update(status) on public.builder_instagram_suggestions to authenticated;
create policy owner_read on public.builder_instagram_suggestions for select to authenticated using(owner_id=(select auth.uid()));
create policy owner_dismiss on public.builder_instagram_suggestions for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()) and status in ('new','dismissed'));

-- An import (into any site) closes the matching suggestion.
create or replace function private.builder_instagram_record_import(p_owner uuid,p_site uuid,p_product uuid,p_account uuid,p_media text,p_kind text,p_permalink text,p_posted timestamptz,p_caption text,p_videos jsonb) returns uuid language plpgsql security definer set search_path='' as $$
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
 update public.builder_instagram_suggestions set status='imported' where owner_id=p_owner and media_id=p_media and status<>'imported';
 return rid;
end $$;

-- Accounts whose periodic check is due (connected, not checked in the last 5.5 hours), oldest first.
create function private.builder_instagram_due_accounts(p_limit integer) returns table(id uuid,owner_id uuid) language sql security definer set search_path='' as $$
 select a.id,a.owner_id from public.builder_instagram_accounts a where a.status='connected' and (a.last_checked_at is null or a.last_checked_at<now()-interval '5 hours 30 minutes')
 order by a.last_checked_at nulls first limit greatest(1,least(coalesce(p_limit,20),50));
$$;
create function private.builder_instagram_sync_state(p_owner uuid,p_account uuid) returns table(connected_at timestamptz,last_checked_at timestamptz,last_seen_at timestamptz) language sql security definer set search_path='' as $$
 select a.connected_at,a.last_checked_at,a.last_seen_at from public.builder_instagram_accounts a where a.id=p_account and a.owner_id=p_owner and a.status='connected';
$$;
-- Stores the posts found by one check. Items are {id,kind,caption,permalink,posted_at}; posts already imported anywhere are skipped.
create function private.builder_instagram_record_sync(p_owner uuid,p_account uuid,p_seen timestamptz,p_items jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare it jsonb;n integer:=0;added integer;begin
 if not exists(select 1 from public.builder_instagram_accounts where id=p_account and owner_id=p_owner and status='connected') then raise exception 'builder_instagram_forbidden';end if;
 if p_items is not null and (jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>50) then raise exception 'builder_instagram_invalid';end if;
 for it in select value from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
  if coalesce(it->>'id','')!~'^[0-9]{1,40}$' or it->>'kind' not in ('image','carousel','video','reel') then continue;end if;
  if exists(select 1 from public.builder_instagram_imports i join public.builder_sites s on s.id=i.site_id where s.owner_id=p_owner and i.media_id=it->>'id') then continue;end if;
  insert into public.builder_instagram_suggestions(owner_id,account_row,media_id,kind,caption,permalink,posted_at) values(p_owner,p_account,it->>'id',it->>'kind',left(coalesce(it->>'caption',''),2200),left(coalesce(it->>'permalink',''),300),nullif(it->>'posted_at','')::timestamptz)
   on conflict(account_row,media_id) do nothing;
  get diagnostics added=row_count;n:=n+added;
 end loop;
 update public.builder_instagram_accounts set last_checked_at=now(),last_seen_at=greatest(coalesce(last_seen_at,p_seen),coalesce(p_seen,last_seen_at)) where id=p_account;
 return n;
end $$;
-- Imported posts of this account whose last check is older than 20 hours, oldest first.
create function private.builder_instagram_imports_due(p_owner uuid,p_account uuid,p_limit integer) returns table(id uuid,media_id text,caption text,source_state text,latest_caption text) language sql security definer set search_path='' as $$
 select i.id,i.media_id,i.caption,i.source_state,i.latest_caption from public.builder_instagram_imports i join public.builder_sites s on s.id=i.site_id
 where s.owner_id=p_owner and i.account_row=p_account and i.source_state<>'deleted' and (i.checked_at is null or i.checked_at<now()-interval '20 hours') order by i.checked_at nulls first limit greatest(1,least(coalesce(p_limit,10),25));
$$;
create function private.builder_instagram_record_check(p_owner uuid,p_import uuid,p_state text,p_latest text) returns void language plpgsql security definer set search_path='' as $$ begin
 if p_state not in ('ok','changed','deleted') then raise exception 'builder_instagram_invalid';end if;
 update public.builder_instagram_imports i set source_state=case when i.source_state='changed' and p_state='ok' then i.source_state else p_state end,
  latest_caption=case when p_state='changed' then left(p_latest,2200) else i.latest_caption end,checked_at=now()
  where i.id=p_import and exists(select 1 from public.builder_sites s where s.id=i.site_id and s.owner_id=p_owner);
end $$;

grant usage on schema private to service_role;
create function public.builder_instagram_due_accounts(p_limit integer) returns table(id uuid,owner_id uuid) language sql security invoker set search_path='' as $$ select * from private.builder_instagram_due_accounts(p_limit); $$;
create function public.builder_instagram_sync_state(p_owner uuid,p_account uuid) returns table(connected_at timestamptz,last_checked_at timestamptz,last_seen_at timestamptz) language sql security invoker set search_path='' as $$ select * from private.builder_instagram_sync_state(p_owner,p_account); $$;
create function public.builder_instagram_record_sync(p_owner uuid,p_account uuid,p_seen timestamptz,p_items jsonb) returns integer language sql security invoker set search_path='' as $$ select private.builder_instagram_record_sync(p_owner,p_account,p_seen,p_items); $$;
create function public.builder_instagram_imports_due(p_owner uuid,p_account uuid,p_limit integer) returns table(id uuid,media_id text,caption text,source_state text,latest_caption text) language sql security invoker set search_path='' as $$ select * from private.builder_instagram_imports_due(p_owner,p_account,p_limit); $$;
create function public.builder_instagram_record_check(p_owner uuid,p_import uuid,p_state text,p_latest text) returns void language sql security invoker set search_path='' as $$ select private.builder_instagram_record_check(p_owner,p_import,p_state,p_latest); $$;
revoke all on function public.builder_instagram_due_accounts(integer),public.builder_instagram_sync_state(uuid,uuid),public.builder_instagram_record_sync(uuid,uuid,timestamptz,jsonb),public.builder_instagram_imports_due(uuid,uuid,integer),public.builder_instagram_record_check(uuid,uuid,text,text),
 private.builder_instagram_due_accounts(integer),private.builder_instagram_sync_state(uuid,uuid),private.builder_instagram_record_sync(uuid,uuid,timestamptz,jsonb),private.builder_instagram_imports_due(uuid,uuid,integer),private.builder_instagram_record_check(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.builder_instagram_due_accounts(integer),public.builder_instagram_sync_state(uuid,uuid),public.builder_instagram_record_sync(uuid,uuid,timestamptz,jsonb),public.builder_instagram_imports_due(uuid,uuid,integer),public.builder_instagram_record_check(uuid,uuid,text,text),
 private.builder_instagram_due_accounts(integer),private.builder_instagram_sync_state(uuid,uuid),private.builder_instagram_record_sync(uuid,uuid,timestamptz,jsonb),private.builder_instagram_imports_due(uuid,uuid,integer),private.builder_instagram_record_check(uuid,uuid,text,text) to service_role;
revoke all on function private.builder_instagram_record_import(uuid,uuid,uuid,uuid,text,text,text,timestamptz,text,jsonb) from public,anon,authenticated;
grant execute on function private.builder_instagram_record_import(uuid,uuid,uuid,uuid,text,text,text,timestamptz,text,jsonb) to service_role;
commit;

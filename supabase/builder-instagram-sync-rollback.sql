-- Removes step-4 objects and restores the step-2 import function (which no longer touches the suggestions table).
begin;
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
 return rid;
end $$;
drop function if exists public.builder_instagram_due_accounts(integer),public.builder_instagram_sync_state(uuid,uuid),public.builder_instagram_record_sync(uuid,uuid,timestamptz,jsonb),public.builder_instagram_imports_due(uuid,uuid,integer),public.builder_instagram_record_check(uuid,uuid,text,text);
drop function if exists private.builder_instagram_due_accounts(integer),private.builder_instagram_sync_state(uuid,uuid),private.builder_instagram_record_sync(uuid,uuid,timestamptz,jsonb),private.builder_instagram_imports_due(uuid,uuid,integer),private.builder_instagram_record_check(uuid,uuid,text,text);
drop table if exists public.builder_instagram_suggestions;
drop policy if exists public_link on public.builder_instagram_imports;drop policy if exists owner_update on public.builder_instagram_imports;
revoke select(product_id,permalink,show_link) on public.builder_instagram_imports from anon;
revoke update(show_link,source_state,caption) on public.builder_instagram_imports from authenticated;
alter table public.builder_instagram_imports drop column if exists source_state,drop column if exists latest_caption,drop column if exists checked_at;
alter table public.builder_instagram_accounts drop column if exists last_checked_at,drop column if exists last_seen_at;
commit;

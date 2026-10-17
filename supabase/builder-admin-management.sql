-- Reversible admin deletion. Private order/customer records are retained.
alter table public.builder_sites add column deleted_at timestamptz;
create index builder_sites_active_owner_idx on public.builder_sites(owner_id,created_at desc) where deleted_at is null;
alter policy builder_sites_read on public.builder_sites using((deleted_at is null and owner_id=(select auth.uid())) or (select public.is_admin()));
alter policy builder_sites_update on public.builder_sites using(deleted_at is null and (owner_id=(select auth.uid()) or (select public.is_admin())) and (select public.has_site_builder_access())) with check(deleted_at is null and (owner_id=(select auth.uid()) or (select public.is_admin())) and (select public.has_site_builder_access()));
-- Inserts cannot sneak in an archived site; clients cannot update deleted_at.
alter policy builder_sites_insert on public.builder_sites with check(deleted_at is null and owner_id=(select auth.uid()) and (select public.has_site_builder_access()));
create function private.admin_archive_builder_site(p_site uuid,p_restore boolean,p_expected timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.builder_sites;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'admin_required' using errcode='42501';end if;
 select * into s from public.builder_sites where id=p_site for update;
 if not found then raise exception 'site_unavailable';end if;
 if p_expected is null or p_expected<>s.updated_at then raise exception 'site_changed';end if;
 if p_restore is null then raise exception 'restore_flag_required';end if;
 if (s.deleted_at is null)=p_restore then raise exception 'site_state_changed';end if;
 if not p_restore then update public.builder_publications set is_live=false where site_id=p_site;end if;
 update public.builder_sites set deleted_at=case when p_restore then null else now() end,updated_at=clock_timestamp() where id=p_site returning * into s;
 insert into public.builder_events(site_id,kind,entity_id,payload,actor_id) values(p_site,case when p_restore then 'site.restored' else 'site.archived' end,p_site,'{}',auth.uid());
 return to_jsonb(s);
end $$;
revoke all on function private.admin_archive_builder_site(uuid,boolean,timestamptz) from public,anon;
grant execute on function private.admin_archive_builder_site(uuid,boolean,timestamptz) to authenticated;
create function public.admin_archive_builder_site(p_site uuid,p_restore boolean,p_expected timestamptz) returns jsonb language sql security invoker set search_path='' as $$select private.admin_archive_builder_site(p_site,p_restore,p_expected)$$;
revoke all on function public.admin_archive_builder_site(uuid,boolean,timestamptz) from public,anon;
grant execute on function public.admin_archive_builder_site(uuid,boolean,timestamptz) to authenticated;
-- Serialize writes with archive/restore, including publication and checkout.
create function private.builder_require_active_site() returns trigger language plpgsql security definer set search_path='' as $$
declare archived timestamptz;
begin
 select deleted_at into archived from public.builder_sites where id=new.site_id for share;
 if not found or archived is not null then raise exception 'site_archived' using errcode='42501';end if;
 return new;
end $$;
revoke all on function private.builder_require_active_site() from public,anon,authenticated;
do $$declare t text;begin
 foreach t in array array['builder_publications','builder_versions','builder_customers','builder_products','builder_variants','builder_shop_settings','builder_coupons','builder_orders','builder_order_items'] loop
 execute format('create trigger builder_active_site before insert or update on public.%I for each row execute function private.builder_require_active_site()',t);
 end loop;
end $$;

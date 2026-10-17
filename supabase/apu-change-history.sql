-- Shared APU settings with an immutable audit trail and per-admin read cursor.
alter table public.apu_sources add column if not exists deleted_at timestamptz;
alter table public.apu_rules add column if not exists deleted_at timestamptz;
create table public.apu_change_history (
 id bigint generated always as identity primary key,
 user_id uuid not null references public.profiles(id) on delete cascade,
 actor_id uuid references public.profiles(id) on delete set null,
 entity text not null check (entity in ('apu_sources','apu_rules')),
 record_id uuid not null,
 operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
 before_data jsonb,
 after_data jsonb,
 created_at timestamptz not null default clock_timestamp()
);
create index apu_change_history_customer_idx on public.apu_change_history(user_id,id desc);
alter table public.apu_change_history enable row level security;
revoke all on public.apu_change_history from anon,authenticated;
grant select on public.apu_change_history to authenticated;
create policy "Admins read APU history" on public.apu_change_history for select to authenticated using ((select public.is_admin()));
create table public.apu_history_reads (
 admin_id uuid not null references public.profiles(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 last_seen_id bigint not null default 0 check (last_seen_id >= 0),
 primary key (admin_id,user_id)
);
alter table public.apu_history_reads enable row level security;
revoke all on public.apu_history_reads from anon,authenticated;
grant select,insert,update on public.apu_history_reads to authenticated;
create policy "Admins manage own APU read cursor" on public.apu_history_reads for all to authenticated using (admin_id=(select auth.uid()) and (select public.is_admin())) with check (admin_id=(select auth.uid()) and (select public.is_admin()));
create schema if not exists private;
create function private.audit_apu_settings() returns trigger language plpgsql security definer set search_path='' as $$
declare old_data jsonb; new_data jsonb; target uuid; op text:=TG_OP;
begin
 if TG_OP <> 'INSERT' then old_data:=to_jsonb(OLD); end if;
 if TG_OP <> 'DELETE' then new_data:=to_jsonb(NEW); end if;
 target:=coalesce(new_data,old_data)->>'user_id';
 if not exists(select 1 from public.profiles where id=target) then
  if TG_OP='DELETE' then return OLD; end if; return NEW;
 end if;
 if auth.uid() is not null and auth.uid()<>target and not public.is_admin() then raise exception 'Unauthorized APU change'; end if;
 if TG_OP='UPDATE' and (old_data-'updated_at')=(new_data-'updated_at') then return NEW; end if;
 if TG_OP='UPDATE' and OLD.deleted_at is null and NEW.deleted_at is not null then op:='DELETE'; end if;
 insert into public.apu_change_history(user_id,actor_id,entity,record_id,operation,before_data,after_data)
 values(target,auth.uid(),TG_TABLE_NAME,(coalesce(new_data,old_data)->>'id')::uuid,op,old_data,new_data);
 if TG_OP='DELETE' then return OLD; end if;
 return NEW;
end $$;
revoke all on function private.audit_apu_settings() from public,anon,authenticated;
create trigger audit_apu_sources after insert or update or delete on public.apu_sources for each row execute function private.audit_apu_settings();
create trigger audit_apu_rules after insert or update or delete on public.apu_rules for each row execute function private.audit_apu_settings();

create function private.monotonic_apu_read() returns trigger language plpgsql set search_path='' as $$ begin NEW.last_seen_id:=greatest(OLD.last_seen_id,NEW.last_seen_id); return NEW; end $$;
revoke all on function private.monotonic_apu_read() from public,anon,authenticated;
create trigger monotonic_apu_read before update on public.apu_history_reads for each row execute function private.monotonic_apu_read();
create function public.admin_apu_change_summary() returns table(user_id uuid,unread_count bigint) language sql stable security invoker set search_path='' as $$
 select h.user_id,count(*) from public.apu_change_history h left join public.apu_history_reads r on r.user_id=h.user_id and r.admin_id=(select auth.uid()) where (select public.is_admin()) and h.id>coalesce(r.last_seen_id,0) group by h.user_id;
$$;
revoke all on function public.admin_apu_change_summary() from public,anon;
grant execute on function public.admin_apu_change_summary() to authenticated;

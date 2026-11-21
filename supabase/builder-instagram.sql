-- DELSA site builder: Instagram connection used to read a customer's own posts, reels and stories (import as products).
-- PENDING EXPLICIT APPROVAL: not applied to any real database. Tested on a local Postgres
-- (supabase/tests/local-postgres/run.sh supabase/tests/builder-instagram.sql).
--
-- Design
--  * Separate from the CRM connector (crm_channel_connections): no webhook subscription, no message intake, no CRM entitlement.
--    The server checks has_site_builder_access() with the customer's session BEFORE calling the service-only functions below.
--  * Access tokens are encrypted by the application (AES-256-GCM, PLATFORM_CREDENTIALS_ENCRYPTION_KEY) and live only in
--    private.builder_instagram_tokens; no browser role can read them. The browser only sees username/status/expiry.
--  * One owner may connect several Instagram accounts (max 5); the same account can be connected by different owners only
--    through their own Instagram login, so tokens never cross customers.
-- Run once. Rollback: supabase/builder-instagram-rollback.sql.
begin;
create schema if not exists private;
create table public.builder_instagram_accounts(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 account_id text not null check(account_id~'^[0-9]{1,40}$'),
 username text not null default '' check(length(username)<=80),
 status text not null default 'connected' check(status in ('connected','expired','disconnected')),
 expires_at timestamptz,
 connected_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(owner_id,account_id)
);
create index builder_instagram_accounts_owner on public.builder_instagram_accounts(owner_id,status);
alter table public.builder_instagram_accounts enable row level security;
revoke all on public.builder_instagram_accounts from public,anon,authenticated;
grant select(id,owner_id,username,status,expires_at,connected_at) on public.builder_instagram_accounts to authenticated;
create policy own_read on public.builder_instagram_accounts for select to authenticated using(owner_id=(select auth.uid()) or (select public.is_admin()));

create table private.builder_instagram_tokens(
 account_row uuid primary key references public.builder_instagram_accounts(id) on delete cascade,
 ciphertext text not null check(length(ciphertext) between 20 and 4000),
 updated_at timestamptz not null default now()
);
alter table private.builder_instagram_tokens enable row level security;
revoke all on private.builder_instagram_tokens from public,anon,authenticated;

create function private.builder_connect_instagram(p_owner uuid,p_account text,p_username text,p_ciphertext text,p_expires timestamptz) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;n integer;begin
 if p_account is null or p_account!~'^[0-9]{1,40}$' or p_ciphertext is null or length(p_ciphertext)<20 or p_expires is null or p_expires<=now() then raise exception 'builder_instagram_invalid';end if;
 if not exists(select 1 from public.profiles where id=p_owner) then raise exception 'builder_instagram_invalid';end if;
 perform pg_advisory_xact_lock(hashtextextended('builder-instagram-'||p_owner::text,0));
 select count(*) into n from public.builder_instagram_accounts where owner_id=p_owner and status<>'disconnected' and account_id<>p_account;
 if n>=5 then raise exception 'builder_instagram_limit';end if;
 insert into public.builder_instagram_accounts(owner_id,account_id,username,status,expires_at) values(p_owner,p_account,left(coalesce(p_username,''),80),'connected',p_expires)
 on conflict(owner_id,account_id) do update set username=excluded.username,status='connected',expires_at=excluded.expires_at,updated_at=now() returning id into rid;
 insert into private.builder_instagram_tokens(account_row,ciphertext) values(rid,p_ciphertext) on conflict(account_row) do update set ciphertext=excluded.ciphertext,updated_at=now();
 return rid;
end $$;
create function private.builder_disconnect_instagram(p_owner uuid,p_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 update public.builder_instagram_accounts set status='disconnected',updated_at=now() where id=p_id and owner_id=p_owner;
 delete from private.builder_instagram_tokens t using public.builder_instagram_accounts a where t.account_row=a.id and a.id=p_id and a.owner_id=p_owner;
end $$;
-- The sealed token of a CONNECTED, unexpired-or-refreshable account of this owner; empty for anything else.
create function private.builder_instagram_token(p_owner uuid,p_id uuid) returns table(account_id text,username text,ciphertext text,expires_at timestamptz) language sql security definer set search_path='' as $$
 select a.account_id,a.username,t.ciphertext,a.expires_at from public.builder_instagram_accounts a join private.builder_instagram_tokens t on t.account_row=a.id
 where a.id=p_id and a.owner_id=p_owner and a.status='connected';
$$;
create function private.builder_instagram_store_token(p_owner uuid,p_id uuid,p_ciphertext text,p_expires timestamptz) returns boolean language plpgsql security definer set search_path='' as $$ begin
 if p_ciphertext is null or length(p_ciphertext)<20 or p_expires is null or p_expires<=now() then return false;end if;
 update public.builder_instagram_accounts set expires_at=p_expires,status='connected',updated_at=now() where id=p_id and owner_id=p_owner and status in ('connected','expired');
 if not found then return false;end if;
 insert into private.builder_instagram_tokens(account_row,ciphertext) values(p_id,p_ciphertext) on conflict(account_row) do update set ciphertext=excluded.ciphertext,updated_at=now();
 return true;
end $$;
create function private.builder_instagram_mark_expired(p_owner uuid,p_id uuid) returns void language sql security definer set search_path='' as $$
 update public.builder_instagram_accounts set status='expired',updated_at=now() where id=p_id and owner_id=p_owner and status='connected';
$$;

-- Public wrappers are invoker-only entry points for the authenticated server bridge (service_role).
grant usage on schema private to service_role;
create function public.builder_connect_instagram(p_owner uuid,p_account text,p_username text,p_ciphertext text,p_expires timestamptz) returns uuid language sql security invoker set search_path='' as $$ select private.builder_connect_instagram(p_owner,p_account,p_username,p_ciphertext,p_expires); $$;
create function public.builder_disconnect_instagram(p_owner uuid,p_id uuid) returns void language sql security invoker set search_path='' as $$ select private.builder_disconnect_instagram(p_owner,p_id); $$;
create function public.builder_instagram_token(p_owner uuid,p_id uuid) returns table(account_id text,username text,ciphertext text,expires_at timestamptz) language sql security invoker set search_path='' as $$ select * from private.builder_instagram_token(p_owner,p_id); $$;
create function public.builder_instagram_store_token(p_owner uuid,p_id uuid,p_ciphertext text,p_expires timestamptz) returns boolean language sql security invoker set search_path='' as $$ select private.builder_instagram_store_token(p_owner,p_id,p_ciphertext,p_expires); $$;
create function public.builder_instagram_mark_expired(p_owner uuid,p_id uuid) returns void language sql security invoker set search_path='' as $$ select private.builder_instagram_mark_expired(p_owner,p_id); $$;
revoke all on function public.builder_connect_instagram(uuid,text,text,text,timestamptz),public.builder_disconnect_instagram(uuid,uuid),public.builder_instagram_token(uuid,uuid),public.builder_instagram_store_token(uuid,uuid,text,timestamptz),public.builder_instagram_mark_expired(uuid,uuid) from public,anon,authenticated;
grant execute on function public.builder_connect_instagram(uuid,text,text,text,timestamptz),public.builder_disconnect_instagram(uuid,uuid),public.builder_instagram_token(uuid,uuid),public.builder_instagram_store_token(uuid,uuid,text,timestamptz),public.builder_instagram_mark_expired(uuid,uuid) to service_role;
revoke all on function private.builder_connect_instagram(uuid,text,text,text,timestamptz),private.builder_disconnect_instagram(uuid,uuid),private.builder_instagram_token(uuid,uuid),private.builder_instagram_store_token(uuid,uuid,text,timestamptz),private.builder_instagram_mark_expired(uuid,uuid) from public,anon,authenticated;
grant execute on function private.builder_connect_instagram(uuid,text,text,text,timestamptz),private.builder_disconnect_instagram(uuid,uuid),private.builder_instagram_token(uuid,uuid),private.builder_instagram_store_token(uuid,uuid,text,timestamptz),private.builder_instagram_mark_expired(uuid,uuid) to service_role;
commit;

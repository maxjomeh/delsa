-- Instagram connector storage and scoped intake. No credentials are seeded.
begin;
create table public.crm_channel_connections(id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.profiles(id),channel text not null check(channel='instagram'),account_id text not null unique check(account_id~'^[0-9]{1,40}$'),username text not null default '' check(length(username)<=80),status text not null default 'connected' check(status in ('connected','disconnected')),expires_at timestamptz not null,last_received_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(tenant_id,id));
alter table public.crm_channel_connections enable row level security;
revoke all on public.crm_channel_connections from public,anon,authenticated;
grant select on public.crm_channel_connections to authenticated;
create policy own_read on public.crm_channel_connections for select to authenticated using(tenant_id=(select auth.uid()) or (select public.is_admin()));
create table private.crm_channel_tokens(connection_id uuid primary key references public.crm_channel_connections(id),ciphertext text not null check(length(ciphertext) between 20 and 10000));
alter table private.crm_channel_tokens enable row level security;
revoke all on private.crm_channel_tokens from public,anon,authenticated;
create table public.crm_channel_identities(id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.profiles(id),customer_id uuid not null,connection_id uuid not null,remote_user_id text not null check(remote_user_id~'^[0-9]{1,40}$'),created_at timestamptz not null default now(),foreign key(tenant_id,customer_id) references public.crm_customers(tenant_id,id),foreign key(tenant_id,connection_id) references public.crm_channel_connections(tenant_id,id),unique(connection_id,remote_user_id));
create index crm_identity_customer on public.crm_channel_identities(tenant_id,customer_id);
alter table public.crm_channel_identities enable row level security;
revoke all on public.crm_channel_identities from public,anon,authenticated;
grant select on public.crm_channel_identities to authenticated;
create policy own_read on public.crm_channel_identities for select to authenticated using(tenant_id=(select auth.uid()) or (select public.is_admin()));
create function private.crm_connect_instagram(p_tenant uuid,p_account text,p_username text,p_ciphertext text,p_expires timestamptz) returns uuid language plpgsql security definer set search_path='' as $$ declare cid uuid;existingtenant uuid;begin
 if not exists(select 1 from public.customer_subscriptions s join public.store_products p on p.id=s.product_id where s.customer_id=p_tenant and p.service_code='crm' and s.starts_at<=now() and s.expires_at>now()) then raise exception 'crm_access_denied';end if;
 perform pg_advisory_xact_lock(hashtextextended('instagram-account-'||p_account,0));
 select tenant_id,id into existingtenant,cid from public.crm_channel_connections where account_id=p_account;
 if existingtenant is not null and existingtenant<>p_tenant then raise exception 'crm_account_already_connected';end if;
 insert into public.crm_channel_connections(tenant_id,channel,account_id,username,expires_at) values(p_tenant,'instagram',p_account,p_username,p_expires)
 on conflict(account_id) do update set username=excluded.username,status='connected',expires_at=excluded.expires_at,updated_at=now() returning id into cid;
 insert into private.crm_channel_tokens(connection_id,ciphertext) values(cid,p_ciphertext) on conflict(connection_id) do update set ciphertext=excluded.ciphertext;
 return cid;
end $$;
create function private.crm_disconnect_instagram(p_tenant uuid,p_connection uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 update public.crm_channel_connections set status='disconnected',updated_at=now() where id=p_connection and tenant_id=p_tenant;
 delete from private.crm_channel_tokens t using public.crm_channel_connections c where t.connection_id=c.id and c.id=p_connection and c.tenant_id=p_tenant;
end $$;
create function private.crm_receive_instagram(p_account text,p_sender text,p_event text,p_body text,p_occurred timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare conn public.crm_channel_connections;cid uuid;mid uuid;eventkey text;begin
 select * into conn from public.crm_channel_connections where account_id=p_account and status='connected' and expires_at>now() for update;
 if not found then return jsonb_build_object('ignored',true,'reason','connection_unavailable');end if;
 if not exists(select 1 from public.customer_subscriptions s join public.store_products p on p.id=s.product_id where s.customer_id=conn.tenant_id and p.service_code='crm' and s.starts_at<=now() and s.expires_at>now()) then return jsonb_build_object('ignored',true,'reason','subscription_inactive');end if;
 if p_sender!~'^[0-9]{1,40}$' or p_event is null or length(p_event) not between 1 and 180 or p_body is null or length(trim(p_body)) not between 1 and 8000 or p_occurred is null or p_occurred>now()+interval '5 minutes' then raise exception 'crm_invalid_event';end if;
 eventkey=p_account||':'||p_event;
 select id,customer_id into mid,cid from public.crm_interactions where tenant_id=conn.tenant_id and channel='instagram' and external_event_id=eventkey;
 if found then return jsonb_build_object('interaction_id',mid,'customer_id',cid,'duplicate',true);end if;
 select customer_id into cid from public.crm_channel_identities where connection_id=conn.id and remote_user_id=p_sender;
 if cid is null then
  insert into public.crm_customers(tenant_id,name) values(conn.tenant_id,'مخاطب اینستاگرام '||right(p_sender,6)) returning id into cid;
  insert into public.crm_channel_identities(tenant_id,customer_id,connection_id,remote_user_id) values(conn.tenant_id,cid,conn.id,p_sender);
 end if;
 insert into public.crm_interactions(tenant_id,customer_id,channel,direction,kind,body,external_event_id,occurred_at) values(conn.tenant_id,cid,'instagram','inbound','message',p_body,eventkey,p_occurred) returning id into mid;
 update public.crm_channel_connections set last_received_at=greatest(coalesce(last_received_at,p_occurred),p_occurred),updated_at=now() where id=conn.id;
 return jsonb_build_object('interaction_id',mid,'customer_id',cid,'duplicate',false);
end $$;
-- Privileged functions stay in the unexposed schema. Public wrappers are invoker-only.
grant usage on schema private to service_role;
create function public.crm_connect_instagram(p_tenant uuid,p_account text,p_username text,p_ciphertext text,p_expires timestamptz) returns uuid language sql security invoker set search_path='' as $$ select private.crm_connect_instagram(p_tenant,p_account,p_username,p_ciphertext,p_expires); $$;
create function public.crm_disconnect_instagram(p_tenant uuid,p_connection uuid) returns void language sql security invoker set search_path='' as $$ select private.crm_disconnect_instagram(p_tenant,p_connection); $$;
create function public.crm_receive_instagram(p_account text,p_sender text,p_event text,p_body text,p_occurred timestamptz) returns jsonb language sql security invoker set search_path='' as $$ select private.crm_receive_instagram(p_account,p_sender,p_event,p_body,p_occurred); $$;
revoke all on function public.crm_connect_instagram(uuid,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.crm_disconnect_instagram(uuid,uuid) from public,anon,authenticated;
revoke all on function public.crm_receive_instagram(text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.crm_connect_instagram(uuid,text,text,text,timestamptz) to service_role;
grant execute on function public.crm_disconnect_instagram(uuid,uuid) to service_role;
grant execute on function public.crm_receive_instagram(text,text,text,text,timestamptz) to service_role;
-- These entry points accept a tenant/account only from the authenticated server bridge.
revoke all on function private.crm_connect_instagram(uuid,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function private.crm_disconnect_instagram(uuid,uuid) from public,anon,authenticated;
revoke all on function private.crm_receive_instagram(text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function private.crm_connect_instagram(uuid,text,text,text,timestamptz) to service_role;
grant execute on function private.crm_disconnect_instagram(uuid,uuid) to service_role;
grant execute on function private.crm_receive_instagram(text,text,text,text,timestamptz) to service_role;
commit;

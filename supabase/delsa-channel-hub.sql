-- DELSA Channel Hub / Instagram v1.
-- Additive schema; no existing accounts, tokens, messages or CRM data are modified.
-- Only the business owner can read connection permissions. Mutations are server-only
-- after session + subscription + connection ownership checks in /api/channels.
begin;

create table if not exists public.delsa_channel_grants (
 connection_id uuid not null,
 tenant_id uuid not null references public.profiles(id) on delete cascade,
 service_code text not null check (service_code in ('crm','dorpin')),
 allowed boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key (connection_id,service_code),
 foreign key (tenant_id,connection_id)
   references public.crm_channel_connections(tenant_id,id) on delete cascade
);
create index if not exists delsa_channel_grants_tenant
 on public.delsa_channel_grants(tenant_id,service_code);
alter table public.delsa_channel_grants enable row level security;
revoke all on public.delsa_channel_grants from public,anon,authenticated;
grant select on public.delsa_channel_grants to authenticated;
grant select,insert,update,delete on public.delsa_channel_grants to service_role;
drop policy if exists delsa_channel_grants_owner_read on public.delsa_channel_grants;
create policy delsa_channel_grants_owner_read
 on public.delsa_channel_grants for select to authenticated
 using (tenant_id = (select auth.uid()));

-- Enforce grant in the actual transactional intake. A server API gate alone
-- creates a race with disconnect/revoke; this check locks the connected account
-- and re-checks the permission in the same transaction as the CRM write.
create or replace function private.crm_receive_instagram(
 p_account text,p_sender text,p_event text,p_body text,p_occurred timestamptz
) returns jsonb language plpgsql security definer set search_path='' as $$
declare conn public.crm_channel_connections; cid uuid; mid uuid; eventkey text;
begin
 select * into conn
   from public.crm_channel_connections
   where account_id=p_account and status='connected' and expires_at>now()
   for update;
 if not found then
   return jsonb_build_object('ignored',true,'reason','connection_unavailable');
 end if;

 if not exists(
   select 1 from public.delsa_channel_grants g
   where g.connection_id=conn.id and g.tenant_id=conn.tenant_id
     and g.service_code='crm' and g.allowed=true
 ) then
   return jsonb_build_object('ignored',true,'reason','service_grant_disabled');
 end if;

 if not exists(
   select 1 from public.customer_subscriptions s
   join public.store_products p on p.id=s.product_id
   where s.customer_id=conn.tenant_id and p.service_code='crm'
     and s.starts_at<=now() and s.expires_at>now()
 ) then
   return jsonb_build_object('ignored',true,'reason','subscription_inactive');
 end if;

 if p_sender!~'^[0-9]{1,40}$'
   or p_event is null or length(p_event) not between 1 and 180
   or p_body is null or length(trim(p_body)) not between 1 and 8000
   or p_occurred is null or p_occurred>now()+interval '5 minutes'
 then
   raise exception 'crm_invalid_event';
 end if;

 eventkey=p_account||':'||p_event;
 select id,customer_id into mid,cid
   from public.crm_interactions
   where tenant_id=conn.tenant_id and channel='instagram'
     and external_event_id=eventkey;
 if found then
   return jsonb_build_object('interaction_id',mid,'customer_id',cid,'duplicate',true);
 end if;

 select customer_id into cid
   from public.crm_channel_identities
   where connection_id=conn.id and remote_user_id=p_sender;
 if cid is null then
   insert into public.crm_customers(tenant_id,name)
   values(conn.tenant_id,'مخاطب اینستاگرام '||right(p_sender,6))
   returning id into cid;
   insert into public.crm_channel_identities(
     tenant_id,customer_id,connection_id,remote_user_id
   ) values(conn.tenant_id,cid,conn.id,p_sender);
 end if;

 insert into public.crm_interactions(
   tenant_id,customer_id,channel,direction,kind,body,external_event_id,occurred_at
 ) values(conn.tenant_id,cid,'instagram','inbound','message',p_body,eventkey,p_occurred)
 returning id into mid;

 update public.crm_channel_connections
   set last_received_at=greatest(coalesce(last_received_at,p_occurred),p_occurred),
       updated_at=now()
   where id=conn.id;

 return jsonb_build_object(
   'interaction_id',mid,'customer_id',cid,'duplicate',false
 );
end $$;
revoke all on function private.crm_receive_instagram(text,text,text,text,timestamptz)
 from public,anon,authenticated;
grant execute on function private.crm_receive_instagram(text,text,text,text,timestamptz)
 to service_role;
commit;

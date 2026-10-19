-- CIMA phase 2: Instagram HUMAN-ONLY outbound, pessimistic error handling.
-- Never enqueue automated AI sends. No worker retries ambiguous deliveries.
begin;
create table if not exists public.sima_message_outbox(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.profiles(id),
 review_id uuid not null,
 customer_id uuid not null,
 account_id text not null check(account_id~'^[a-f0-9]{24}$'),
 conversation_id text not null check(length(conversation_id) between 1 and 255),
 channel text not null default 'instagram' check(channel='instagram'),
 body text not null check(length(btrim(body)) between 1 and 4000),
 conversation_version bigint not null check(conversation_version>0),
 status text not null default 'pending' check(status in ('pending','sending','accepted','rejected','unknown')),
 attempt_count integer not null default 0 check(attempt_count between 0 and 1),
 provider_message_id text check(length(provider_message_id)<=255),
 provider_error_code text check(length(provider_error_code)<=100),
 requested_at timestamptz not null default now(),
 sent_at timestamptz,
 updated_at timestamptz not null default now(),
 unique(tenant_id,id),
 unique(tenant_id,review_id,conversation_version),
 foreign key(tenant_id,review_id) references public.sima_human_review_cases(tenant_id,id),
 foreign key(tenant_id,customer_id) references public.crm_customers(tenant_id,id)
);
create index if not exists sima_outbox_status_tenant on public.sima_message_outbox(tenant_id,status,requested_at desc);
alter table public.sima_message_outbox enable row level security;
revoke all on public.sima_message_outbox from public,anon,authenticated;
grant select,insert,update on public.sima_message_outbox to service_role;

-- Authenticated request creates ONE unique outbox item per customer turn, with
-- an exact verified inbound provider message as the send's anchor.
create or replace function public.sima_prepare_human_send(p_review_id uuid,p_version bigint,p_body text)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
 v_case public.sima_human_review_cases%rowtype;
 v_customer public.crm_customers%rowtype;
 v_message public.crm_interactions%rowtype;
 v_id uuid;v_conversation text;v_contact text;
begin
 if auth.uid() is null or not public.has_active_crm() then raise exception 'crm_access_denied';end if;
 if p_body is null or length(btrim(p_body))<1 or length(p_body)>4000
    or p_version is null or p_version<1 then raise exception 'invalid_human_reply';end if;
 select * into v_case from public.sima_human_review_cases
 where id=p_review_id and tenant_id=auth.uid() for update;
 if not found then raise exception 'review_not_found';end if;
 if v_case.channel<>'instagram' then raise exception 'channel_not_enabled';end if;
 if v_case.conversation_version<>p_version or v_case.state not in('awaiting_human','drafting') then
  raise exception 'conversation_stale_or_locked';end if;
 select * into v_customer from public.crm_customers
 where id=v_case.customer_id and tenant_id=v_case.tenant_id for update;
 if not found or v_customer.do_not_contact then raise exception 'contact_forbidden';end if;
 select * into v_message from public.crm_interactions
 where tenant_id=v_case.tenant_id and id=v_case.last_message_id
  and customer_id=v_case.customer_id and channel='instagram'
  and kind='message' and direction='inbound';
 if not found or v_message.occurred_at<>v_case.last_occurred_at then raise exception 'missing_inbound_anchor';end if;
 -- Conservative Instagram policy: permit manual session messages ONLY within
 -- 23 hours of the customer's latest verifiable inbound, no HUMAN_AGENT tag.
 if v_message.occurred_at<now()-interval '23 hours'
  or v_message.occurred_at>now()+interval '5 minutes' then raise exception 'reply_window_closed';end if;
 if exists(select 1 from public.crm_interactions i
   where i.tenant_id=v_case.tenant_id and i.customer_id=v_case.customer_id
    and i.channel='instagram' and i.kind='message' and i.direction='outbound'
    and i.occurred_at>v_message.occurred_at)
   then raise exception 'newer_business_reply_exists';end if;
 if exists(select 1 from public.sima_message_outbox s
  where s.tenant_id=v_case.tenant_id and s.review_id=v_case.id
   and s.conversation_version=v_case.conversation_version) then
   raise exception 'turn_already_has_send';end if;
 select c.participant_id into v_contact from public.crm_zernio_contacts c
  where c.tenant_id=v_case.tenant_id and c.customer_id=v_case.customer_id
   and c.account_id=v_case.account_id and c.platform='instagram' limit 1;
 if v_contact is null then raise exception 'channel_identity_not_verified';end if;
 select e.payload->'conversation'->>'id' into v_conversation
 from public.crm_zernio_events e join public.crm_zernio_profiles p
  on p.tenant_id=e.tenant_id and p.profile_id=e.profile_id
 where e.tenant_id=v_case.tenant_id and e.account_id=v_case.account_id
   and e.event_type='message.received'
   and e.payload->'account'->>'platform'='instagram'
   and e.payload->'conversation'->>'participantId'=v_contact
   and v_message.external_event_id='zernio-msg:'||md5(e.account_id||':'||
       coalesce(nullif(e.payload->'message'->>'id',''),e.event_id::text))
 order by e.received_at desc limit 1;
 if v_conversation is null or length(v_conversation)>255 or length(v_conversation)<1 then
  raise exception 'trusted_conversation_missing';end if;
 insert into public.sima_message_outbox(tenant_id,review_id,customer_id,account_id,conversation_id,body,conversation_version)
 values(v_case.tenant_id,v_case.id,v_case.customer_id,v_case.account_id,v_conversation,btrim(p_body),p_version)
 returning id into v_id;
 return jsonb_build_object('outbox_id',v_id,'queued',true);
end $function$;
revoke all on function public.sima_prepare_human_send(uuid,bigint,text) from public,anon;
grant execute on function public.sima_prepare_human_send(uuid,bigint,text) to authenticated;

-- The server may claim each send exactly ONCE, in an atomic transaction.
-- Concurrent requests lose the CAS race and cannot contact the provider.
create or replace function public.sima_claim_human_send(p_outbox_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare o public.sima_message_outbox%rowtype;r public.sima_human_review_cases%rowtype;
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' then raise exception 'service_role_required';end if;
 select * into o from public.sima_message_outbox where id=p_outbox_id for update;
 if not found or o.status<>'pending' or o.attempt_count<>0 then return null;end if;
 select * into r from public.sima_human_review_cases
 where tenant_id=o.tenant_id and id=o.review_id for update;
 if not found or r.conversation_version<>o.conversation_version or
 r.state not in('awaiting_human','drafting') then
  update public.sima_message_outbox set status='rejected',provider_error_code='conversation_stale',updated_at=now() where id=o.id;
  return null;
 end if;
 if exists(select 1 from public.crm_customers where tenant_id=o.tenant_id
    and id=o.customer_id and do_not_contact=true) then
  update public.sima_message_outbox set status='rejected',provider_error_code='contact_opted_out',updated_at=now() where id=o.id;
  return null;
 end if;
 if r.last_occurred_at<now()-interval '23 hours' or r.last_occurred_at>now()+interval '5 minutes' then
  update public.sima_message_outbox set status='rejected',provider_error_code='window_closed',updated_at=now() where id=o.id;
  return null;
 end if;
 update public.sima_message_outbox
 set status='sending',attempt_count=1,updated_at=now() where id=o.id;
 return jsonb_build_object('id',o.id,'tenant_id',o.tenant_id,'account_id',o.account_id,
  'conversation_id',o.conversation_id,'body',o.body,'review_id',o.review_id,
  'conversation_version',o.conversation_version);
end $function$;
revoke all on function public.sima_claim_human_send(uuid) from public,anon,authenticated;
grant execute on function public.sima_claim_human_send(uuid) to service_role;

-- A timeout/crash while dispatching is UNKNOWN, never automatically retried.
create or replace function public.sima_mark_unfinished_unknown()
returns integer language plpgsql security definer set search_path='' as $function$
declare n integer;
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' then raise exception 'service_role_required';end if;
 update public.sima_message_outbox set status='unknown',provider_error_code='dispatcher_timeout',updated_at=now()
 where status='sending' and updated_at<now()-interval '3 minutes';
 get diagnostics n=row_count;return n;
end $function$;
revoke all on function public.sima_mark_unfinished_unknown() from public,anon,authenticated;
grant execute on function public.sima_mark_unfinished_unknown() to service_role;
commit;
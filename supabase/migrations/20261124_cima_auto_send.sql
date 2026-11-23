-- CIMA phase 4: AUTOMATIC replies for topics the owner has allowed. Additive; run after 20261122 and 20261123.
-- The human outbox (20261019) was designed "never enqueue automated AI sends". This migration changes that on purpose and
-- narrowly: automatic sends use their OWN service-only entry points, which re-verify, inside the database, everything that
-- matters even if application code is wrong:
--   * the tenant has an active CRM subscription and automatic replies are ON and not paused;
--   * the topic is active, in stage 'auto', and not never-auto;
--   * the text is EXACTLY the answer of an approved, unexpired knowledge entry (no free text can be sent);
--   * hourly / per-customer caps;
--   * every rule the human path enforces (23 h window, opt-out, no newer business reply, one send per turn, verified identity).
-- Ambiguous deliveries are never retried (same pessimistic model as the human path).
begin;

alter table public.sima_autonomy_settings add column if not exists auto_hourly_cap integer not null default 20 check(auto_hourly_cap between 1 and 200);
alter table public.sima_autonomy_settings add column if not exists auto_customer_daily_cap integer not null default 3 check(auto_customer_daily_cap between 1 and 20);
alter table public.sima_message_outbox add column if not exists actor text not null default 'human' check(actor in('human','cima_auto'));

-- One decision per customer turn: automatic, dry-run or blocked. Every decision is audited with its reasons.
create table if not exists public.sima_auto_answers(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.profiles(id),
 review_id uuid not null,
 customer_id uuid not null,
 topic_id uuid not null,
 knowledge_entry_id uuid,
 knowledge_revision integer,
 conversation_version bigint not null check(conversation_version>0),
 mode text not null check(mode in('dry_run','live')),
 status text not null check(status in('blocked','dry_run','queued','sent','rejected','unknown','failed')),
 reasons jsonb not null default '[]' check(jsonb_typeof(reasons)='array' and octet_length(reasons::text)<=4000),
 answer_text text check(answer_text is null or length(btrim(answer_text)) between 1 and 4000),
 confidence_lower_bound numeric(4,3),
 threshold numeric(4,3),
 outbox_id uuid,
 wrong_marked_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,id),
 unique(tenant_id,review_id,conversation_version),
 foreign key(tenant_id,review_id) references public.sima_human_review_cases(tenant_id,id),
 foreign key(tenant_id,customer_id) references public.crm_customers(tenant_id,id),
 foreign key(tenant_id,topic_id) references public.sima_topics(tenant_id,id),
 check(status not in('queued','sent') or (answer_text is not null and knowledge_entry_id is not null and mode='live'))
);
create index if not exists sima_auto_answers_scope_idx on public.sima_auto_answers(tenant_id,created_at desc);
create index if not exists sima_auto_answers_customer_idx on public.sima_auto_answers(tenant_id,customer_id,created_at desc);

-- A decision's identity never changes, and a final status is final (an 'unknown' delivery may later be resolved).
create or replace function public.sima_auto_answers_guard() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='UPDATE' then
  if new.tenant_id<>old.tenant_id or new.review_id<>old.review_id or new.customer_id<>old.customer_id or new.topic_id<>old.topic_id
     or new.conversation_version<>old.conversation_version or new.mode<>old.mode
     or new.answer_text is distinct from old.answer_text or new.knowledge_entry_id is distinct from old.knowledge_entry_id then
   raise exception 'auto_answer_identity_is_immutable' using errcode='check_violation';
  end if;
  if new.status<>old.status and not (
      (old.status='queued' and new.status in('sent','rejected','unknown','failed'))
   or (old.status='unknown' and new.status in('sent','rejected'))) then
   raise exception 'auto_answer_status_transition_refused' using errcode='check_violation';
  end if;
  if old.wrong_marked_at is not null and new.wrong_marked_at is distinct from old.wrong_marked_at then
   raise exception 'auto_answer_wrong_mark_is_final' using errcode='check_violation';
  end if;
  new.updated_at:=now();
 end if;
 return new;
end $$;
revoke all on function public.sima_auto_answers_guard() from public,anon,authenticated;
drop trigger if exists sima_auto_answers_guard_trg on public.sima_auto_answers;
create trigger sima_auto_answers_guard_trg before update on public.sima_auto_answers
 for each row execute function public.sima_auto_answers_guard();

alter table public.sima_auto_answers enable row level security;
revoke all on public.sima_auto_answers from public,anon,authenticated;
grant select,insert,update on public.sima_auto_answers to service_role;

-- Service-only. Creates the outbox item for a QUEUED live decision, re-verifying everything in the database.
create or replace function public.sima_prepare_auto_send(p_auto_answer_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
 a public.sima_auto_answers%rowtype;
 s public.sima_autonomy_settings%rowtype;
 t public.sima_topics%rowtype;
 k public.sima_knowledge_entries%rowtype;
 v_case public.sima_human_review_cases%rowtype;
 v_customer public.crm_customers%rowtype;
 v_message public.crm_interactions%rowtype;
 v_id uuid;v_conversation text;v_contact text;
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' then raise exception 'service_role_required';end if;
 select * into a from public.sima_auto_answers where id=p_auto_answer_id for update;
 if not found or a.status<>'queued' or a.mode<>'live' or a.outbox_id is not null then raise exception 'auto_answer_not_sendable';end if;
 if not exists(select 1 from public.customer_subscriptions cs join public.store_products p on p.id=cs.product_id
               where cs.customer_id=a.tenant_id and p.service_code='crm' and cs.starts_at<=now() and cs.expires_at>now()) then
  raise exception 'crm_access_denied';end if;
 select * into s from public.sima_autonomy_settings where tenant_id=a.tenant_id;
 if not found or not s.auto_enabled or s.paused_at is not null then raise exception 'tenant_automatic_replies_disabled';end if;
 select * into t from public.sima_topics where tenant_id=a.tenant_id and id=a.topic_id for share;
 if not found or t.status<>'active' or t.stage<>'auto' or t.never_auto then raise exception 'topic_not_automatic';end if;
 -- Only an approved answer, word for word, can ever be sent automatically.
 select * into k from public.sima_knowledge_entries
 where tenant_id=a.tenant_id and id=a.knowledge_entry_id and status='approved' and (expires_at is null or expires_at>now());
 if not found or btrim(k.answer)<>btrim(a.answer_text) or k.revision<>a.knowledge_revision then raise exception 'answer_not_approved_verbatim';end if;
 if (select count(*) from public.sima_auto_answers x where x.tenant_id=a.tenant_id and x.mode='live'
       and x.status in('queued','sent','unknown','rejected') and x.created_at>now()-interval '1 hour')>s.auto_hourly_cap then
  raise exception 'hourly_cap_reached';end if;
 if (select count(*) from public.sima_auto_answers x where x.tenant_id=a.tenant_id and x.customer_id=a.customer_id and x.mode='live'
       and x.status in('queued','sent','unknown','rejected') and x.created_at>now()-interval '24 hours')>s.auto_customer_daily_cap then
  raise exception 'customer_daily_cap_reached';end if;
 -- Same conversation rules as the human path.
 select * into v_case from public.sima_human_review_cases where id=a.review_id and tenant_id=a.tenant_id for update;
 if not found then raise exception 'review_not_found';end if;
 if v_case.channel<>'instagram' then raise exception 'channel_not_enabled';end if;
 if v_case.conversation_version<>a.conversation_version or v_case.state not in('awaiting_human','drafting') then
  raise exception 'conversation_stale_or_locked';end if;
 select * into v_customer from public.crm_customers where id=v_case.customer_id and tenant_id=v_case.tenant_id for update;
 if not found or v_customer.do_not_contact then raise exception 'contact_forbidden';end if;
 select * into v_message from public.crm_interactions
 where tenant_id=v_case.tenant_id and id=v_case.last_message_id and customer_id=v_case.customer_id
  and channel='instagram' and kind='message' and direction='inbound';
 if not found or v_message.occurred_at<>v_case.last_occurred_at then raise exception 'missing_inbound_anchor';end if;
 if v_message.occurred_at<now()-interval '23 hours' or v_message.occurred_at>now()+interval '5 minutes' then raise exception 'reply_window_closed';end if;
 if exists(select 1 from public.crm_interactions i
   where i.tenant_id=v_case.tenant_id and i.customer_id=v_case.customer_id and i.channel='instagram'
    and i.kind='message' and i.direction='outbound' and i.occurred_at>v_message.occurred_at) then raise exception 'newer_business_reply_exists';end if;
 if exists(select 1 from public.sima_message_outbox o where o.tenant_id=v_case.tenant_id and o.review_id=v_case.id
   and o.conversation_version=v_case.conversation_version) then raise exception 'turn_already_has_send';end if;
 select c.participant_id into v_contact from public.crm_zernio_contacts c
  where c.tenant_id=v_case.tenant_id and c.customer_id=v_case.customer_id and c.account_id=v_case.account_id and c.platform='instagram' limit 1;
 if v_contact is null then raise exception 'channel_identity_not_verified';end if;
 select e.payload->'conversation'->>'id' into v_conversation
 from public.crm_zernio_events e join public.crm_zernio_profiles p on p.tenant_id=e.tenant_id and p.profile_id=e.profile_id
 where e.tenant_id=v_case.tenant_id and e.account_id=v_case.account_id and e.event_type='message.received'
   and e.payload->'account'->>'platform'='instagram' and e.payload->'conversation'->>'participantId'=v_contact
   and v_message.external_event_id='zernio-msg:'||md5(e.account_id||':'||coalesce(nullif(e.payload->'message'->>'id',''),e.event_id::text))
 order by e.received_at desc limit 1;
 if v_conversation is null or length(v_conversation)>255 or length(v_conversation)<1 then raise exception 'trusted_conversation_missing';end if;
 insert into public.sima_message_outbox(tenant_id,review_id,customer_id,account_id,conversation_id,body,conversation_version,actor)
 values(v_case.tenant_id,v_case.id,v_case.customer_id,v_case.account_id,v_conversation,btrim(a.answer_text),a.conversation_version,'cima_auto')
 returning id into v_id;
 update public.sima_auto_answers set outbox_id=v_id where id=a.id;
 return jsonb_build_object('outbox_id',v_id,'queued',true);
end $function$;
revoke all on function public.sima_prepare_auto_send(uuid) from public,anon,authenticated;
grant execute on function public.sima_prepare_auto_send(uuid) to service_role;

-- Claim for an automatic item: re-checks the kill switch at the last moment, then uses the same atomic claim as the human path.
create or replace function public.sima_claim_auto_send(p_outbox_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare o public.sima_message_outbox%rowtype;s public.sima_autonomy_settings%rowtype;
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' then raise exception 'service_role_required';end if;
 select * into o from public.sima_message_outbox where id=p_outbox_id for update;
 if not found or o.actor<>'cima_auto' or o.status<>'pending' then return null;end if;
 select * into s from public.sima_autonomy_settings where tenant_id=o.tenant_id;
 if not found or not s.auto_enabled or s.paused_at is not null then
  update public.sima_message_outbox set status='rejected',provider_error_code='auto_paused',updated_at=now() where id=o.id;
  return null;
 end if;
 return public.sima_claim_human_send(p_outbox_id);
end $function$;
revoke all on function public.sima_claim_auto_send(uuid) from public,anon,authenticated;
grant execute on function public.sima_claim_auto_send(uuid) to service_role;

commit;

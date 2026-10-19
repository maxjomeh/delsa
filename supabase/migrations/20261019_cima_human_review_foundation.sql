-- CIMA Human-in-the-Loop Phase 0-1: safe, durable review-only inbox.
-- Deliberately no channel dispatcher and no autonomous outbound permissions.
begin;
create unique index if not exists crm_learning_tenant_field_proposal_unique
on public.crm_learning_suggestions(tenant_id,kind,field_key)
where customer_id is null and kind='new_field';

create table if not exists public.sima_human_review_cases(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.profiles(id),
 customer_id uuid not null,
 account_id text not null check (account_id ~ '^[a-f0-9]{24}$'),
 channel text not null,
 last_message_id uuid not null,
 last_occurred_at timestamptz not null,
 state text not null default 'awaiting_human' check(state in ('awaiting_human','drafting','resolved')),
 reason_code text not null default 'MODEL_NOT_VALIDATED' check(reason_code in ('MODEL_NOT_VALIDATED','OWNER_REVIEW_REQUIRED')),
 conversation_version bigint not null default 1 check(conversation_version>0),
 draft_text text check(draft_text is null or length(draft_text)<=8000),
 draft_version bigint,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,id),
 unique(tenant_id,customer_id,account_id),
 foreign key(tenant_id,customer_id) references public.crm_customers(tenant_id,id),
 foreign key(tenant_id,last_message_id) references public.crm_interactions(tenant_id,id)
);
create index if not exists sima_review_tenant_queue_idx
on public.sima_human_review_cases(tenant_id,state,updated_at desc);
alter table public.sima_human_review_cases enable row level security;
revoke all on public.sima_human_review_cases from public,anon,authenticated;
grant select on public.sima_human_review_cases to authenticated;
grant select,insert,update,delete on public.sima_human_review_cases to service_role;
drop policy if exists sima_review_read_own on public.sima_human_review_cases;
create policy sima_review_read_own on public.sima_human_review_cases for select to authenticated
using (tenant_id=(select auth.uid()) and (select public.has_active_crm()));

create or replace function public.sima_enqueue_verified_inbound()
returns trigger language plpgsql security definer set search_path='' as $body$
declare v_account text;v_profile text;
begin
 if new.kind<>'message' or new.direction<>'inbound'
    or new.external_event_id is null
    or new.external_event_id !~ '^zernio:[0-9a-fA-F-]{36}$' then return new;end if;
 select e.account_id,e.profile_id into v_account,v_profile
 from public.crm_zernio_events e
 join public.crm_zernio_profiles p on p.tenant_id=e.tenant_id and p.profile_id=e.profile_id
 join public.crm_zernio_contacts c on c.tenant_id=e.tenant_id
  and c.account_id=e.account_id and c.customer_id=new.customer_id
 where e.tenant_id=new.tenant_id and e.event_id=substring(new.external_event_id from 8)::uuid
 and e.event_type='message.received' limit 1;
 if v_account is null then return new;end if;
 -- Replayed history must not reopen an already-answered customer thread.
 if exists(select 1 from public.crm_interactions i
   where i.tenant_id=new.tenant_id and i.customer_id=new.customer_id
   and i.channel=new.channel and i.kind='message'
   and i.direction='outbound' and i.occurred_at>new.occurred_at
   and i.external_event_id like 'zernio:%') then return new;end if;
 insert into public.sima_human_review_cases(
  tenant_id,customer_id,account_id,channel,last_message_id,last_occurred_at,
  state,reason_code,conversation_version
 ) values(new.tenant_id,new.customer_id,v_account,new.channel,new.id,new.occurred_at,
  'awaiting_human','MODEL_NOT_VALIDATED',1)
 on conflict(tenant_id,customer_id,account_id) do update
 set last_message_id=excluded.last_message_id,
  last_occurred_at=excluded.last_occurred_at,
  conversation_version=sima_human_review_cases.conversation_version+1,
  state='awaiting_human',reason_code='MODEL_NOT_VALIDATED',
  updated_at=now()
 where excluded.last_occurred_at>sima_human_review_cases.last_occurred_at;
 return new;
end $body$;
revoke all on function public.sima_enqueue_verified_inbound() from public,anon,authenticated;
drop trigger if exists sima_verified_inbound_review_trigger on public.crm_interactions;
create trigger sima_verified_inbound_review_trigger
after insert on public.crm_interactions
for each row execute function public.sima_enqueue_verified_inbound();

-- Backfill unresolved *latest* provider-recorded inbound conversations
-- from already existing historical messages. Does not send any replies.
with ordered as (
 select c.tenant_id,c.customer_id,c.account_id,i.id interaction_id,
  i.occurred_at,i.direction,i.channel,
  row_number() over(partition by c.tenant_id,c.customer_id,c.account_id order by i.occurred_at desc,i.id desc) as rn
 from public.crm_zernio_contacts c
 join public.crm_zernio_events e on e.tenant_id=c.tenant_id and e.account_id=c.account_id
  and e.payload->'conversation'->>'participantId'=c.participant_id
  and e.event_type in ('message.received','message.sent')
 join public.crm_interactions i on i.tenant_id=e.tenant_id
  and i.customer_id=c.customer_id and i.external_event_id='zernio:'||e.event_id::text
), open_latest as (
 select * from ordered where rn=1 and direction='inbound'
)
insert into public.sima_human_review_cases(
 tenant_id,customer_id,account_id,channel,last_message_id,last_occurred_at,
 state,reason_code,conversation_version
)
select tenant_id,customer_id,account_id,channel,interaction_id,occurred_at,
 'awaiting_human','MODEL_NOT_VALIDATED',1 from open_latest
on conflict(tenant_id,customer_id,account_id) do nothing;
commit;

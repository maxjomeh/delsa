-- Match the canonical zernio-msg account/message fingerprint (not legacy event IDs).
begin;
create or replace function public.sima_enqueue_verified_inbound()
returns trigger language plpgsql security definer set search_path='' as $body$
declare v_account text;
begin
 if new.kind<>'message' or new.direction<>'inbound'
    or new.external_event_id is null
    or new.external_event_id !~ '^zernio-msg:[0-9a-f]{32}$' then return new;end if;
 select c.account_id into v_account
 from public.crm_zernio_contacts c
 where c.tenant_id=new.tenant_id and c.customer_id=new.customer_id
 and c.platform=new.channel
 and exists(
  select 1 from public.crm_zernio_events e
  join public.crm_zernio_profiles p on p.tenant_id=e.tenant_id and p.profile_id=e.profile_id
  where e.tenant_id=c.tenant_id and e.account_id=c.account_id
    and e.event_type='message.received'
    and e.payload->'conversation'->>'participantId'=c.participant_id
    and new.external_event_id='zernio-msg:'||md5(e.account_id||':'||
      coalesce(nullif(e.payload->'message'->>'id',''),e.event_id::text))
 )
 limit 1;
 if v_account is null then return new;end if;
 if exists(select 1 from public.crm_interactions i
   where i.tenant_id=new.tenant_id and i.customer_id=new.customer_id
     and i.channel=new.channel and i.kind='message'
     and i.direction='outbound' and i.occurred_at>new.occurred_at
     and i.external_event_id like 'zernio-msg:%') then return new;end if;
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

with ordered as (
 select c.tenant_id,c.customer_id,c.account_id,i.id interaction_id,
 i.occurred_at,i.direction,i.channel,
 row_number() over(partition by c.tenant_id,c.customer_id,c.account_id
   order by i.occurred_at desc,i.id desc) as rn
 from public.crm_interactions i
 join public.crm_zernio_contacts c on c.tenant_id=i.tenant_id
    and c.customer_id=i.customer_id and c.platform=i.channel
 join public.crm_zernio_events e on e.tenant_id=c.tenant_id
    and e.account_id=c.account_id
    and e.payload->'conversation'->>'participantId'=c.participant_id
    and e.event_type in('message.received','message.sent')
    and i.external_event_id='zernio-msg:'||md5(e.account_id||':'||
         coalesce(nullif(e.payload->'message'->>'id',''),e.event_id::text))
), recent as (
 select * from ordered where rn=1 and direction='inbound'
)
insert into public.sima_human_review_cases(
 tenant_id,customer_id,account_id,channel,last_message_id,
 last_occurred_at,state,reason_code,conversation_version
)
select tenant_id,customer_id,account_id,channel,interaction_id,occurred_at,
 'awaiting_human','MODEL_NOT_VALIDATED',1 from recent
on conflict(tenant_id,customer_id,account_id) do nothing;
commit;

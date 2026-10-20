-- A real outbound platform message closes an older review case.
-- Only verified Zernio event/account/participant matches are eligible.
begin;
create or replace function public.sima_close_review_on_verified_reply()
returns trigger language plpgsql security definer set search_path='' as $body$
begin
 if new.direction<>'outbound' or new.kind<>'message' or new.external_event_id not like 'zernio-msg:%' then return new;end if;
 update public.sima_human_review_cases r
 set state='resolved',updated_at=now()
 where r.tenant_id=new.tenant_id and r.customer_id=new.customer_id
   and r.channel=new.channel and r.state in('awaiting_human','drafting')
   and new.occurred_at>r.last_occurred_at
   and exists (
    select 1 from public.crm_zernio_contacts c
    join public.crm_zernio_events e on e.tenant_id=c.tenant_id
      and e.account_id=c.account_id and e.event_type='message.sent'
      and e.payload->'conversation'->>'participantId'=c.participant_id
    where c.tenant_id=r.tenant_id and c.customer_id=r.customer_id
      and c.account_id=r.account_id and c.platform=r.channel
      and new.external_event_id='zernio-msg:'||md5(e.account_id||':'||
       coalesce(nullif(e.payload->'message'->>'id',''),e.event_id::text))
   );
 return new;
end $body$;
revoke all on function public.sima_close_review_on_verified_reply() from public,anon,authenticated;
drop trigger if exists sima_verified_outbound_review_trigger on public.crm_interactions;
create trigger sima_verified_outbound_review_trigger after insert on public.crm_interactions
for each row execute function public.sima_close_review_on_verified_reply();

with replied as (
 select r.id,r.tenant_id
 from public.sima_human_review_cases r
 where r.state in('awaiting_human','drafting')
 and exists (
  select 1 from public.crm_interactions i
  join public.crm_zernio_contacts c on c.tenant_id=i.tenant_id
   and c.customer_id=i.customer_id and c.platform=i.channel and c.account_id=r.account_id
  join public.crm_zernio_events e on e.tenant_id=c.tenant_id and e.account_id=c.account_id
   and e.event_type='message.sent' and e.payload->'conversation'->>'participantId'=c.participant_id
  where i.tenant_id=r.tenant_id and i.customer_id=r.customer_id and i.channel=r.channel
   and i.direction='outbound' and i.kind='message' and i.occurred_at>r.last_occurred_at
   and i.external_event_id='zernio-msg:'||md5(e.account_id||':'||
    coalesce(nullif(e.payload->'message'->>'id',''),e.event_id::text))
 )
)
update public.sima_human_review_cases r set state='resolved',updated_at=now()
from replied d where r.tenant_id=d.tenant_id and r.id=d.id;

update public.sima_message_outbox o
set status='rejected',provider_error_code='reply_already_sent_from_platform',updated_at=now()
from public.sima_human_review_cases r
where o.tenant_id=r.tenant_id and o.review_id=r.id and o.status='pending'
and o.attempt_count=0 and r.state='resolved'
and exists(select 1 from public.crm_interactions i where i.tenant_id=r.tenant_id
 and i.customer_id=r.customer_id and i.channel=r.channel and i.kind='message'
 and i.direction='outbound' and i.external_event_id like 'zernio-msg:%'
 and i.occurred_at>r.last_occurred_at);
commit;
-- CIMA-005: reconcile only unattempted human sends; NEVER invoke provider or retry.
-- Retain every historical outbox record, original request, and attempt count.
begin;
create or replace function public.sima_reconcile_unattempted_outbox(p_limit integer default 100)
returns jsonb
language plpgsql security definer set search_path=''
as $reconcile$
declare v_summary jsonb;
begin
 if p_limit is null or p_limit<1 or p_limit>500 then raise exception 'invalid_reconcile_limit'; end if;
 with locked as (
   select o.id,
     case
       when r.id is null then 'review_missing_before_send'
       when r.conversation_version is distinct from o.conversation_version then 'conversation_changed_before_send'
       when r.state not in ('awaiting_human','drafting') then 'review_closed_before_send'
       when c.id is null then 'customer_missing_before_send'
       when c.do_not_contact then 'contact_opted_out_before_send'
       when r.last_occurred_at is null or r.last_occurred_at<now()-interval '23 hours' then 'reply_window_closed_before_send'
       when r.last_occurred_at>now()+interval '5 minutes' then 'invalid_inbound_time_before_send'
       when exists (
         select 1 from public.crm_interactions i
         where i.tenant_id=o.tenant_id and i.customer_id=o.customer_id
         and i.channel='instagram' and i.kind='message' and i.direction='outbound'
         and i.occurred_at>r.last_occurred_at
       ) then 'newer_business_reply_before_send'
       else null
     end as reason
   from public.sima_message_outbox o
   left join public.sima_human_review_cases r
     on r.tenant_id=o.tenant_id and r.id=o.review_id
   left join public.crm_customers c
     on c.tenant_id=o.tenant_id and c.id=o.customer_id
   where o.status='pending' and o.attempt_count=0
     and o.requested_at<now()-interval '2 minutes'
   order by o.requested_at,o.id
   limit p_limit
   for update of o skip locked
 ),
 closed as (
   update public.sima_message_outbox o
   set status='rejected',provider_error_code=l.reason,updated_at=now()
   from locked l
   where o.id=l.id and l.reason is not null
     and o.status='pending' and o.attempt_count=0
   returning o.provider_error_code
 )
 select jsonb_build_object(
   'closed',count(*),
   'by_reason',coalesce(jsonb_object_agg(t.provider_error_code,t.n),'{}'::jsonb)
 ) into v_summary
 from (
   select provider_error_code,count(*) as n
   from closed group by provider_error_code
 ) t;
 return coalesce(v_summary,'{"closed":0,"by_reason":{}}'::jsonb);
end $reconcile$;

-- The CRON runner is Postgres; untrusted clients cannot execute or update Outbox.
revoke all on function public.sima_reconcile_unattempted_outbox(integer) from public,anon,authenticated;
grant execute on function public.sima_reconcile_unattempted_outbox(integer) to service_role;
select cron.schedule('sima_outbox_pending_reconcile','*/5 * * * *',
  $$select public.sima_reconcile_unattempted_outbox(100);$$);
commit;
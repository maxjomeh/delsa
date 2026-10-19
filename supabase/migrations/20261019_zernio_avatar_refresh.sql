begin;
create or replace function public.crm_zernio_refresh_avatars()
returns integer language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
 with images as (
  select distinct on (e.tenant_id,e.account_id,e.payload->'conversation'->>'participantId')
   e.tenant_id,e.account_id,e.payload->'conversation'->>'participantId' participant_id,
   e.payload->'conversation'->>'participantPicture' url
  from public.crm_zernio_events e
  where e.account_id is not null
    and length(e.payload->'conversation'->>'participantPicture') between 12 and 900
    and e.payload->'conversation'->>'participantPicture' ~ '^https://[^[:space:]<>]+$'
    and coalesce(e.payload->'conversation'->>'participantId','')<>''
  order by e.tenant_id,e.account_id,e.payload->'conversation'->>'participantId',e.received_at desc
 ), matches as (
 select i.customer_id,i.tenant_id,im.url from images im
 join public.crm_zernio_contacts i on i.tenant_id=im.tenant_id and i.account_id=im.account_id and i.participant_id=im.participant_id
 )
 update public.crm_customers c
 set custom_fields=jsonb_set(c.custom_fields,'{social_avatar_url}',to_jsonb(matches.url),true),updated_at=now()
 from matches
 where c.id=matches.customer_id and c.tenant_id=matches.tenant_id
 and coalesce(c.custom_fields->>'social_avatar_url','')<>matches.url;
 get diagnostics changed=row_count;
 return changed;
end $$;
revoke all on function public.crm_zernio_refresh_avatars() from public,anon,authenticated;
grant execute on function public.crm_zernio_refresh_avatars() to service_role;
select cron.schedule('sima_zernio_refresh_avatars','*/10 * * * *','select public.crm_zernio_refresh_avatars();');
commit;
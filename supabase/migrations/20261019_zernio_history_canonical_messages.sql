-- Replace projection to use stable message IDs and per-conversation images.
begin;
-- Canonical IDs deduplicate old live webhooks and API history records.
-- Existing 35 interactions are rewritten with the original Zernio message id.
update public.crm_interactions i
set external_event_id='zernio-msg:'||md5(e.account_id||':'||coalesce(nullif(e.payload->'message'->>'id',''),e.event_id::text))
from public.crm_zernio_events e
where i.tenant_id=e.tenant_id and i.external_event_id='zernio:'||e.event_id::text
 and e.event_type in ('message.received','message.sent')
 and coalesce(e.payload->'message'->>'id','')<>'';

create or replace function public.crm_zernio_process_batch(p_limit integer default 60)
returns jsonb language plpgsql security definer set search_path='' as $func$
declare
 e public.crm_zernio_events%rowtype;
 v_processed integer:=0;
 v_created integer:=0;
 v_inserted integer:=0;
 v_skipped integer:=0;
 v_failed integer:=0;
 v_customer uuid;
 v_identity uuid;
 v_participant text;
 v_display text;
 v_username text;
 v_platform text;
 v_text text;
 v_event_at timestamptz;
 v_message uuid;
 v_account text;
 v_picture text;
begin
 if p_limit is null or p_limit<1 or p_limit>200 then raise exception 'invalid_batch_limit'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock(726191,10192026) then
  return pg_catalog.jsonb_build_object('busy',true,'processed',0);
 end if;
 for e in
  select * from public.crm_zernio_events
  where status='pending'
  order by received_at,event_id limit p_limit
  for update skip locked
 loop
  begin
   if not exists (select 1 from public.crm_zernio_profiles p where p.tenant_id=e.tenant_id and p.profile_id=e.profile_id) then
    update public.crm_zernio_events set status='failed',last_error='profile_mapping_missing' where event_id=e.event_id;
    v_failed:=v_failed+1;
    continue;
   end if;
   if e.event_type not in ('conversation.started','message.received','message.sent') then
    update public.crm_zernio_events set status='processed',processed_at=now(),last_error=null where event_id=e.event_id;
    v_processed:=v_processed+1;
    continue;
   end if;
   v_platform=lower(pg_catalog.btrim(coalesce(e.payload->'account'->>'platform',e.payload->'conversation'->>'platform','')));
   if v_platform not in ('instagram','facebook','whatsapp','telegram','bale','eitaa','rubika','soroush') then
    update public.crm_zernio_events set status='processed',processed_at=now(),last_error='unsupported_platform' where event_id=e.event_id;
    v_skipped:=v_skipped+1;continue;
   end if;
   v_account=coalesce(nullif(e.account_id,''),nullif(e.payload->'account'->>'accountId',''),nullif(e.payload->'account'->>'id',''));
   v_participant=nullif(pg_catalog.btrim(e.payload->'conversation'->>'participantId'),'');
   v_picture=nullif(left(pg_catalog.btrim(coalesce(e.payload->'conversation'->>'participantPicture','')),2048),'');
   if v_picture is not null and v_picture !~ '^https://[^[:space:]]+
   if v_account is null or v_account!~'^[a-f0-9]{24}$' or v_participant is null or length(v_participant)>200 then
    update public.crm_zernio_events set status='failed',last_error='stable_identity_missing' where event_id=e.event_id;
    v_failed:=v_failed+1;continue;
   end if;
   -- A social account must still be mapped to its OWN profile; the signed event's
   -- account/profile pair was matched by the ingress endpoint.
   if coalesce(e.payload->'account'->>'profileId',e.profile_id)<>e.profile_id then
    update public.crm_zernio_events set status='failed',last_error='account_profile_mismatch' where event_id=e.event_id;
    v_failed:=v_failed+1;continue;
   end if;
   select z.id,z.customer_id into v_identity,v_customer
   from public.crm_zernio_contacts z
   where z.tenant_id=e.tenant_id and z.account_id=v_account and z.participant_id=v_participant
   for update;
   if v_customer is null then
    v_username=left(pg_catalog.btrim(coalesce(e.payload->'conversation'->>'participantUsername','')),80);
    v_display=pg_catalog.btrim(coalesce(
      nullif(e.payload->'conversation'->>'participantName',''),
      nullif(v_username,''),
      case when e.event_type='message.received' then nullif(e.payload->'message'->'sender'->>'name','') end,
      'مخاطب شبکه اجتماعی'
    ));
    v_display=left(pg_catalog.regexp_replace(v_display,'[[:cntrl:]]',' ','g'),160);
    if v_display='' then v_display='مخاطب شبکه اجتماعی';end if;
    insert into public.crm_customers(tenant_id,name,status,tags,phone,instagram,custom_fields)
    values(e.tenant_id,v_display,'new','', '', '',pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object('social_platform',v_platform,'social_username',nullif(v_username,''),'social_avatar_url',v_picture)))
    returning id into v_customer;
    insert into public.crm_zernio_contacts(tenant_id,account_id,participant_id,customer_id,platform,avatar_url,username)
    values(e.tenant_id,v_account,v_participant,v_customer,v_platform,v_picture,nullif(v_username,''));
    v_created:=v_created+1;
   else
    update public.crm_zernio_contacts set last_seen_at=now(),avatar_url=coalesce(v_picture,avatar_url),username=coalesce(nullif(e.payload->'conversation'->>'participantUsername',''),username) where id=v_identity;
    if v_picture is not null then
      update public.crm_customers set custom_fields=jsonb_set(custom_fields,'{social_avatar_url}',to_jsonb(v_picture),true),updated_at=now() where tenant_id=e.tenant_id and id=v_customer and (custom_fields->>'social_avatar_url') is distinct from v_picture;
    end if;
   end if;
   if e.event_type in ('message.received','message.sent') then
    v_text=left(pg_catalog.btrim(coalesce(e.payload->'message'->>'text','')),8000);
    if v_text='' and pg_catalog.jsonb_typeof(e.payload->'message'->'attachments')='array'
      and pg_catalog.jsonb_array_length(e.payload->'message'->'attachments')>0 then
      v_text='[پیام دارای فایل یا رسانه بدون متن]';
    end if;
    if v_text<>'' then
     v_event_at=coalesce(nullif(e.payload->'message'->>'sentAt','')::timestamptz,
                          nullif(e.payload->>'timestamp','')::timestamptz,now());
     insert into public.crm_interactions(tenant_id,customer_id,channel,direction,kind,body,external_event_id,occurred_at)
     values(e.tenant_id,v_customer,v_platform,case when e.event_type='message.received' then 'inbound' else 'outbound' end,
       'message',v_text,'zernio-msg:'||md5(v_account||':'||coalesce(nullif(e.payload->'message'->>'id',''),e.event_id::text)),v_event_at)
     on conflict (tenant_id,channel,external_event_id) do nothing returning id into v_message;
     if v_message is not null then v_inserted:=v_inserted+1;end if;
    end if;
   end if;
   update public.crm_zernio_events set status='processed',processed_at=now(),last_error=null where event_id=e.event_id;
   v_processed:=v_processed+1;
  exception when others then
   update public.crm_zernio_events set status='failed',last_error='processing_error' where event_id=e.event_id;
   v_failed:=v_failed+1;
  end;
  v_customer=null;v_identity=null;v_message=null;v_participant=null;v_account=null;
 end loop;
 return pg_catalog.jsonb_build_object('processed',v_processed,'created_customers',v_created,'interactions',v_inserted,'skipped',v_skipped,'failed',v_failed);
end $func$;

commit;

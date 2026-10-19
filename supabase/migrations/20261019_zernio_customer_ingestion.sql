-- Tenant-safe Zernio -> SIMA contact and message projection.
-- Every unique social participant has a separate identity per connected account.
begin;
create table if not exists public.crm_zernio_contacts(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.profiles(id),
 account_id text not null check(account_id ~ '^[a-f0-9]{24}$'),
 participant_id text not null check(length(participant_id) between 1 and 200),
 customer_id uuid not null,
 platform text not null check(platform in ('instagram','facebook','whatsapp','telegram','bale','eitaa','rubika','soroush')),
 created_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 unique(tenant_id,account_id,participant_id),
 foreign key(tenant_id,customer_id) references public.crm_customers(tenant_id,id)
);
create index if not exists crm_zernio_contacts_customer_idx on public.crm_zernio_contacts(tenant_id,customer_id);
alter table public.crm_zernio_contacts enable row level security;
revoke all on public.crm_zernio_contacts from public,anon,authenticated;
grant select,insert,update on public.crm_zernio_contacts to service_role;

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
    values(e.tenant_id,v_display,'new','', '', '',pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object('social_platform',v_platform,'social_username',nullif(v_username,''))))
    returning id into v_customer;
    insert into public.crm_zernio_contacts(tenant_id,account_id,participant_id,customer_id,platform)
    values(e.tenant_id,v_account,v_participant,v_customer,v_platform);
    v_created:=v_created+1;
   else
    update public.crm_zernio_contacts set last_seen_at=now() where id=v_identity;
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
       'message',v_text,'zernio:'||e.event_id::text,v_event_at)
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
revoke all on function public.crm_zernio_process_batch(integer) from public,anon,authenticated;
grant execute on function public.crm_zernio_process_batch(integer) to service_role;
commit;

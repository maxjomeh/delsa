begin;
create unique index if not exists crm_zernio_message_unique_source on public.crm_zernio_events
(tenant_id,account_id,(payload->'message'->>'id'))
where event_type in ('message.received','message.sent') and account_id is not null and coalesce(payload->'message'->>'id','')<>'';

create or replace function public.crm_zernio_insert_historical(p_events jsonb)
returns integer language plpgsql security definer set search_path='' as $f$
declare item jsonb; inserted integer:=0; own integer;
begin
 if jsonb_typeof(p_events)<>'array' or jsonb_array_length(p_events)>100 or octet_length(p_events::text)>1000000 then raise exception 'invalid_batch';end if;
 for item in select value from jsonb_array_elements(p_events) value loop
  if jsonb_typeof(item)<>'object'
  or item->>'event_type' not in('message.received','message.sent')
  or (item->>'tenant_id') is null
  or not exists(select 1 from public.crm_zernio_profiles p where p.tenant_id=(item->>'tenant_id')::uuid and p.profile_id=item->>'profile_id')
  or item->'payload'->'account'->>'accountId' is distinct from item->>'account_id'
  or item->'payload'->'account'->>'profileId' is distinct from item->>'profile_id'
  or item->'payload'->'message'->>'id' is null
  then raise exception 'history_scope_mismatch'; end if;
  insert into public.crm_zernio_events(event_id,tenant_id,profile_id,account_id,event_type,payload)
  values((item->>'event_id')::uuid,(item->>'tenant_id')::uuid,item->>'profile_id',item->>'account_id',item->>'event_type',item->'payload')
  on conflict do nothing;
  get diagnostics own=row_count;inserted:=inserted+own;
 end loop;
 return inserted;
end $f$;
revoke all on function public.crm_zernio_insert_historical(jsonb) from public,anon,authenticated;
grant execute on function public.crm_zernio_insert_historical(jsonb) to service_role;
commit;
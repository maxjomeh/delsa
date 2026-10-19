begin;
create or replace function public.crm_learning_scan_batch()
returns jsonb language plpgsql security definer set search_path='' as $f$
declare created_phone integer:=0;created_field integer:=0;created_model integer:=0;
begin
 if not pg_catalog.pg_try_advisory_xact_lock(726191,10192028) then return jsonb_build_object('busy',true);end if;
 -- Require a self-disclosed phone context. Ambiguous digit sequences are never
 -- written into crm_customers automatically.
 with source as (
  select i.tenant_id,i.customer_id,i.id,i.body,
   substring(translate(i.body,'۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩','01234567890123456789')
     from '(?:09[0-9]{9}|\+989[0-9]{9})') as raw
  from public.crm_interactions i
  where i.direction='inbound' and i.kind='message'
  and i.body ~* '(شماره|تماس|موبایل|تلفن|واتساپ)'
  and i.created_at>now()-interval '365 days'
  order by i.created_at desc limit 10000
 ), normalized as (
  select tenant_id,customer_id,id,left(body,500) evidence,
  case when raw like '+98%' then '0'||substring(raw from 4) else raw end phone
  from source where raw is not null
 )
 insert into public.crm_learning_suggestions(tenant_id,customer_id,kind,field_key,proposed_value,evidence_quote,evidence_interaction_id,confidence)
 select x.tenant_id,x.customer_id,'phone','phone',x.phone,x.evidence,x.id,0.96
 from normalized x
 where x.phone ~ '^09[0-9]{9}$'
 and not exists (
  select 1 from public.crm_learning_suggestions z
  where z.tenant_id=x.tenant_id and z.customer_id=x.customer_id
   and z.kind='phone' and z.field_key='phone' and z.proposed_value=x.phone
 )
 on conflict do nothing;
 get diagnostics created_phone=row_count;
 -- A field is proposed when the business repeatedly asks for the truck model
 -- across at least THREE DISTINCT CRM customers.
 with phrases as(
  select tenant_id,customer_id,min(id::text)::uuid evidence_id,
  min(left(body,500)) evidence, count(*) n
  from public.crm_interactions
  where direction='outbound' and kind='message'
  and body ~* '(کشنده|تریلی|ماشین سنگین)'
  and body ~* '(مدل|چی|نوع|چیه)'
  and created_at>now()-interval '365 days'
  group by tenant_id,customer_id
 ), aggregate as(
  select tenant_id,count(distinct customer_id) support,min(evidence) evidence,min(evidence_id::text)::uuid evidence_id
  from phrases group by tenant_id having count(distinct customer_id)>=3
 )
 insert into public.crm_learning_suggestions(tenant_id,customer_id,kind,field_key,proposed_value,evidence_quote,evidence_interaction_id,confidence,support_count)
 select a.tenant_id,null,'new_field','truck_model','مدل کشنده',a.evidence,a.evidence_id,
 least(0.96,0.72+a.support*0.04),a.support
 from aggregate a
 where not exists(select 1 from public.crm_learning_suggestions s
  where s.tenant_id=a.tenant_id and s.customer_id is null and s.kind='new_field' and s.field_key='truck_model')
 and not exists(select 1 from public.crm_field_definitions f
  where f.tenant_id=a.tenant_id and f.key='truck_model');
 get diagnostics created_field=row_count;
 return jsonb_build_object('phone_proposals',created_phone,'field_proposals',created_field,'model_proposals',created_model);
end $f$;
revoke all on function public.crm_learning_scan_batch() from public,anon,authenticated;
grant execute on function public.crm_learning_scan_batch() to service_role;
select cron.schedule('sima_learning_suggestions','*/10 * * * *','select public.crm_learning_scan_batch();');
commit;
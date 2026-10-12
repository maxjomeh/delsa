-- PENDING explicit production approval. Not installed.
begin;
create function public.has_active_crm() returns boolean language sql stable security invoker set search_path='' as $$ select auth.uid() is not null and exists(select 1 from public.customer_subscriptions s join public.store_products p on p.id=s.product_id where s.customer_id=auth.uid() and p.service_code='crm' and s.starts_at<=now() and s.expires_at>now()); $$;
revoke all on function public.has_active_crm() from public,anon;
grant execute on function public.has_active_crm() to authenticated;
create table public.crm_settings(tenant_id uuid primary key references public.profiles(id),industry text not null default 'retail' check(industry in ('retail','services','parts','fashion','property','education')),business_name text not null default '' check(length(business_name)<=120),followup_hours integer not null default 24 check(followup_hours between 1 and 720),max_attempts integer not null default 2 check(max_attempts between 1 and 5),automation_enabled boolean not null default true,updated_at timestamptz not null default now());
create table public.crm_customers(id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.profiles(id),name text not null check(length(trim(name)) between 1 and 160),phone text not null default '' check(phone='' or phone~'^09[0-9]{9}$'),instagram text not null default '' check(length(instagram)<=80),city text not null default '' check(length(city)<=100),status text not null default 'new' check(status in ('new','active','dormant','closed')),tags text not null default '' check(length(tags)<=500),notes text not null default '' check(length(notes)<=4000),custom_fields jsonb not null default '{}' check(jsonb_typeof(custom_fields)='object' and octet_length(custom_fields::text)<=10000),do_not_contact boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(tenant_id,id));
create unique index crm_customer_phone on public.crm_customers(tenant_id,phone) where phone<>'';
create unique index crm_customer_instagram on public.crm_customers(tenant_id,lower(instagram)) where instagram<>'';
create table public.crm_interactions(id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.profiles(id),customer_id uuid not null,channel text not null default 'manual' check(channel in ('manual','instagram','whatsapp','telegram','bale','eitaa','rubika','soroush','website','phone')),direction text not null check(direction in ('inbound','outbound')),kind text not null default 'message' check(kind in ('message','offer','call','note')),body text not null check(length(trim(body)) between 1 and 8000),external_event_id text check(length(external_event_id)<=240),occurred_at timestamptz not null default now(),created_at timestamptz not null default now(),foreign key(tenant_id,customer_id) references public.crm_customers(tenant_id,id),unique(tenant_id,channel,external_event_id),unique(tenant_id,id));
create table public.crm_leads(id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.profiles(id),customer_id uuid not null,title text not null check(length(trim(title)) between 1 and 200),stage text not null default 'new' check(stage in ('new','qualified','offered','won','lost')),amount bigint check(amount>=0),notes text not null default '' check(length(notes)<=4000),created_at timestamptz not null default now(),foreign key(tenant_id,customer_id) references public.crm_customers(tenant_id,id));
create table public.crm_orders(id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.profiles(id),customer_id uuid not null,reference text not null check(length(trim(reference)) between 1 and 100),amount bigint not null check(amount>=0),status text not null default 'pending' check(status in ('pending','paid','cancelled')),items jsonb not null default '[]' check(jsonb_typeof(items)='array' and octet_length(items::text)<=10000),created_at timestamptz not null default now(),foreign key(tenant_id,customer_id) references public.crm_customers(tenant_id,id),unique(tenant_id,reference));
create table public.crm_tasks(id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.profiles(id),customer_id uuid not null,title text not null check(length(trim(title)) between 1 and 200),due_at timestamptz not null,status text not null default 'scheduled' check(status in ('scheduled','completed','cancelled')),source_interaction_id uuid unique,rule_snapshot jsonb not null default '{}' check(octet_length(rule_snapshot::text)<=10000),result text not null default '' check(length(result)<=2000),created_at timestamptz not null default now(),foreign key(tenant_id,customer_id) references public.crm_customers(tenant_id,id));
alter table public.crm_tasks add constraint crm_task_source_tenant foreign key(tenant_id,source_interaction_id) references public.crm_interactions(tenant_id,id);
create table public.crm_events(id bigint generated always as identity primary key,tenant_id uuid not null references public.profiles(id),entity text not null,entity_id uuid not null,kind text not null,payload jsonb not null default '{}',created_at timestamptz not null default now());
create index crm_interactions_timeline on public.crm_interactions(tenant_id,customer_id,occurred_at desc);
create index crm_leads_tenant on public.crm_leads(tenant_id,created_at desc);
create index crm_orders_tenant on public.crm_orders(tenant_id,created_at desc);
create index crm_tasks_due on public.crm_tasks(tenant_id,status,due_at);
create index crm_events_tenant on public.crm_events(tenant_id,created_at desc);
do $$ declare t text;begin foreach t in array array['crm_settings','crm_customers','crm_interactions','crm_leads','crm_orders','crm_tasks','crm_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy own_read on public.%I for select to authenticated using(tenant_id=(select auth.uid()) or (select public.is_admin()))',t);
 if t<>'crm_events' then
 execute format('grant insert,update on public.%I to authenticated',t);
 execute format('create policy own_insert on public.%I for insert to authenticated with check((tenant_id=(select auth.uid()) and (select public.has_active_crm())) or (select public.is_admin()))',t);
 execute format('create policy own_update on public.%I for update to authenticated using((tenant_id=(select auth.uid()) and (select public.has_active_crm())) or (select public.is_admin())) with check((tenant_id=(select auth.uid()) and (select public.has_active_crm())) or (select public.is_admin()))',t);
 end if;end loop;end $$;
-- Trigger operates only on writes already authorized by RLS; tenant and customer are immutable.
create function private.crm_after_write() returns trigger language plpgsql security definer set search_path='' as $$ declare cfg public.crm_settings;c public.crm_customers;begin
 if tg_op='UPDATE' and (new.tenant_id<>old.tenant_id or (to_jsonb(new)->>'customer_id') is distinct from (to_jsonb(old)->>'customer_id')) then raise exception 'crm_identity_immutable';end if;
 insert into public.crm_events(tenant_id,entity,entity_id,kind,payload) values(new.tenant_id,tg_table_name,coalesce((to_jsonb(new)->>'id')::uuid,new.tenant_id),lower(tg_op),jsonb_build_object('before',case when tg_op='UPDATE' then to_jsonb(old) else null end,'after',to_jsonb(new)));
 if tg_table_name='crm_interactions' and tg_op='INSERT' then
  select * into c from public.crm_customers where tenant_id=new.tenant_id and id=new.customer_id for update;
  if new.direction='inbound' then update public.crm_tasks set status='cancelled',result='دریافت پاسخ جدید مشتری' where tenant_id=new.tenant_id and customer_id=new.customer_id and status='scheduled' and source_interaction_id in(select id from public.crm_interactions where tenant_id=new.tenant_id and occurred_at<=new.occurred_at);
  elsif new.kind='offer' and not c.do_not_contact then
   select * into cfg from public.crm_settings where tenant_id=new.tenant_id;
   if coalesce(cfg.automation_enabled,true) then
    update public.crm_tasks set status='cancelled',result='جایگزینی با پیشنهاد جدید' where tenant_id=new.tenant_id and customer_id=new.customer_id and status='scheduled' and source_interaction_id is not null;
    insert into public.crm_tasks(tenant_id,customer_id,title,due_at,source_interaction_id,rule_snapshot) values(new.tenant_id,new.customer_id,'پیگیری پیشنهاد ارسال‌شده',greatest(now(),new.occurred_at)+make_interval(hours=>coalesce(cfg.followup_hours,24)),new.id,jsonb_build_object('hours',coalesce(cfg.followup_hours,24),'max_attempts',coalesce(cfg.max_attempts,2),'channel',new.channel,'version',1));
   end if;
  end if;
 elsif tg_table_name='crm_orders' then
 if new.status='paid' then
  perform 1 from public.crm_customers where tenant_id=new.tenant_id and id=new.customer_id for update;
  update public.crm_tasks set status='cancelled',result='ثبت خرید مشتری' where tenant_id=new.tenant_id and customer_id=new.customer_id and status='scheduled' and source_interaction_id is not null;
 end if;
 elsif tg_table_name='crm_customers' then
 if new.do_not_contact then
  update public.crm_tasks set status='cancelled',result='توقف ارتباط با مشتری' where tenant_id=new.tenant_id and customer_id=new.id and status='scheduled' and source_interaction_id is not null;
 end if;end if;return new;end $$;
revoke all on function private.crm_after_write() from public,anon,authenticated;
do $$ declare t text;begin foreach t in array array['crm_settings','crm_customers','crm_interactions','crm_leads','crm_orders','crm_tasks'] loop execute format('create trigger crm_record_write after insert or update on public.%I for each row execute function private.crm_after_write()',t);end loop;end $$;
-- Authenticated intake contract for the future channel bridge. Never trusts a supplied tenant ID.
create function public.crm_ingest_message(p_customer jsonb,p_event jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare tenant uuid=auth.uid();cid uuid;phoneid uuid;socialid uuid;msg uuid;eventid text;channel text;phone text;social text;customername text;begin
 if tenant is null or not public.has_active_crm() then raise exception 'crm_access_denied';end if;
 if jsonb_typeof(p_customer)<>'object' or jsonb_typeof(p_event)<>'object' or octet_length(p_customer::text)>10000 or octet_length(p_event::text)>20000 then raise exception 'crm_invalid_event';end if;
 eventid=nullif(trim(p_event->>'event_id'),'');channel=trim(p_event->>'channel');
 if eventid is null or length(eventid)>240 or channel is null or channel not in ('instagram','whatsapp','telegram','bale','eitaa','rubika','soroush','website','phone') then raise exception 'crm_invalid_event';end if;
 perform pg_advisory_xact_lock(hashtextextended(tenant::text||channel||eventid,0));
 select id,customer_id into msg,cid from public.crm_interactions where tenant_id=tenant and crm_interactions.channel=crm_ingest_message.channel and external_event_id=eventid;
 if found then return jsonb_build_object('customer_id',cid,'interaction_id',msg,'duplicate',true);end if;
 phone=regexp_replace(translate(coalesce(p_customer->>'phone',''),'۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩','01234567890123456789'),'[[:space:]()+-]','','g');
 if phone~'^(0098|98)9[0-9]{9}$' then phone='0'||right(phone,10);end if;
 social=lower(trim(both '@' from trim(coalesce(p_customer->>'instagram',''))));
 if phone='' and social='' then raise exception 'crm_identity_required';end if;
 if phone<>'' then select id into phoneid from public.crm_customers where tenant_id=tenant and crm_customers.phone=crm_ingest_message.phone;end if;
 if social<>'' then select id into socialid from public.crm_customers where tenant_id=tenant and lower(instagram)=social;end if;
 if phoneid is not null and socialid is not null and phoneid<>socialid then raise exception 'crm_identity_conflict';end if;
 cid=coalesce(phoneid,socialid);customername=coalesce(nullif(trim(p_customer->>'name'),''),'مشتری جدید');
 if cid is null then insert into public.crm_customers(tenant_id,name,phone,instagram) values(tenant,customername,phone,social) returning id into cid;end if;
 insert into public.crm_interactions(tenant_id,customer_id,channel,direction,kind,body,external_event_id,occurred_at) values(tenant,cid,channel,'inbound','message',p_event->>'body',eventid,coalesce((p_event->>'occurred_at')::timestamptz,now())) returning id into msg;
 return jsonb_build_object('customer_id',cid,'interaction_id',msg,'duplicate',false);
end $$;
revoke all on function public.crm_ingest_message(jsonb,jsonb) from public,anon;
grant execute on function public.crm_ingest_message(jsonb,jsonb) to authenticated;
commit;

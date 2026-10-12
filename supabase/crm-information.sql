-- Sima profile enrichment. Additive; existing customer records are preserved.
begin;
create table public.crm_field_definitions(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.profiles(id),
 key text not null check(length(key) between 1 and 100),label text not null check(length(trim(label)) between 1 and 120),
 type text not null default 'text' check(type in ('text','number','date','birthday','select','multiselect')),
 options jsonb not null default '[]' check(jsonb_typeof(options)='array' and jsonb_array_length(options)<=50 and octet_length(options::text)<=4000),
 priority integer not null default 50 check(priority between 1 and 100),
 question text not null default '' check(length(question)<=500),condition text not null default 'always' check(condition in ('always','after_purchase','active_lead')),
 enabled boolean not null default true,ask_enabled boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(tenant_id,key),unique(tenant_id,id)
);
create table public.crm_information_states(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.profiles(id),customer_id uuid not null,field_id uuid not null,
 status text not null check(status in ('asked','deferred','declined','confirmed','review')),
 last_asked_at timestamptz,next_ask_at timestamptz,
 source_interaction_id uuid,source_quote text not null default '' check(length(source_quote)<=8000),
 source text not null default 'manual' check(source in ('manual','explicit_message')),
 proposed_value jsonb,updated_at timestamptz not null default now(),created_at timestamptz not null default now(),
 unique(tenant_id,customer_id,field_id),
 foreign key(tenant_id,customer_id) references public.crm_customers(tenant_id,id),
 foreign key(tenant_id,field_id) references public.crm_field_definitions(tenant_id,id),
 foreign key(tenant_id,source_interaction_id) references public.crm_interactions(tenant_id,id),
 check(proposed_value is null or octet_length(proposed_value::text)<=2000)
);
create index crm_information_customer on public.crm_information_states(tenant_id,customer_id);
do $$ declare t text;begin foreach t in array array['crm_field_definitions','crm_information_states'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon',t);
 execute format('grant select,insert,update on public.%I to authenticated',t);
 execute format('create policy own_read on public.%I for select to authenticated using(tenant_id=(select auth.uid()) or (select public.is_admin()))',t);
 execute format('create policy own_insert on public.%I for insert to authenticated with check((tenant_id=(select auth.uid()) and (select public.has_active_crm())) or (select public.is_admin()))',t);
 execute format('create policy own_update on public.%I for update to authenticated using((tenant_id=(select auth.uid()) and (select public.has_active_crm())) or (select public.is_admin())) with check((tenant_id=(select auth.uid()) and (select public.has_active_crm())) or (select public.is_admin()))',t);
 execute format('create trigger crm_record_write after insert or update on public.%I for each row execute function private.crm_after_write()',t);
end loop;end $$;

-- Pure validation shared by manual updates and explicit message extraction.
create function private.crm_validate_field(f public.crm_field_definitions,v jsonb) returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare s text;m integer;d integer;begin
 if v is null or v='null'::jsonb or v='""'::jsonb then return '""'::jsonb;end if;
 if octet_length(v::text)>2000 then raise exception 'crm_field_too_long';end if;
 s=trim(v#>>'{}');
 if f.type='multiselect' then
  if jsonb_typeof(v)<>'array' or exists(select 1 from jsonb_array_elements(v) x where not f.options @> jsonb_build_array(x)) then raise exception 'crm_field_invalid_options';end if;return v;
 end if;
 if jsonb_typeof(v) not in ('string','number') then raise exception 'crm_field_invalid_value';end if;
 if f.type='number' then
  s=translate(s,'۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩','01234567890123456789');
  if s!~'^-?[0-9]{1,15}(\.[0-9]{1,6})?$' then raise exception 'crm_field_invalid_number';end if;return to_jsonb(s::numeric);
 elsif f.type='select' then
  if not f.options @> jsonb_build_array(s) then raise exception 'crm_field_invalid_option';end if;
 elsif f.type='date' then
  if s!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'crm_field_invalid_date';end if;perform s::date;
 elsif f.type='birthday' then
  s=translate(s,'۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩','01234567890123456789');
  if s!~'^[0-9]{1,2}/[0-9]{1,2}$' then raise exception 'crm_field_invalid_birthday';end if;
  m=split_part(s,'/',1)::integer;d=split_part(s,'/',2)::integer;
  if m not between 1 and 12 or d<1 or d>(case when m<=6 then 31 else 30 end) then raise exception 'crm_field_invalid_birthday';end if;
  s=lpad(m::text,2,'0')||'/'||lpad(d::text,2,'0');
 end if;return to_jsonb(s);
end $$;
revoke all on function private.crm_validate_field(public.crm_field_definitions,jsonb) from public,anon,authenticated;

create function private.crm_definition_guard() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if tg_op='UPDATE' and (new.tenant_id<>old.tenant_id or new.key<>old.key or new.type<>old.type) then raise exception 'crm_definition_identity_immutable';end if;
 if exists(select 1 from jsonb_array_elements(new.options) x where jsonb_typeof(x)<>'string' or length(x#>>'{}') not between 1 and 120) then raise exception 'crm_field_invalid_options';end if;
 if new.type in ('select','multiselect') and jsonb_array_length(new.options)=0 then raise exception 'crm_field_options_required';end if;
 new.updated_at=now();return new;
end $$;
revoke all on function private.crm_definition_guard() from public,anon,authenticated;
create trigger crm_definition_guard before insert or update on public.crm_field_definitions for each row execute function private.crm_definition_guard();

-- Validate defined profile values on all write paths, including the existing customer editor.
create function private.crm_profile_guard() returns trigger language plpgsql security definer set search_path='' as $$ declare f public.crm_field_definitions;v jsonb;begin
 for f in select * from public.crm_field_definitions where tenant_id=new.tenant_id loop
  if new.custom_fields ? f.key and (tg_op='INSERT' or new.custom_fields->f.key is distinct from old.custom_fields->f.key) then
   v=private.crm_validate_field(f,new.custom_fields->f.key);new.custom_fields=jsonb_set(new.custom_fields,array[f.key],v);
  end if;
 end loop;return new;
end $$;
revoke all on function private.crm_profile_guard() from public,anon,authenticated;
create trigger crm_profile_guard before insert or update on public.crm_customers for each row execute function private.crm_profile_guard();

create function private.crm_profile_information() returns trigger language plpgsql security definer set search_path='' as $$ declare f public.crm_field_definitions;v jsonb;begin
 for f in select * from public.crm_field_definitions where tenant_id=new.tenant_id loop
  v=new.custom_fields->f.key;
  if (tg_op='INSERT' or v is distinct from old.custom_fields->f.key) and v is not null then
   insert into public.crm_information_states(tenant_id,customer_id,field_id,status,source)
   values(new.tenant_id,new.id,f.id,case when v='""'::jsonb or v='[]'::jsonb or v='null'::jsonb then 'deferred' else 'confirmed' end,'manual')
   on conflict(tenant_id,customer_id,field_id) do update set status=excluded.status,source='manual',source_interaction_id=null,source_quote='',proposed_value=null,updated_at=now();
  end if;
 end loop;return new;
end $$;
revoke all on function private.crm_profile_information() from public,anon,authenticated;
create trigger crm_profile_information after insert or update on public.crm_customers for each row execute function private.crm_profile_information();

-- Explicit labeled statements only. No guessing; conflicting values enter review.
create function private.crm_extract_information() returns trigger language plpgsql security definer set search_path='' as $$
declare f public.crm_field_definitions;line text;raw text;v jsonb;existing jsonb;begin
 if new.direction<>'inbound' or new.kind not in ('message','call') then return new;end if;
 perform 1 from public.crm_customers where tenant_id=new.tenant_id and id=new.customer_id for update;
 for f in select * from public.crm_field_definitions where tenant_id=new.tenant_id and enabled loop
  for line in select trim(x) from regexp_split_to_table(new.body,E'\n') x loop
   raw=null;
   if split_part(replace(line,'：',':'),':',1)=f.label and position(':' in replace(line,'：',':'))>0 then raw=trim(substring(replace(line,'：',':') from position(':' in replace(line,'：',':'))+1));
   elsif f.key='birthday' and line~'^تولدم [۰-۹٠-٩0-9]{1,2}/[۰-۹٠-٩0-9]{1,2}$' then raw=substring(line from 7);
   end if;
   if raw is null or raw='' then continue;end if;
   begin v=private.crm_validate_field(f,to_jsonb(raw));exception when others then continue;end;
   select custom_fields->f.key into existing from public.crm_customers where tenant_id=new.tenant_id and id=new.customer_id;
   if existing is null or existing in ('""'::jsonb,'null'::jsonb,'[]'::jsonb) then
    update public.crm_customers set custom_fields=jsonb_set(custom_fields,array[f.key],v),updated_at=now() where tenant_id=new.tenant_id and id=new.customer_id;
   end if;
   insert into public.crm_information_states(tenant_id,customer_id,field_id,status,source,source_interaction_id,source_quote,proposed_value)
   values(new.tenant_id,new.customer_id,f.id,case when existing is not null and existing not in ('""'::jsonb,'null'::jsonb,'[]'::jsonb) and existing<>v then 'review' else 'confirmed' end,'explicit_message',new.id,line,v)
   on conflict(tenant_id,customer_id,field_id) do update set status=excluded.status,source=excluded.source,source_interaction_id=excluded.source_interaction_id,source_quote=excluded.source_quote,proposed_value=excluded.proposed_value,updated_at=now();
  end loop;
 end loop;return new;
end $$;
revoke all on function private.crm_extract_information() from public,anon,authenticated;
create trigger crm_extract_information after insert on public.crm_interactions for each row execute function private.crm_extract_information();

-- Explicit review resolution; runs with the customer's RLS permissions.
create function public.crm_resolve_information(p_customer uuid,p_field uuid,p_accept boolean) returns void language plpgsql security invoker set search_path='' as $$
declare tenant uuid=auth.uid();s public.crm_information_states;f public.crm_field_definitions;begin
 if tenant is null or not public.has_active_crm() then raise exception 'crm_access_denied';end if;
 perform 1 from public.crm_customers where tenant_id=tenant and id=p_customer for update;
 select * into s from public.crm_information_states where tenant_id=tenant and customer_id=p_customer and field_id=p_field and status='review' for update;
 if not found then raise exception 'crm_review_missing';end if;
 select * into f from public.crm_field_definitions where tenant_id=tenant and id=p_field;
 if p_accept then
  update public.crm_customers set custom_fields=jsonb_set(custom_fields,array[f.key],s.proposed_value),updated_at=now() where tenant_id=tenant and id=p_customer;
  update public.crm_information_states set status='confirmed',source=s.source,source_interaction_id=s.source_interaction_id,source_quote=s.source_quote,proposed_value=null,updated_at=now() where id=s.id and tenant_id=tenant;
 else
  update public.crm_information_states set status='confirmed',source='manual',source_interaction_id=null,source_quote='',proposed_value=null,updated_at=now() where id=s.id and tenant_id=tenant;
 end if;
end $$;
revoke all on function public.crm_resolve_information(uuid,uuid,boolean) from public,anon;
grant execute on function public.crm_resolve_information(uuid,uuid,boolean) to authenticated;

create function public.crm_information_action(p_customer uuid,p_field uuid,p_action text) returns void language plpgsql security invoker set search_path='' as $$
declare tenant uuid=auth.uid();begin
 if tenant is null or not public.has_active_crm() then raise exception 'crm_access_denied';end if;
 if p_action not in ('asked','deferred','declined','reset') then raise exception 'crm_invalid_action';end if;
 if not exists(select 1 from public.crm_customers where tenant_id=tenant and id=p_customer) or not exists(select 1 from public.crm_field_definitions where tenant_id=tenant and id=p_field) then raise exception 'crm_record_missing';end if;
 insert into public.crm_information_states(tenant_id,customer_id,field_id,status,last_asked_at,next_ask_at)
 values(tenant,p_customer,p_field,case when p_action='reset' then 'deferred' else p_action end,case when p_action='asked' then now() end,case when p_action='asked' then now()+interval '30 days' when p_action='deferred' then now()+interval '7 days' end)
 on conflict(tenant_id,customer_id,field_id) do update set status=excluded.status,last_asked_at=case when p_action='reset' then null when p_action='asked' then now() else crm_information_states.last_asked_at end,next_ask_at=excluded.next_ask_at,updated_at=now();
end $$;
revoke all on function public.crm_information_action(uuid,uuid,text) from public,anon;
grant execute on function public.crm_information_action(uuid,uuid,text) to authenticated;

create function public.crm_information_queue(p_limit integer default 100) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (
 select c.id customer_id,c.name customer_name,f.id field_id,f.label,f.question,f.priority,f.condition
 from public.crm_customers c cross join lateral (
  select f.* from public.crm_field_definitions f left join public.crm_information_states s on s.tenant_id=f.tenant_id and s.customer_id=c.id and s.field_id=f.id
  where f.tenant_id=c.tenant_id and f.enabled and f.ask_enabled and trim(f.question)<>''
   and coalesce(c.custom_fields->f.key,c.custom_fields->f.label,'""'::jsonb) in ('""'::jsonb,'null'::jsonb,'[]'::jsonb)
   and coalesce(s.status,'') not in ('declined','review') and (s.next_ask_at is null or s.next_ask_at<=now())
   and (f.condition='always' or f.condition='after_purchase' and exists(select 1 from public.crm_orders o where o.tenant_id=c.tenant_id and o.customer_id=c.id and o.status='paid') or f.condition='active_lead' and exists(select 1 from public.crm_leads l where l.tenant_id=c.tenant_id and l.customer_id=c.id and l.stage not in ('won','lost')))
  order by f.priority desc,f.label limit 1
 ) f
 where c.tenant_id=auth.uid() and public.has_active_crm() and not c.do_not_contact and c.status<>'closed'
  and not exists(select 1 from public.crm_information_states s where s.tenant_id=c.tenant_id and s.customer_id=c.id and s.last_asked_at>now()-interval '24 hours')
  and not exists(select 1 from public.crm_interactions i where i.tenant_id=c.tenant_id and i.customer_id=c.id and i.direction='inbound' and i.occurred_at>now()-interval '24 hours' and i.body~'(شکایت|ناراضی|خراب|فوری|عجله)')
 order by f.priority desc,c.created_at desc limit least(greatest(p_limit,1),500)
 ) q;
$$;
revoke all on function public.crm_information_queue(integer) from public,anon;
grant execute on function public.crm_information_queue(integer) to authenticated;
commit;

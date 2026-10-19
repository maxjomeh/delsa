begin;
create or replace function public.crm_review_learning_suggestion(p_id uuid,p_accept boolean)
returns jsonb language plpgsql security definer set search_path='' as $f$
declare s public.crm_learning_suggestions%rowtype; c public.crm_customers%rowtype;
begin
 if auth.uid() is null or not public.has_active_crm() then raise exception 'crm_access_denied';end if;
 select * into s from public.crm_learning_suggestions where id=p_id and tenant_id=auth.uid() for update;
 if not found then raise exception 'suggestion_not_found';end if;
 if s.status<>'pending' then raise exception 'already_reviewed';end if;
 if p_accept then
  if s.kind='new_field' and s.field_key='truck_model' and s.support_count>=3 then
   insert into public.crm_field_definitions(tenant_id,key,label,type,priority,question,condition,enabled,ask_enabled)
   values(s.tenant_id,'truck_model','مدل کشنده','text',70,'مدل کشنده شما چیست؟','always',true,false)
   on conflict(tenant_id,key) do nothing;
  elsif s.kind='phone' and s.customer_id is not null and s.confidence>=0.90 then
   select * into c from public.crm_customers where tenant_id=s.tenant_id and id=s.customer_id for update;
   if c.phone<>'' and c.phone<>s.proposed_value then raise exception 'phone_conflict';end if;
   if c.phone='' then
    update public.crm_customers set phone=s.proposed_value,updated_at=now() where tenant_id=s.tenant_id and id=s.customer_id;
   end if;
  elsif s.kind='truck_model' and s.customer_id is not null then
   select * into c from public.crm_customers where tenant_id=s.tenant_id and id=s.customer_id for update;
   if coalesce(c.custom_fields->>'truck_model','')<>'' and c.custom_fields->>'truck_model'<>s.proposed_value then raise exception 'value_conflict';end if;
   update public.crm_customers
    set custom_fields=jsonb_set(custom_fields,'{truck_model}',to_jsonb(s.proposed_value),true),updated_at=now()
    where tenant_id=s.tenant_id and id=s.customer_id;
  else
   raise exception 'low_confidence_or_unsupported';
  end if;
 end if;
 update public.crm_learning_suggestions set status=case when p_accept then 'accepted' else 'rejected' end,updated_at=now() where id=p_id;
 return jsonb_build_object('reviewed',true,'accepted',p_accept);
end $f$;
revoke all on function public.crm_review_learning_suggestion(uuid,boolean) from public,anon;
grant execute on function public.crm_review_learning_suggestion(uuid,boolean) to authenticated;
commit;
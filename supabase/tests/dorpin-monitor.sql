begin;
-- All test writes are rolled back; use an existing entitled account without returning identity.
do $$
declare u uuid; m uuid; c jsonb; r public.dorpin_monitors; offers jsonb;
begin
 select s.customer_id into u from public.customer_subscriptions s join public.store_products p on p.id=s.product_id where p.service_code='dorpin' and s.starts_at<=now() and s.expires_at>now() limit 1;
 if u is null then raise exception 'No active DorPin account available for transactional test';end if;
 insert into public.dorpin_monitors(user_id,dkp,label) values(u,'999999999999','transactional test') returning id into m;
 c=public.dorpin_monitor_action(u,m,'claim');
 if c->>'token' is null then raise exception 'claim failed';end if;
 if not (public.dorpin_monitor_action(u,m,'claim')->>'busy')::boolean then raise exception 'rate limit failed';end if;
 offers='[{"id":"1","sellerId":"1","seller":"A","price":1000,"group":"a"},{"id":"2","sellerId":"2","seller":"B","price":100,"group":"b"},{"id":"3","sellerId":"3","seller":"C","price":800,"group":"a"}]';
 perform public.dorpin_monitor_action(u,m,'finish',jsonb_build_object('token',c->>'token','title','test','offers',offers));
 perform public.dorpin_monitor_action(u,m,'select','{"offer":"1"}');
 perform public.dorpin_monitor_action(u,m,'configure','{"mode":"automatic","min_saving":100,"interval_minutes":60}');
 update public.dorpin_monitors set attempted_at=now()-interval '2 minutes' where id=m;
 c=public.dorpin_monitor_action(u,m,'claim');
 perform public.dorpin_monitor_action(u,m,'finish',jsonb_build_object('token',c->>'token','title','test','offers',offers));
 select * into r from public.dorpin_monitors where id=m;
 if r.selected_offer<>'3' then raise exception 'automatic variant-safe recommendation failed';end if;
 update public.dorpin_monitors set attempted_at=now()-interval '2 minutes' where id=m;
 c=public.dorpin_monitor_action(u,m,'claim');
 perform public.dorpin_monitor_action(u,m,'finish',jsonb_build_object('token',c->>'token','error','upstream error'));
 select * into r from public.dorpin_monitors where id=m;
 if r.offers<>offers or r.selected_offer<>'3' or r.error is null then raise exception 'failure destroyed prior state';end if;
 if has_table_privilege('authenticated','public.dorpin_monitors','INSERT') or has_function_privilege('authenticated','public.dorpin_monitor_action(uuid,uuid,text,jsonb)','EXECUTE') then raise exception 'client write privilege leaked';end if;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
end $$;
set local role authenticated;
do $$begin if exists(select 1 from public.dorpin_monitors) then raise exception 'cross-tenant read leaked';end if;end $$;
reset role;
rollback;

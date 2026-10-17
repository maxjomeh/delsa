-- Run only AFTER approval and installation of builder-free-plan.sql.
-- All fixtures, enrollment and subscriptions are rolled back.
begin;
do $$
declare a uuid; b uuid; sid uuid; pid uuid; archived uuid; denied boolean; slug text; plan jsonb; result jsonb; vid uuid;
begin
 select id into a from public.profiles where role<>'admin' order by created_at limit 1;
 select id into b from public.profiles where role<>'admin' and id<>a order by created_at limit 1;
 if a is null or b is null then raise exception 'two accounts needed';end if;
 update public.customer_subscriptions set expires_at=now()-interval '1 second' where customer_id=a and product_id='38ba2004-0021-4717-b06f-dc21493b83b5';
 perform set_config('request.jwt.claim.sub',a::text,true);execute 'set local role authenticated';
 insert into public.builder_free_memberships(customer_id) values(a) on conflict do nothing;
 if not public.has_site_builder_access() then raise exception 'free enrollment denied';end if;
 denied=false;begin insert into public.builder_free_memberships(customer_id) values(b);exception when insufficient_privilege then denied=true;end;
 if not denied then raise exception 'cross-account enrollment';end if;
 slug='free-test-'||substr(gen_random_uuid()::text,1,12);
 insert into public.builder_sites(owner_id,name,slug,draft) values(a,'آزمون رایگان',slug,'{"pages":[{"id":"home","slug":"","title":"خانه","blocks":[]}]}') returning id into sid;
 for i in 1..10 loop
  insert into public.builder_products(site_id,title,slug,kind,status) values(sid,'محصول آزمون '||i,'test-'||i,'simple','published') returning id into pid;
 end loop;
 plan=public.get_builder_site_plan(sid);
 if (plan->>'paid')::boolean or (plan->>'used')::integer<>10 or (plan->>'limit')::integer<>10 then raise exception 'incorrect free quota';end if;
 denied=false;begin insert into public.builder_products(site_id,title,slug,kind,status) values(sid,'اضافه','extra','simple','published');exception when raise_exception then if sqlerrm='builder_free_product_limit' then denied=true;else raise;end if;end;
 if not denied then raise exception 'eleventh direct insert';end if;
 denied=false;begin
  perform public.save_builder_product(sid,null,'{"title":"محصول اضافه","slug":"rpc-extra","kind":"simple","status":"published"}','[{"label":"پیش‌فرض","sku":"TEST-EXTRA","price":100,"stock":1,"manage_stock":true}]',null);
 exception when raise_exception then if sqlerrm='builder_free_product_limit' then denied=true;else raise;end if;end;
 if not denied then raise exception 'eleventh RPC insert';end if;
 insert into public.builder_products(site_id,title,slug,kind,status) values(sid,'بایگانی','archived','simple','archived') returning id into archived;
 denied=false;begin update public.builder_products set status='published' where id=archived;exception when raise_exception then if sqlerrm='builder_free_product_limit' then denied=true;else raise;end if;end;
 if not denied then raise exception 'quota bypass through reactivation';end if;
 update public.builder_products set status='archived' where id=pid;
 update public.builder_products set status='published' where id=archived;
 update public.builder_products set title='ویرایش مجاز' where id=archived;
 insert into public.builder_variants(site_id,product_id,label,sku,price,stock,manage_stock) values(sid,archived,'پیش‌فرض','FREE-TEST',1000,2,true) returning id into vid;
 insert into public.builder_shop_settings(site_id,accepting_orders,allow_cod) values(sid,true,true);
 perform public.publish_builder_site(sid);
 perform set_config('request.jwt.claim.sub',b::text,true);
 if exists(select 1 from public.builder_sites where id=sid) then raise exception 'cross-account draft read';end if;
 denied=false;begin perform public.get_builder_site_plan(sid);exception when raise_exception then denied=true;end;
 if not denied then raise exception 'cross-account plan read';end if;
 execute 'reset role';perform set_config('request.jwt.claim.sub','',true);execute 'set local role anon';
 result=public.checkout_builder_store(slug,gen_random_uuid(),'{"full_name":"خریدار آزمون","phone":"09123456789","province":"فارس","city":"شیراز","address":"نشانی آزمون","postal_code":"1234567890"}',jsonb_build_array(jsonb_build_object('variant_id',vid,'quantity',1)),'','cod');
 if (result->>'total')::bigint<>1000 then raise exception 'free checkout amounts';end if;
 denied=false;begin insert into public.builder_free_memberships(customer_id) values(b);exception when insufficient_privilege then denied=true;end;
 if not denied then raise exception 'anonymous enrollment';end if;
 execute 'reset role';
 insert into public.customer_subscriptions(customer_id,product_id,plan,starts_at,expires_at) values(a,'38ba2004-0021-4717-b06f-dc21493b83b5','demo',now()-interval '1 minute',now()+interval '1 day');
 perform set_config('request.jwt.claim.sub',a::text,true);execute 'set local role authenticated';
 insert into public.builder_products(site_id,title,slug,kind,status) values(sid,'محصول اشتراک','paid-extra','simple','published');
 if not (public.get_builder_site_plan(sid)->>'paid')::boolean then raise exception 'paid owner plan';end if;
 execute 'reset role';
end $$;
select 'PASS: explicit enrollment, ten products, direct/RPC/import quota, archive/reactivation, ownership, guest checkout and paid upgrade' as result;
rollback;

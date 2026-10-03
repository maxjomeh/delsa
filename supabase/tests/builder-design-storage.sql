begin;
do $$ declare a uuid;b uuid;sid uuid;objectname text;denied boolean;begin
 select id into a from public.profiles where role<>'admin' order by created_at limit 1;
 select id into b from public.profiles where role<>'admin' and id<>a order by created_at limit 1;
 if a is null or b is null then raise exception 'need two customer fixtures';end if;
 insert into public.customer_subscriptions(customer_id,product_id,plan,starts_at,expires_at) values(a,'38ba2004-0021-4717-b06f-dc21493b83b5','demo',now()-interval '1 minute',now()+interval '1 day'),(b,'38ba2004-0021-4717-b06f-dc21493b83b5','demo',now()-interval '1 minute',now()+interval '1 day');
 perform set_config('request.jwt.claim.sub',a::text,true);execute 'set local role authenticated';
 insert into public.builder_sites(owner_id,name,slug,draft) values(a,'آزمون تصویر','design-test-'||substr(gen_random_uuid()::text,1,8),'{"pages":[]}') returning id into sid;
 objectname=sid::text||'/design-test.webp';
 insert into storage.objects(bucket_id,name,owner_id) values('builder-product-images',objectname,a::text);
 if not exists(select 1 from storage.objects where bucket_id='builder-product-images' and name=objectname)then raise exception 'owner cannot read own upload';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 if exists(select 1 from storage.objects where bucket_id='builder-product-images' and name=objectname)then raise exception 'cross owner private object listing';end if;
 denied=false;begin insert into storage.objects(bucket_id,name,owner_id) values('builder-product-images',sid::text||'/cross-owner.webp',b::text);exception when insufficient_privilege then denied=true;end;
 if not denied then raise exception 'cross owner upload allowed';end if;
 execute 'reset role';raise notice 'PASS: valid image path accepted and cross-owner upload/list denied';
end $$;
rollback;

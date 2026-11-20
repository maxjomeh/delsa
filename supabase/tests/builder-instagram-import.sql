-- Run AFTER builder-instagram.sql and builder-instagram-import.sql (locally: supabase/tests/local-postgres/run.sh supabase/tests/builder-instagram-import.sql).
-- Needs two ordinary accounts. Everything is rolled back.
begin;
do $$
declare a uuid;b uuid;sa uuid;sb uuid;pa uuid;pb uuid;pdraft uuid;acc uuid;rid uuid;n integer;denied boolean;slug text;vid jsonb;
begin
 select id into a from public.profiles where role<>'admin' order by id limit 1;
 select id into b from public.profiles where role<>'admin' and id<>a order by id limit 1;
 if a is null or b is null then raise exception 'two accounts needed';end if;
 slug='ig-a-'||substr(gen_random_uuid()::text,1,10);insert into public.builder_sites(owner_id,name,slug,draft) values(a,'سایت الف',slug,'{"pages":[]}') returning id into sa;
 slug='ig-b-'||substr(gen_random_uuid()::text,1,10);insert into public.builder_sites(owner_id,name,slug,draft) values(b,'سایت ب',slug,'{"pages":[]}') returning id into sb;
 insert into public.builder_products(site_id,title,slug,kind,status) values(sa,'محصول الف','p-a','simple','published') returning id into pa;
 insert into public.builder_products(site_id,title,slug,kind,status) values(sb,'محصول ب','p-b','simple','published') returning id into pb;
 insert into public.builder_products(site_id,title,slug,kind,status) values(sa,'پیش‌نویس الف','p-draft','simple','draft') returning id into pdraft;
 insert into public.builder_publications(site_id,slug,name,document,is_live) values(sa,slug||'x','سایت الف','{"pages":[]}',true);
 insert into private.builder_instagram_tokens(account_row,ciphertext) select (select id from public.builder_instagram_accounts limit 0),'x' where false;
 execute 'set local role service_role';
 acc=public.builder_connect_instagram(a,'17841400000555','shop_a',repeat('x',48),now()+interval '60 days');
 -- ---- record an import with videos
 rid=public.builder_instagram_record_import(a,sa,pa,acc,'17900000000001','reel','https://www.instagram.com/reel/R1/',now(),'کپشن',jsonb_build_array(jsonb_build_object('url','https://cdn.example/v1.mp4','poster','https://cdn.example/p1.jpg','bytes',1234)));
 if rid is null then raise exception 'record_import returns the row id';end if;
 reset role;
 if (select count(*) from public.builder_product_videos where product_id=pa)<>1 then raise exception 'one video recorded';end if;
 -- ---- duplicates, forbidden combinations, invalid input
 execute 'set local role service_role';
 denied=false;begin perform public.builder_instagram_record_import(a,sa,pa,acc,'17900000000001','reel','',now(),'',null);exception when others then denied=(sqlerrm like '%builder_instagram_duplicate%');end;
 if not denied then raise exception 'the same media cannot be imported twice into one site';end if;
 denied=false;begin perform public.builder_instagram_record_import(b,sa,pa,null,'17900000000002','image','',now(),'',null);exception when others then denied=(sqlerrm like '%builder_instagram_forbidden%');end;
 if not denied then raise exception 'another owner cannot record into this site';end if;
 denied=false;begin perform public.builder_instagram_record_import(a,sa,pb,null,'17900000000003','image','',now(),'',null);exception when others then denied=(sqlerrm like '%builder_instagram_forbidden%');end;
 if not denied then raise exception 'a product of another site is refused';end if;
 denied=false;begin perform public.builder_instagram_record_import(b,sb,pb,acc,'17900000000004','image','',now(),'',null);exception when others then denied=(sqlerrm like '%builder_instagram_forbidden%');end;
 if not denied then raise exception 'an Instagram account of another owner is refused';end if;
 denied=false;begin perform public.builder_instagram_record_import(a,sa,pdraft,null,'17900000000005','image','',now(),'','[1,2,3,4]'::jsonb);exception when others then denied=(sqlerrm like '%builder_instagram_invalid%');end;
 if not denied then raise exception 'more than 3 videos is refused';end if;
 denied=false;begin perform public.builder_instagram_record_import(a,sa,pdraft,null,'not-numeric','image','',now(),'',null);exception when others then denied=true;end;
 if not denied then raise exception 'non numeric media id is refused';end if;
 denied=false;begin perform public.builder_instagram_record_import(a,sa,pdraft,null,'17900000000006','image','',now(),'',jsonb_build_array(jsonb_build_object('url','http://insecure/v.mp4','bytes',10)));exception when others then denied=true;end;
 if not denied then raise exception 'non-https video url is refused';end if;
 denied=false;begin perform public.builder_instagram_record_import(a,sa,pdraft,null,'17900000000007','image','',now(),'',jsonb_build_array(jsonb_build_object('url','https://cdn.example/big.mp4','bytes',52428801)));exception when others then denied=true;end;
 if not denied then raise exception 'videos above 50 MB are refused';end if;
 reset role;
 if exists(select 1 from public.builder_instagram_imports where media_id in ('17900000000002','17900000000003','17900000000004','17900000000005','17900000000006','17900000000007')) then raise exception 'refused imports leave nothing behind';end if;
 -- ---- media quota helper counts both buckets of one site only
 insert into storage.objects(bucket_id,name,metadata) values('builder-product-images',sa::text||'/a.jpg','{"size":1000}'),('builder-product-videos',sa::text||'/v.mp4','{"size":5000}'),('builder-product-images',sb::text||'/b.jpg','{"size":777}');
 execute 'set local role service_role';
 if public.builder_site_media_bytes(sa)<>6000 or public.builder_site_media_bytes(sb)<>777 then raise exception 'quota helper counts per site (got %)',public.builder_site_media_bytes(sa);end if;
 reset role;
 -- ---- browser roles
 perform set_config('request.jwt.claim.sub',a::text,true);execute 'set local role authenticated';
 select count(*) into n from public.builder_instagram_imports;if n<>1 then raise exception 'owner sees own imports (saw %)',n;end if;
 select count(*) into n from public.builder_product_videos;if n<>1 then raise exception 'owner sees own videos (saw %)',n;end if;
 denied=false;begin perform public.builder_instagram_record_import(a,sa,pa,acc,'17900000000009','image','',now(),'',null);exception when others then denied=true;end;
 if not denied then raise exception 'recording is service-only';end if;
 denied=false;begin perform public.builder_site_media_bytes(sa);exception when others then denied=true;end;
 if not denied then raise exception 'quota helper is service-only';end if;
 denied=false;begin insert into public.builder_product_videos(site_id,product_id,url,bytes) values(sa,pa,'https://x/v.mp4',10);exception when others then denied=true;end;
 if not denied then raise exception 'direct video inserts are refused';end if;
 reset role;
 perform set_config('request.jwt.claim.sub',b::text,true);execute 'set local role authenticated';
 select count(*) into n from public.builder_instagram_imports;if n<>0 then raise exception 'another owner sees no imports (saw %)',n;end if;
 select count(*) into n from public.builder_product_videos;if n<>1 then raise exception 'published videos of a live site are public (saw %)',n;end if;
 reset role;
 -- ---- public (anon): videos only for published products of live sites
 execute 'set local role anon';
 select count(*) into n from public.builder_product_videos;if n<>1 then raise exception 'anon sees the published video (saw %)',n;end if;
 denied=false;begin perform caption from public.builder_instagram_imports;exception when others then denied=true;end;
 if not denied then raise exception 'anon cannot read captions of imports';end if;
 reset role;
 update public.builder_products set status='draft' where id=pa;
 execute 'set local role anon';select count(*) into n from public.builder_product_videos;if n<>0 then raise exception 'a draft product hides its videos (saw %)',n;end if;reset role;
 update public.builder_products set status='published' where id=pa;update public.builder_publications set is_live=false where site_id=sa;
 execute 'set local role anon';select count(*) into n from public.builder_product_videos;if n<>0 then raise exception 'an offline site hides its videos (saw %)',n;end if;reset role;
 -- ---- deleting the product removes the link and videos
 delete from public.builder_products where id=pa;
 if exists(select 1 from public.builder_instagram_imports where product_id=pa) or exists(select 1 from public.builder_product_videos where product_id=pa) then raise exception 'cascade on product delete';end if;
 raise notice 'PASS: instagram import (dedupe, owner checks, video limits, quota helper, public/owner/anon visibility)';
end $$;
rollback;

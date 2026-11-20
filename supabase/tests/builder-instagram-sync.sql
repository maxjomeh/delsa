-- Run AFTER builder-instagram.sql, builder-instagram-import.sql and builder-instagram-sync.sql
-- (locally: supabase/tests/local-postgres/run.sh supabase/tests/builder-instagram-sync.sql). Everything is rolled back.
begin;
do $$
declare a uuid;b uuid;sa uuid;pa uuid;pa2 uuid;acc uuid;accb uuid;n integer;denied boolean;slug text;sug uuid;
begin
 select id into a from public.profiles where role<>'admin' order by id limit 1;
 select id into b from public.profiles where role<>'admin' and id<>a order by id limit 1;
 slug='ig-s-'||substr(gen_random_uuid()::text,1,10);insert into public.builder_sites(owner_id,name,slug,draft) values(a,'سایت الف',slug,'{"pages":[]}') returning id into sa;
 insert into public.builder_products(site_id,title,slug,kind,status) values(sa,'محصول','p-a','simple','published') returning id into pa;
 insert into public.builder_products(site_id,title,slug,kind,status) values(sa,'محصول دوم','p-b','simple','draft') returning id into pa2;
 insert into public.builder_publications(site_id,slug,name,document,is_live) values(sa,slug||'x','سایت الف','{"pages":[]}',true);
 execute 'set local role service_role';
 acc=public.builder_connect_instagram(a,'17841400000777','shop_a',repeat('x',48),now()+interval '60 days');
 accb=public.builder_connect_instagram(b,'17841400000778','shop_b',repeat('y',48),now()+interval '60 days');
 -- ---- due accounts: never checked first; checked just now is not due
 if (select count(*) from public.builder_instagram_due_accounts(10) where id in (acc,accb))<>2 then raise exception 'unchecked accounts are due';end if;
 if (select connected_at from public.builder_instagram_sync_state(a,acc)) is null then raise exception 'sync state readable';end if;
 if exists(select 1 from public.builder_instagram_sync_state(b,acc)) then raise exception 'sync state is owner scoped';end if;
 -- ---- record a sync: stories/invalid ids skipped, imported media skipped, duplicates idempotent
 perform public.builder_instagram_record_import(a,sa,pa,acc,'18000000000001','image','https://www.instagram.com/p/A/',now(),'قدیمی',null);
 n=public.builder_instagram_record_sync(a,acc,now(),jsonb_build_array(
   jsonb_build_object('id','18000000000001','kind','image','caption','تکراری وارد شده','permalink','https://www.instagram.com/p/A/'),
   jsonb_build_object('id','18000000000002','kind','reel','caption','ریلز تازه','permalink','https://www.instagram.com/reel/B/','posted_at',now()),
   jsonb_build_object('id','18000000000003','kind','story','caption',''),
   jsonb_build_object('id','bad','kind','image'),
   jsonb_build_object('id','18000000000004','kind','image','caption','پست تازه')));
 if n<>2 then raise exception 'two new suggestions expected (got %)',n;end if;
 if public.builder_instagram_record_sync(a,acc,now(),jsonb_build_array(jsonb_build_object('id','18000000000002','kind','reel')))<>0 then raise exception 'sync is idempotent';end if;
 if exists(select 1 from public.builder_instagram_due_accounts(10) where id=acc) then raise exception 'a freshly checked account is not due';end if;
 denied=false;begin perform public.builder_instagram_record_sync(b,acc,now(),'[]'::jsonb);exception when others then denied=(sqlerrm like '%builder_instagram_forbidden%');end;
 if not denied then raise exception 'another owner cannot record a sync for this account';end if;
 denied=false;begin perform public.builder_instagram_record_sync(a,acc,now(),(select jsonb_agg(jsonb_build_object('id','1','kind','image')) from generate_series(1,51)));exception when others then denied=(sqlerrm like '%builder_instagram_invalid%');end;
 if not denied then raise exception 'more than 50 items refused';end if;
 -- ---- importing a suggested post closes the suggestion
 perform public.builder_instagram_record_import(a,sa,pa2,acc,'18000000000002','reel','https://www.instagram.com/reel/B/',now(),'ریلز تازه',null);
 reset role;
 if (select status from public.builder_instagram_suggestions where media_id='18000000000002')<>'imported' then raise exception 'importing closes the suggestion';end if;
 if (select count(*) from public.builder_instagram_suggestions where status='new')<>1 then raise exception 'one suggestion remains new';end if;
 -- ---- change detection
 execute 'set local role service_role';
 if (select count(*) from public.builder_instagram_imports_due(a,acc,10))<>2 then raise exception 'unchecked imports are due';end if;
 perform public.builder_instagram_record_check(a,(select id from public.builder_instagram_imports where media_id='18000000000001'),'changed','کپشن جدید');
 perform public.builder_instagram_record_check(a,(select id from public.builder_instagram_imports where media_id='18000000000002'),'deleted',null);
 perform public.builder_instagram_record_check(b,(select id from public.builder_instagram_imports where media_id='18000000000002'),'ok',null);
 reset role;
 if (select source_state||latest_caption from public.builder_instagram_imports where media_id='18000000000001')<>'changedکپشن جدید' then raise exception 'changed state + caption stored';end if;
 if (select source_state from public.builder_instagram_imports where media_id='18000000000002')<>'deleted' then raise exception 'another owner cannot overwrite the state';end if;
 execute 'set local role service_role';
 perform public.builder_instagram_record_check(a,(select id from public.builder_instagram_imports where media_id='18000000000001'),'ok',null);
 reset role;
 if (select source_state from public.builder_instagram_imports where media_id='18000000000001')<>'changed' then raise exception 'ok never clears a pending change';end if;
 execute 'set local role service_role';
 if exists(select 1 from public.builder_instagram_imports_due(a,acc,10)) then raise exception 'recently checked / deleted imports are not due';end if;
 denied=false;begin perform public.builder_instagram_record_check(a,(select id from public.builder_instagram_imports limit 1),'weird',null);exception when others then denied=(sqlerrm like '%builder_instagram_invalid%');end;
 if not denied then raise exception 'unknown state refused';end if;
 reset role;
 -- ---- browser roles
 perform set_config('request.jwt.claim.sub',a::text,true);execute 'set local role authenticated';
 select count(*) into n from public.builder_instagram_suggestions;if n<>2 then raise exception 'owner sees own suggestions (saw %)',n;end if;
 update public.builder_instagram_suggestions set status='dismissed' where media_id='18000000000004';
 get diagnostics n=row_count;if n<>1 then raise exception 'owner can dismiss';end if;
 denied=false;begin update public.builder_instagram_suggestions set status='imported' where media_id='18000000000004';exception when others then denied=true;end;
 if not denied then raise exception 'owner cannot mark imported directly';end if;
 denied=false;begin update public.builder_instagram_suggestions set caption='x';exception when others then denied=true;end;
 if not denied then raise exception 'owner cannot edit suggestion content';end if;
 update public.builder_instagram_imports set show_link=false where media_id='18000000000001';
 get diagnostics n=row_count;if n<>1 then raise exception 'owner can switch the public link off';end if;
 update public.builder_instagram_imports set source_state='ok',caption=latest_caption where media_id='18000000000001';
 denied=false;begin update public.builder_instagram_imports set permalink='https://evil.example/' where media_id='18000000000001';exception when others then denied=true;end;
 if not denied then raise exception 'permalink is not editable by the browser';end if;
 denied=false;begin perform public.builder_instagram_record_sync(a,acc,now(),'[]'::jsonb);exception when others then denied=true;end;
 if not denied then raise exception 'sync recording is service-only';end if;
 reset role;
 perform set_config('request.jwt.claim.sub',b::text,true);execute 'set local role authenticated';
 select count(*) into n from public.builder_instagram_suggestions;if n<>0 then raise exception 'another owner sees none (saw %)',n;end if;
 update public.builder_instagram_imports set show_link=true;get diagnostics n=row_count;if n<>0 then raise exception 'another owner cannot update imports';end if;
 reset role;
 -- ---- public link: anon sees only link columns, only of published products on live sites with show_link on
 update public.builder_instagram_imports set show_link=true where media_id='18000000000001';
 execute 'set local role anon';
 select count(*) into n from public.builder_instagram_imports;if n<>1 then raise exception 'anon sees the one published, live, linked import (saw %)',n;end if;
 denied=false;begin perform caption from public.builder_instagram_imports;exception when others then denied=true;end;
 if not denied then raise exception 'anon cannot read captions';end if;
 denied=false;begin perform media_id from public.builder_instagram_imports;exception when others then denied=true;end;
 if not denied then raise exception 'anon cannot read media ids';end if;
 perform product_id,permalink,show_link from public.builder_instagram_imports;
 reset role;
 update public.builder_instagram_imports set show_link=false where media_id='18000000000001';
 execute 'set local role anon';select count(*) into n from public.builder_instagram_imports;if n<>0 then raise exception 'show_link=false hides it (saw %)',n;end if;reset role;
 update public.builder_instagram_imports set show_link=true,source_state='deleted' where media_id='18000000000001';
 execute 'set local role anon';select count(*) into n from public.builder_instagram_imports;if n<>0 then raise exception 'a deleted source post hides the link (saw %)',n;end if;reset role;
 update public.builder_instagram_imports set source_state='ok' where media_id='18000000000001';update public.builder_products set status='draft' where id=pa;
 execute 'set local role anon';select count(*) into n from public.builder_instagram_imports;if n<>0 then raise exception 'draft product hides it (saw %)',n;end if;reset role;
 update public.builder_products set status='published' where id=pa;update public.builder_publications set is_live=false where site_id=sa;
 execute 'set local role anon';select count(*) into n from public.builder_instagram_imports;if n<>0 then raise exception 'offline site hides it (saw %)',n;end if;reset role;
 raise notice 'PASS: instagram sync (suggestions, dedupe, change detection, owner isolation, public link visibility)';
end $$;
rollback;

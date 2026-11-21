-- Verifies builder-instagram-sync-rollback.sql removes the step-4 objects and leaves steps 1-3 working. The rollback file commits, so run this test LAST (it leaves the throw-away database without step 4).
begin;
do $$ declare a uuid;sa uuid;pa uuid;acc uuid;begin
 select id into a from public.profiles where role<>'admin' order by id limit 1;
 insert into public.builder_sites(owner_id,name,slug,draft) values(a,'سایت آزمون','rb-'||substr(gen_random_uuid()::text,1,10),'{"pages":[]}') returning id into sa;
 insert into public.builder_products(site_id,title,slug,kind,status) values(sa,'محصول آزمون','p-rb','simple','draft') returning id into pa;
 insert into public.builder_instagram_suggestions(owner_id,account_row,media_id,kind) values(a,public.builder_connect_instagram(a,'17841400000999','x',repeat('x',48),now()+interval '60 days'),'1','image');
end $$;
\ir ../builder-instagram-sync-rollback.sql
do $$ declare a uuid;sa uuid;pa uuid;acc uuid;left_over text;rid uuid;begin
 if to_regclass('public.builder_instagram_suggestions') is not null then raise exception 'suggestions table left behind';end if;
 select string_agg(p.proname,',') into left_over from pg_proc p where p.proname in ('builder_instagram_due_accounts','builder_instagram_sync_state','builder_instagram_record_sync','builder_instagram_imports_due','builder_instagram_record_check');
 if left_over is not null then raise exception 'functions left behind: %',left_over;end if;
 if exists(select 1 from information_schema.columns where table_name in ('builder_instagram_imports','builder_instagram_accounts') and column_name in ('source_state','latest_caption','checked_at','last_checked_at','last_seen_at')) then raise exception 'columns left behind';end if;
 select id into a from public.profiles where role<>'admin' order by id limit 1;
 select id into sa from public.builder_sites where owner_id=a order by created_at desc limit 1;select id into pa from public.builder_products where site_id=sa limit 1;
 acc=(select id from public.builder_instagram_accounts where owner_id=a limit 1);
 execute 'set local role service_role';
 rid=public.builder_instagram_record_import(a,sa,pa,acc,'19000000000001','image','https://www.instagram.com/p/Z/',now(),'c',null);
 reset role;
 if rid is null then raise exception 'step-2 import must keep working after the rollback';end if;
 raise notice 'PASS: sync rollback (objects removed, import function restored)';
end $$;
rollback;

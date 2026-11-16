-- Run only AFTER approval and installation of book-catalog.sql (locally: supabase/tests/local-postgres/run.sh).
-- Needs two ordinary accounts and one admin. All fixtures and catalog rows are rolled back.
begin;
do $$
declare a uuid; b uuid; adm uuid; sa uuid; sb uuid; pa uuid; pb uuid; r jsonb; e1 uuid; e2 uuid; e3 uuid; ea uuid; w1 uuid; w2 uuid; w3 uuid;
 n integer; denied boolean; msg text; list jsonb; hit jsonb; slug text;
begin
 select id into a from public.profiles where role<>'admin' order by id limit 1;
 select id into b from public.profiles where role<>'admin' and id<>a order by id limit 1;
 select id into adm from public.profiles where role='admin' order by id limit 1;
 if a is null or b is null or adm is null then raise exception 'two accounts and one admin needed';end if;
 -- ---- pure helpers
 if public.fa_norm('كتاب علي')<>'کتاب علی' then raise exception 'fa_norm: arabic yeh/kaf';end if;
 if public.fa_norm('۱۲۳٤٥')<>'12345' then raise exception 'fa_norm: digits';end if;
 if public.fa_norm('می‌خواهم  کِتاب')<>'می خواهم کتاب' then raise exception 'fa_norm: zwnj, spaces, diacritics: %',public.fa_norm('می‌خواهم  کِتاب');end if;
 if public.fa_norm(null)<>'' or public.fa_norm('  Ab  C ')<>'ab c' then raise exception 'fa_norm: null/case/space';end if;
 if public.book_isbn13('9780306406157')<>'9780306406157' then raise exception 'isbn13 passthrough';end if;
 if public.book_isbn13('0306406152')<>'9780306406157' or public.book_isbn13('0-306-40615-2')<>'9780306406157' or public.book_isbn13('978-0-306-40615-7')<>'9780306406157' then raise exception 'isbn10 conversion / hyphens';end if;
 if public.book_isbn13('080442957X')<>'9780804429573' or public.book_isbn13('0-8044-2957-x')<>'9780804429573' then raise exception 'isbn10 with X';end if;
 if public.book_isbn13('۹۷۸۶۰۰۱۲۳۴۵۶۹')<>'9786001234569' then raise exception 'persian digits';end if;
 if public.book_isbn13('9786001234567') is not null or public.book_isbn13('0306406153') is not null or public.book_isbn13('123') is not null or public.book_isbn13(null) is not null or public.book_isbn13('abcdefghij') is not null then raise exception 'invalid isbns must be rejected';end if;
 -- ---- fixtures
 insert into public.customer_subscriptions(customer_id,product_id,plan,starts_at,expires_at) values
  (a,'38ba2004-0021-4717-b06f-dc21493b83b5','month',now()-interval '1 day',now()+interval '30 days'),
  (b,'38ba2004-0021-4717-b06f-dc21493b83b5','month',now()-interval '1 day',now()+interval '30 days')
  on conflict(customer_id,product_id) do update set plan='month',starts_at=now()-interval '1 day',expires_at=now()+interval '30 days';
 slug='cat-a-'||substr(gen_random_uuid()::text,1,12);
 insert into public.builder_sites(owner_id,name,slug,draft) values(a,'سایت الف',slug,'{"pages":[]}') returning id into sa;
 slug='cat-b-'||substr(gen_random_uuid()::text,1,12);
 insert into public.builder_sites(owner_id,name,slug,draft) values(b,'سایت ب',slug,'{"pages":[]}') returning id into sb;
 insert into public.builder_products(site_id,title,slug,kind,status) values(sa,'محصول الف','p-a','simple','published') returning id into pa;
 insert into public.builder_products(site_id,title,slug,kind,status) values(sb,'محصول ب','p-b','simple','published') returning id into pb;

 -- ---- contributing editions (as customer A)
 perform set_config('request.jwt.claim.sub',a::text,true);execute 'set local role authenticated';
 r=public.catalog_upsert_edition(sa,'{"isbn":"978-0-306-40615-7","title":"کتاب شب‌های روشن","authors":["صادق هدایت"],"translators":["مترجم نمونه"],"publisher":"نشر نگاه","language":"فارسی","edition_label":"چاپ سوم","publish_year":1403,"year_calendar":"jalali","pages":240,"cover":"شومیز","cover_image_url":"https://covers.example/1.jpg","source":"manual"}');
 if not (r->>'created')::boolean then raise exception 'first contribution must create';end if;
 e1=(r->>'id')::uuid;w1=(r->>'work_id')::uuid;
 reset role;
 if (select verified from public.book_editions where id=e1) or (select created_by from public.book_editions where id=e1)<>a or (select source from public.book_editions where id=e1)<>'manual' then raise exception 'customer contributions are unverified, attributed and sourced';end if;
 -- same work: same normalised title + same first author; variants of publisher/author spelling collapse
 perform set_config('request.jwt.claim.sub',a::text,true);execute 'set local role authenticated';
 r=public.catalog_upsert_edition(sa,'{"isbn":"0-8044-2957-X","title":"كتاب شب‌های  روشن","authors":["صادق  هدایت"],"publisher":"نشر  نگاه","publish_year":1399,"source":"open_library","source_ref":"OL1M","field_sources":{"title":"open_library"}}');
 e2=(r->>'id')::uuid;
 r=public.catalog_upsert_edition(sa,'{"isbn":"9786001234569","title":"کتاب شب‌های روشن","authors":["نویسندهٔ دیگر"]}');
 e3=(r->>'id')::uuid;
 reset role;
 select work_id into w2 from public.book_editions where id=e2; select work_id into w3 from public.book_editions where id=e3;
 if w1<>w2 then raise exception 'same title+author must share a work';end if;
 if w3=w1 then raise exception 'different author must be a different work';end if;
 if (select count(*) from public.book_people where name_norm=public.fa_norm('صادق هدایت'))<>1 or (select count(*) from public.book_publishers where name_norm=public.fa_norm('نشر نگاه'))<>1 then raise exception 'people and publishers are de-duplicated by normalised name';end if;
 if (select isbn13 from public.book_editions where id=e2)<>'9780804429573' then raise exception 'isbn-10 stored as isbn-13';end if;
 -- ---- never overwrites; other customers get the existing row
 perform set_config('request.jwt.claim.sub',b::text,true);execute 'set local role authenticated';
 r=public.catalog_upsert_edition(sb,'{"isbn":"9780306406157","title":"عنوان دیگر که نباید جایگزین شود"}');
 reset role;
 if (r->>'created')::boolean or (r->>'id')::uuid<>e1 or (select title from public.book_editions where id=e1)<>'کتاب شب‌های روشن' then raise exception 'existing editions must not be overwritten';end if;
 -- ---- access and validation
 perform set_config('request.jwt.claim.sub',b::text,true);execute 'set local role authenticated';
 denied=false;begin perform public.catalog_upsert_edition(sa,'{"isbn":"9780306406157","title":"x"}');exception when others then denied=(sqlerrm='store_access_denied');end;
 if not denied then raise exception 'contributing through someone else''s site must be denied';end if;
 denied=false;begin perform public.catalog_upsert_edition(sb,'{"isbn":"9786001234567","title":"x"}');exception when others then denied=(sqlerrm='invalid_isbn');end;
 if not denied then raise exception 'bad checksum must be rejected';end if;
 for msg in select unnest(array[
   '{"isbn":"9780306406157","title":""}',
   '{"isbn":"9780306406157","title":"x","publish_year":"12"}',
   '{"isbn":"9780306406157","title":"x","publish_year":3000}',
   '{"isbn":"9780306406157","title":"x","pages":0}',
   '{"isbn":"9780306406157","title":"x","cover_image_url":"http://insecure/a.jpg"}',
   '{"isbn":"9780306406157","title":"x","authors":"not-an-array"}',
   '{"isbn":"9780306406157","title":"x","authors":["a","b","c","d","e","f","g","h","i","j","k"]}',
   '{"isbn":"9780306406157","title":"x","source":"national_library"}',
   '{"isbn":"9780306406157","title":"x","source":"made_up"}',
   '{"isbn":"9780306406157","title":"x","year_calendar":"lunar"}',
   '[]']) loop
  denied=false;begin perform public.catalog_upsert_edition(sb,msg::jsonb);exception when others then denied=(sqlerrm='invalid_book');end;
  -- an existing ISBN would normally short-circuit, so validation must run before the existence check
  if not denied then raise exception 'invalid payload accepted: %',msg;end if;
 end loop;
 reset role;
 -- ---- direct writes are closed; reads are public except contributor columns
 perform set_config('request.jwt.claim.sub',a::text,true);execute 'set local role authenticated';
 denied=false;begin insert into public.book_editions(work_id,isbn13,title,title_norm) values(w1,'9790000000001','x','x');exception when insufficient_privilege then denied=true;end;
 if not denied then raise exception 'customers must not insert catalog rows directly';end if;
 update public.book_editions set title='hacked' where id=e1;get diagnostics n=row_count;
 if n<>0 then raise exception 'customers must not update catalog rows';end if;
 denied=false;begin perform public.catalog_admin_set_verified(e1,true);exception when others then denied=(sqlerrm='store_access_denied');end;
 if not denied then raise exception 'only admins verify editions';end if;
 reset role;
 execute 'set local role anon';perform set_config('request.jwt.claim.sub','',true);
 select count(*) into n from public.book_editions;if n<3 then raise exception 'anon can read the catalog';end if;
 denied=false;begin perform created_by from public.book_editions limit 1;exception when insufficient_privilege then denied=true;end;
 if not denied then raise exception 'contributor ids must not be readable';end if;
 denied=false;begin perform public.catalog_upsert_edition(sa,'{"isbn":"9780306406157","title":"x"}');exception when insufficient_privilege then denied=true;end;
 if not denied then raise exception 'anon must not contribute';end if;
 if public.catalog_lookup_edition('0306406152') is null then raise exception 'anon can look up editions';end if;
 reset role;
 -- ---- admin moderation
 perform set_config('request.jwt.claim.sub',adm::text,true);execute 'set local role authenticated';
 perform public.catalog_admin_set_verified(e1,true);
 update public.book_editions set pages=250 where id=e1;get diagnostics n=row_count;
 if n<>1 then raise exception 'admins can correct editions';end if;
 r=public.catalog_upsert_edition(sa,'{"isbn":"979-10-90636-07-1","title":"نسخه ادمین","source":"national_library"}');
 ea=(r->>'id')::uuid;
 reset role;
 if not (select verified from public.book_editions where id=e1) or (select verified_by from public.book_editions where id=e1)<>adm or not (select verified from public.book_editions where id=ea) then raise exception 'verification is recorded; admin contributions are verified';end if;

 -- ---- lookup and search (Persian-aware)
 perform set_config('request.jwt.claim.sub',a::text,true);execute 'set local role authenticated';
 hit=public.catalog_lookup_edition('0306406152');
 if hit->>'id'<>e1::text or hit->'authors'->>0<>'صادق هدایت' or hit->'translators'->>0<>'مترجم نمونه' or hit->>'publisher'<>'نشر نگاه' or jsonb_array_length(hit->'other_editions')<>1 then raise exception 'lookup shape: %',hit;end if;
 if public.catalog_lookup_edition('9786001234567') is not null or public.catalog_lookup_edition('9790000000000') is not null then raise exception 'unknown or invalid isbn returns null';end if;
 list=public.catalog_search('كتاب');if jsonb_array_length(list)<3 then raise exception 'arabic kaf finds persian titles: %',list;end if;
 list=public.catalog_search('شب های روشن');if jsonb_array_length(list)<3 then raise exception 'zwnj-insensitive title search';end if;
 list=public.catalog_search('هدایت');if jsonb_array_length(list)<>2 then raise exception 'author search: %',list;end if;
 list=public.catalog_search('نگاه');if jsonb_array_length(list)<2 then raise exception 'publisher search';end if;
 list=public.catalog_search('978-0-306-40615-7');if list->0->>'id'<>e1::text then raise exception 'isbn search ranks the exact edition first';end if;
 if jsonb_array_length(public.catalog_search('كتاب',1))<>1 or public.catalog_search('   ')<>'[]'::jsonb or public.catalog_search('100%_ \')<>'[]'::jsonb then raise exception 'limit, empty and wildcard-safe search';end if;
 reset role;

 -- ---- links to customer products
 perform set_config('request.jwt.claim.sub',a::text,true);execute 'set local role authenticated';
 insert into public.builder_product_books(product_id,site_id,edition_id) values(pa,sa,e1);
 denied=false;begin insert into public.builder_product_books(product_id,site_id,edition_id) values(pb,sb,e1);exception when insufficient_privilege then denied=true;end;
 if not denied then raise exception 'linking another customer''s product must be denied';end if;
 denied=false;begin insert into public.builder_product_books(product_id,site_id,edition_id) values(pb,sa,e1);exception when foreign_key_violation then denied=true;end;
 if not denied then raise exception 'product/site pair must match';end if;
 denied=false;begin insert into public.builder_product_books(product_id,site_id,edition_id) values(pa,sa,e2);exception when unique_violation then denied=true;end;
 if not denied then raise exception 'one edition per product';end if;
 select count(*) into n from public.builder_product_books;if n<>1 then raise exception 'owner sees own links only';end if;
 reset role;
 perform set_config('request.jwt.claim.sub',b::text,true);execute 'set local role authenticated';
 select count(*) into n from public.builder_product_books;if n<>0 then raise exception 'other customers must not see the link';end if;
 reset role;
 execute 'set local role anon';perform set_config('request.jwt.claim.sub','',true);
 select count(*) into n from public.builder_product_books;if n<>0 then raise exception 'unpublished sites expose no links';end if;
 reset role;
 insert into public.builder_publications(site_id,slug,name,document,is_live) values(sa,'pub-'||substr(sa::text,1,12),'سایت الف','{"pages":[]}',true);
 execute 'set local role anon';
 select count(*) into n from public.builder_product_books;if n<>1 then raise exception 'live sites expose their links publicly';end if;
 reset role;
 delete from public.builder_products where id=pa;
 select count(*) into n from public.builder_product_books where product_id=pa;if n<>0 then raise exception 'deleting a product removes its link';end if;

 -- ---- rate limits
 perform set_config('request.jwt.claim.sub',a::text,true);execute 'set local role authenticated';
 for n in 1..60 loop perform public.catalog_register_lookup('9780306406157');end loop;
 denied=false;begin perform public.catalog_register_lookup('9780306406157');exception when others then denied=(sqlerrm='lookup_rate_limited');end;
 if not denied then raise exception '61st lookup in an hour must be limited';end if;
 denied=false;begin perform public.catalog_register_lookup('123');exception when others then denied=(sqlerrm in('invalid_isbn','lookup_rate_limited'));end;
 if not denied then raise exception 'lookup validates isbn';end if;
 reset role;
 perform set_config('request.jwt.claim.sub',b::text,true);execute 'set local role authenticated';
 perform public.catalog_register_lookup('9780306406157');
 reset role;
 execute 'set local role anon';
 denied=false;begin perform public.catalog_register_lookup('9780306406157');exception when insufficient_privilege then denied=true;end;
 if not denied then raise exception 'anon cannot register lookups';end if;
 denied=false;begin perform count(*) from public.book_isbn_lookup_log;exception when insufficient_privilege then denied=true;end;
 if not denied then raise exception 'lookup log is private';end if;
 reset role;
 for n in 1..300 loop
  insert into public.book_editions(work_id,isbn13,title,title_norm,created_by) values(w1,'979'||lpad(n::text,10,'0'),'bulk '||n,'bulk '||n,b);
 end loop;
 perform set_config('request.jwt.claim.sub',b::text,true);execute 'set local role authenticated';
 denied=false;begin perform public.catalog_upsert_edition(sb,'{"isbn":"9780140449136","title":"after the cap"}');exception when others then denied=(sqlerrm='catalog_rate_limited');end;
 if not denied then raise exception '301st contribution in a day must be limited';end if;
 reset role;
 raise notice 'PASS: book catalog (helpers, contribution rules, RLS, search, links, rate limits)';
end $$;
rollback;

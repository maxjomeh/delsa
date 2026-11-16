-- Verifies that book-catalog-rollback.sql removes everything book-catalog.sql created and leaves the
-- builder tables intact. Runs inside a transaction that is rolled back.
begin;
insert into public.book_works(title,title_norm) values('t','t');
\ir ../book-catalog-rollback.sql
do $$
declare leftovers text;
begin
 select string_agg(c.relname,',') into leftovers from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and (c.relname like 'book\_%' or c.relname='builder_product_books');
 if leftovers is not null then raise exception 'tables left behind: %',leftovers;end if;
 select string_agg(p.proname,',') into leftovers from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and (p.proname like 'catalog\_%' or p.proname in('book_isbn13','fa_norm'));
 if leftovers is not null then raise exception 'functions left behind: %',leftovers;end if;
 if to_regclass('public.builder_products') is null or to_regclass('public.builder_sites') is null then raise exception 'builder tables must survive';end if;
 raise notice 'PASS: rollback removes the catalog and nothing else';
end $$;
rollback;

-- Rollback for supabase/book-catalog.sql. Removes every object it created (and all catalog data and
-- product links). Customer products, sites and orders are not touched. The pg_trgm extension stays installed.
drop function if exists public.catalog_admin_set_verified(uuid,boolean);
drop function if exists public.catalog_register_lookup(text);
drop function if exists public.catalog_search(text,integer);
drop function if exists public.catalog_lookup_edition(text);
drop function if exists public.catalog_upsert_edition(uuid,jsonb);
drop table if exists public.builder_product_books;
drop table if exists public.book_isbn_lookup_log;
drop table if exists public.book_edition_people;
drop table if exists public.book_editions;
drop table if exists public.book_work_people;
drop table if exists public.book_works;
drop table if exists public.book_people;
drop table if exists public.book_publishers;
drop function if exists public.book_isbn13(text);
drop function if exists public.fa_norm(text);

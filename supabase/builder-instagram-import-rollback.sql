-- Removes step-2 objects. Imported products and uploaded files are NOT deleted.
begin;
drop function if exists public.builder_instagram_record_import(uuid,uuid,uuid,uuid,text,text,text,timestamptz,text,jsonb),public.builder_site_media_bytes(uuid);
drop function if exists private.builder_instagram_record_import(uuid,uuid,uuid,uuid,text,text,text,timestamptz,text,jsonb),private.builder_site_media_bytes(uuid);
drop table if exists public.builder_product_videos;
drop table if exists public.builder_instagram_imports;
commit;

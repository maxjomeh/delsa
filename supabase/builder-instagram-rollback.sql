-- Removes the site-builder Instagram connection objects (tokens included). Does not touch the CRM connector.
begin;
drop function if exists public.builder_connect_instagram(uuid,text,text,text,timestamptz),public.builder_disconnect_instagram(uuid,uuid),public.builder_instagram_token(uuid,uuid),public.builder_instagram_store_token(uuid,uuid,text,timestamptz),public.builder_instagram_mark_expired(uuid,uuid);
drop function if exists private.builder_connect_instagram(uuid,text,text,text,timestamptz),private.builder_disconnect_instagram(uuid,uuid),private.builder_instagram_token(uuid,uuid),private.builder_instagram_store_token(uuid,uuid,text,timestamptz),private.builder_instagram_mark_expired(uuid,uuid);
drop table if exists private.builder_instagram_tokens;
drop table if exists public.builder_instagram_accounts;
commit;

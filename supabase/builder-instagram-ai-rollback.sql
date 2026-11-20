begin;
drop function if exists public.builder_ai_claim(uuid,integer,integer),public.builder_ai_release(uuid,integer),public.builder_ai_remaining(uuid,integer);
drop function if exists private.builder_ai_claim(uuid,integer,integer),private.builder_ai_release(uuid,integer),private.builder_ai_remaining(uuid,integer);
drop table if exists public.builder_ai_usage;
commit;

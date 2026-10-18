-- Run only after deploying supabase/delsa-channel-hub.sql.
-- Metadata-only assertions. No customer rows are read or modified.
begin;
do $$
declare definition text;
begin
 if not exists(
   select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname='delsa_channel_grants' and c.relrowsecurity
 ) then raise exception 'Channel Hub RLS must be on';end if;
 if has_table_privilege('anon','public.delsa_channel_grants','SELECT')
    or has_table_privilege('anon','public.delsa_channel_grants','INSERT')
    or has_table_privilege('authenticated','public.delsa_channel_grants','INSERT')
    or has_table_privilege('authenticated','public.delsa_channel_grants','UPDATE')
    or has_table_privilege('authenticated','public.delsa_channel_grants','DELETE')
 then raise exception 'Channel grant writes must be server only'; end if;
 if not has_table_privilege('authenticated','public.delsa_channel_grants','SELECT')
 then raise exception 'Owner read access missing';end if;
 select pg_get_functiondef('private.crm_receive_instagram(text,text,text,text,timestamptz)'::regprocedure) into definition;
 if definition not like '%delsa_channel_grants%'
    or definition not like '%for share%'
 then raise exception 'Webhook transactional grant enforcement missing';end if;
 if exists(select 1 from pg_policies
            where schemaname='public' and tablename='delsa_channel_grants'
              and (roles @> array['anon'::name]))
 then raise exception 'Anonymous policy unexpectedly present';end if;
end $$;
rollback;

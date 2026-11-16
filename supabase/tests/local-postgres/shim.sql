-- Minimal Supabase shim for running the repository's SQL files on a plain local Postgres.
-- It recreates only what the SQL files rely on: the API roles with Supabase's default
-- privileges, auth.users / auth.uid() and the `extensions` schema. Never run this on a Supabase project.
do $$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin noinherit; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin noinherit bypassrls; end if;
end $$;
create schema if not exists auth;
create schema if not exists extensions;
create table if not exists auth.users(
 id uuid primary key default gen_random_uuid(),
 email text unique, phone text unique,
 raw_user_meta_data jsonb not null default '{}',
 created_at timestamptz not null default now()
);
create or replace function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
 select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'anon')
$$;
grant usage on schema public, auth, extensions to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
-- Supabase grants everything on new public objects to the API roles; the SQL files then revoke what must stay private.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
-- Storage tables/functions that some SQL files attach policies to (no real file storage here).
create schema if not exists storage;
create table if not exists storage.buckets(id text primary key, name text not null, public boolean not null default false, file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid, metadata jsonb, created_at timestamptz not null default now());
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.objects, storage.buckets to anon, authenticated, service_role;

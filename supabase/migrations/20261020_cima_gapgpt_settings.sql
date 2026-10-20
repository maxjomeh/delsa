-- Global GapGPT credential for operator-owned CIMA, never visible to tenants.
-- Key encrypted in Next.js with existing AES-256-GCM server-only key.
begin;
create table if not exists public.sima_ai_provider_settings (
 provider text primary key check(provider='gapgpt'),
 credential_ciphertext text not null check(length(credential_ciphertext) between 30 and 12000),
 model text not null default 'gpt-4o-mini' check(model='gpt-4o-mini'),
 enabled boolean not null default false,
 last_test_status text not null default 'untested' check(last_test_status in ('untested','passed','failed')),
 last_tested_at timestamptz,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id),
 revision bigint not null default 1 check(revision>=1)
);
alter table public.sima_ai_provider_settings enable row level security;
revoke all on table public.sima_ai_provider_settings from public,anon,authenticated;
grant select,insert,update on table public.sima_ai_provider_settings to service_role;
create table if not exists public.sima_ai_provider_audit (
 id bigint generated always as identity primary key,
 provider text not null check(provider='gapgpt'),
 action text not null check(action in ('create','rotate','enable','disable','model','test_pass','test_fail')),
 actor_id uuid references auth.users(id),
 occurred_at timestamptz not null default now(),
 revision bigint not null
);
alter table public.sima_ai_provider_audit enable row level security;
revoke all on table public.sima_ai_provider_audit from public,anon,authenticated;
grant select,insert on table public.sima_ai_provider_audit to service_role;
-- Do not store tokens, prompts, or full API responses in audit.
commit;
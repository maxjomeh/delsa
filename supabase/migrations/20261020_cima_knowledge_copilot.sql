-- CIMA: verified, versioned business knowledge and draft-only decision records.
begin;
create table if not exists public.sima_knowledge_entries(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.profiles(id),
 title text not null check(length(btrim(title)) between 3 and 180),
 question text not null check(length(btrim(question)) between 4 and 2000),
 answer text not null check(length(btrim(answer)) between 2 and 6000),
 category text not null default 'faq' check(category in ('faq','policy','product','procedure')),
 status text not null default 'draft' check(status in ('draft','approved','revoked')),
 revision integer not null default 1 check(revision>=1),
 expires_at timestamptz,
 approved_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,id)
);
create index if not exists sima_knowledge_scope_idx on public.sima_knowledge_entries(tenant_id,status,updated_at desc);
alter table public.sima_knowledge_entries enable row level security;
revoke all on public.sima_knowledge_entries from public,anon,authenticated;
grant select,insert,update on public.sima_knowledge_entries to service_role;
create table if not exists public.sima_knowledge_revisions(
 id bigint generated always as identity primary key,
 tenant_id uuid not null,
 entry_id uuid not null,
 revision integer not null,
 title text not null,
 question text not null,
 answer text not null,
 category text not null,
 status text not null,
 approved_at timestamptz,
 expires_at timestamptz,
 captured_at timestamptz not null default now(),
 unique(tenant_id,entry_id,revision),
 foreign key(tenant_id,entry_id) references public.sima_knowledge_entries(tenant_id,id)
);
alter table public.sima_knowledge_revisions enable row level security;
revoke all on public.sima_knowledge_revisions from public,anon,authenticated;
grant select,insert on public.sima_knowledge_revisions to service_role;

create or replace function public.sima_capture_knowledge_revision()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.sima_knowledge_revisions(tenant_id,entry_id,revision,title,question,answer,category,status,approved_at,expires_at)
 values(new.tenant_id,new.id,new.revision,new.title,new.question,new.answer,new.category,new.status,new.approved_at,new.expires_at);
 return new;
end $$;
revoke all on function public.sima_capture_knowledge_revision() from public,anon,authenticated;
drop trigger if exists sima_knowledge_revision_capture on public.sima_knowledge_entries;
create trigger sima_knowledge_revision_capture after insert or update on public.sima_knowledge_entries
for each row execute function public.sima_capture_knowledge_revision();

create table if not exists public.sima_response_candidates(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.profiles(id),
 review_id uuid not null,
 customer_id uuid not null,
 conversation_version bigint not null check(conversation_version>=1),
 source_message_id uuid not null,
 kind text not null check(kind in ('approved_faq','llm_grounded','no_knowledge','blocked')),
 suggestion text,
 cited_entries jsonb not null default '[]' check(jsonb_typeof(cited_entries)='array'),
 risk_level text not null check(risk_level in('low','medium','high')),
 reason_codes text[] not null default '{}'::text[],
 confidence numeric(4,3),
 confidence_status text not null default 'uncalibrated' check(confidence_status in('uncalibrated','not_applicable')),
 model_name text,
 created_at timestamptz not null default now(),
 unique(tenant_id,id),
 unique(tenant_id,review_id,conversation_version),
 foreign key(tenant_id,review_id) references public.sima_human_review_cases(tenant_id,id),
 foreign key(tenant_id,customer_id) references public.crm_customers(tenant_id,id),
 foreign key(tenant_id,source_message_id) references public.crm_interactions(tenant_id,id),
 check(confidence is null),
 check(suggestion is null or length(suggestion)<=6000)
);
create index if not exists sima_candidates_tenant_review on public.sima_response_candidates(tenant_id,review_id,created_at desc);
alter table public.sima_response_candidates enable row level security;
revoke all on public.sima_response_candidates from public,anon,authenticated;
grant select,insert,update on public.sima_response_candidates to service_role;
commit;
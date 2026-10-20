begin;
create table if not exists public.sima_copilot_feedback(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.profiles(id),
 candidate_id uuid not null,
 review_id uuid not null,
 reviewer_id uuid not null references auth.users(id),
 verdict text not null check(verdict in ('useful','incorrect','missing_knowledge')),
 corrected_answer text check(corrected_answer is null or length(corrected_answer)<=4000),
 created_at timestamptz not null default now(),
 unique(tenant_id,id),
 unique(tenant_id,candidate_id,reviewer_id),
 foreign key(tenant_id,candidate_id) references public.sima_response_candidates(tenant_id,id),
 foreign key(tenant_id,review_id) references public.sima_human_review_cases(tenant_id,id)
);
create index if not exists sima_feedback_tenant_created on public.sima_copilot_feedback(tenant_id,created_at desc);
alter table public.sima_copilot_feedback enable row level security;
revoke all on public.sima_copilot_feedback from public,anon,authenticated;
grant select,insert on public.sima_copilot_feedback to service_role;
commit;
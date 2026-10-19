begin;
create table if not exists public.crm_learning_suggestions(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.profiles(id),
 customer_id uuid,
 kind text not null check(kind in ('phone','truck_model','new_field')),
 field_key text not null check(length(field_key) between 1 and 80),
 proposed_value text not null check(length(proposed_value) between 1 and 500),
 evidence_quote text not null check(length(evidence_quote) between 1 and 1000),
 evidence_interaction_id uuid,
 confidence numeric(4,3) not null check(confidence>=0 and confidence<=1),
 support_count integer not null default 1,
 status text not null default 'pending' check(status in('pending','accepted','rejected')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(tenant_id,customer_id) references public.crm_customers(tenant_id,id) on delete cascade,
 foreign key(tenant_id,evidence_interaction_id) references public.crm_interactions(tenant_id,id) on delete set null,
 unique(tenant_id,customer_id,kind,field_key,proposed_value)
);
create index if not exists crm_learning_suggestions_pending_idx on public.crm_learning_suggestions(tenant_id,status,created_at desc);
alter table public.crm_learning_suggestions enable row level security;
revoke all on public.crm_learning_suggestions from public,anon,authenticated;
grant select,insert,update on public.crm_learning_suggestions to service_role;
commit;
-- Development portfolio evidence and audited progress (admin only).
-- No client-facing RLS policies; all reads/writes go through role-checked server routes.
create table if not exists public.development_custom_features (
  id uuid primary key default gen_random_uuid(),
  product_code text not null check (product_code ~ '^[a-z0-9_]{2,60}$'),
  phase_key text not null check (length(phase_key) between 1 and 80),
  phase_title text not null check (length(phase_title) between 1 and 160),
  phase_weight numeric(6,2) not null default 100 check (phase_weight > 0 and phase_weight <= 100),
  feature_key text not null check (feature_key ~ '^[a-z0-9_]{2,80}$'),
  label text not null check (length(label) between 1 and 240),
  weight numeric(6,2) not null default 100 check (weight > 0 and weight <= 100),
  implementation smallint not null default 0 check (implementation between 0 and 100),
  readiness smallint not null default 0 check (readiness between 0 and 100),
  source_paths text[] not null default '{}'::text[],
  test_paths text[] not null default '{}'::text[],
  notes text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_code,feature_key)
);
create index if not exists development_custom_features_product_idx on public.development_custom_features(product_code,phase_key);
alter table public.development_custom_features enable row level security;
revoke all on public.development_custom_features from anon,authenticated;
grant select,insert,update,delete on public.development_custom_features to service_role;

create table if not exists public.development_feature_reviews (
  feature_id text primary key check (feature_id ~ '^p[0-6]f[0-9]{1,3}$'),
  implementation smallint not null check (implementation between 0 and 100),
  readiness smallint not null check (readiness between 0 and 100),
  notes text not null default '',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz not null default now()
);
alter table public.development_feature_reviews enable row level security;
revoke all on public.development_feature_reviews from anon,authenticated;
grant select,insert,update on public.development_feature_reviews to service_role;

create table if not exists public.development_release_snapshots (
  product_code text not null check (product_code ~ '^[a-z0-9_]{2,60}$'),
  commit_sha text not null check (commit_sha ~ '^[0-9a-f]{40}$'),
  environment text not null default 'production' check (environment in ('production','preview')),
  ci_state text not null default 'unknown' check (ci_state in ('passed','failed','pending','unknown')),
  comparison_complete boolean not null default false,
  changed_paths jsonb not null default '[]'::jsonb,
  tree_paths jsonb not null default '[]'::jsonb,
  evidence_status text not null default 'unknown',
  checked_at timestamptz not null default now(),
  primary key(product_code,commit_sha,environment)
);
create index if not exists development_release_snapshots_recent_idx on public.development_release_snapshots(product_code,checked_at desc);
alter table public.development_release_snapshots enable row level security;
revoke all on public.development_release_snapshots from anon,authenticated;
grant select,insert,update on public.development_release_snapshots to service_role;
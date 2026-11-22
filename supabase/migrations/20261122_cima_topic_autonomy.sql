-- CIMA: per-topic graduated autonomy (learning -> shadow -> suggest -> auto).
-- Additive only. Nothing here sends a message. Defence in depth: the database itself refuses to put a
-- never-auto topic, or any topic of a tenant whose automatic replies are off or paused, into `auto`.
begin;

create table if not exists public.sima_autonomy_settings(
 tenant_id uuid primary key references public.profiles(id),
 auto_enabled boolean not null default false,
 default_floor numeric(4,3) not null default .900 check(default_floor between .500 and .999),
 paused_at timestamptz,
 updated_at timestamptz not null default now()
);

create table if not exists public.sima_topics(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.profiles(id),
 topic_key text not null check(length(btrim(topic_key)) between 2 and 80),
 label text not null check(length(btrim(label)) between 2 and 120),
 risk_class text not null default 'low' check(risk_class in('low','medium','high')),
 status text not null default 'proposed' check(status in('proposed','active','retired')),
 stage text not null default 'learning' check(stage in('learning','shadow','suggest','auto')),
 never_auto boolean not null default false,
 confidence_floor numeric(4,3) not null default .900 check(confidence_floor between .500 and .999),
 confidence_threshold numeric(4,3) not null default .900 check(confidence_threshold <= .999),
 origin text not null default 'manual' check(origin in('manual','discovered')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,id),
 unique(tenant_id,topic_key),
 check(confidence_threshold >= confidence_floor),
 check(risk_class <> 'high' or never_auto),
 check(stage <> 'auto' or (status = 'active' and not never_auto))
);
create index if not exists sima_topics_scope_idx on public.sima_topics(tenant_id,status,stage);

create table if not exists public.sima_topic_fields(
 tenant_id uuid not null,
 topic_id uuid not null,
 field_key text not null check(length(btrim(field_key)) between 1 and 120),
 required boolean not null default true,
 primary key(topic_id,field_key),
 foreign key(tenant_id,topic_id) references public.sima_topics(tenant_id,id) on delete cascade
);

-- Append-only evidence the confidence engine learns from.
create table if not exists public.sima_topic_outcomes(
 id bigint generated always as identity primary key,
 tenant_id uuid not null,
 topic_id uuid not null,
 source text not null check(source in('backtest','shadow','human_feedback','auto')),
 outcome text not null check(outcome in('accepted','edited','rejected','wrong')),
 similarity numeric(4,3) check(similarity between 0 and 1),
 response_candidate_id uuid,
 interaction_id uuid,
 created_at timestamptz not null default now(),
 foreign key(tenant_id,topic_id) references public.sima_topics(tenant_id,id) on delete cascade
);
create index if not exists sima_topic_outcomes_scope_idx on public.sima_topic_outcomes(tenant_id,topic_id,created_at desc);

-- Append-only audit of every stage change and why.
create table if not exists public.sima_topic_transitions(
 id bigint generated always as identity primary key,
 tenant_id uuid not null,
 topic_id uuid not null,
 from_stage text not null,
 to_stage text not null,
 reason text not null,
 confidence_lower_bound numeric(4,3),
 threshold numeric(4,3),
 created_at timestamptz not null default now(),
 foreign key(tenant_id,topic_id) references public.sima_topics(tenant_id,id) on delete cascade
);
create index if not exists sima_topic_transitions_scope_idx on public.sima_topic_transitions(tenant_id,topic_id,created_at desc);

create or replace function public.sima_topics_guard() returns trigger language plpgsql set search_path=public as $$
begin
 if new.risk_class = 'high' then new.never_auto := true; end if;
 if new.stage = 'auto' then
  if new.never_auto then
   raise exception 'never_auto_topic_cannot_be_automatic' using errcode = 'check_violation';
  end if;
  if not exists(select 1 from public.sima_autonomy_settings s
                where s.tenant_id = new.tenant_id and s.auto_enabled and s.paused_at is null) then
   raise exception 'tenant_automatic_replies_disabled' using errcode = 'check_violation';
  end if;
 end if;
 new.updated_at := now();
 return new;
end $$;
revoke all on function public.sima_topics_guard() from public,anon,authenticated;
drop trigger if exists sima_topics_guard_trg on public.sima_topics;
create trigger sima_topics_guard_trg before insert or update on public.sima_topics
 for each row execute function public.sima_topics_guard();

-- Kill switch: turning automatic replies off, or pausing, immediately demotes every automatic topic.
create or replace function public.sima_autonomy_kill_switch() returns trigger language plpgsql set search_path=public as $$
begin
 new.updated_at := now();
 if (not new.auto_enabled) or new.paused_at is not null then
  insert into public.sima_topic_transitions(tenant_id,topic_id,from_stage,to_stage,reason)
   select t.tenant_id,t.id,'auto','suggest',case when new.paused_at is not null then 'TENANT_PAUSED' else 'AUTO_REPLY_DISABLED' end
   from public.sima_topics t where t.tenant_id = new.tenant_id and t.stage = 'auto';
  update public.sima_topics set stage = 'suggest' where tenant_id = new.tenant_id and stage = 'auto';
 end if;
 return new;
end $$;
revoke all on function public.sima_autonomy_kill_switch() from public,anon,authenticated;
drop trigger if exists sima_autonomy_kill_switch_trg on public.sima_autonomy_settings;
create trigger sima_autonomy_kill_switch_trg before insert or update on public.sima_autonomy_settings
 for each row execute function public.sima_autonomy_kill_switch();

alter table public.sima_autonomy_settings enable row level security;
alter table public.sima_topics enable row level security;
alter table public.sima_topic_fields enable row level security;
alter table public.sima_topic_outcomes enable row level security;
alter table public.sima_topic_transitions enable row level security;
revoke all on public.sima_autonomy_settings,public.sima_topics,public.sima_topic_fields,public.sima_topic_outcomes,public.sima_topic_transitions from public,anon,authenticated;
grant select,insert,update on public.sima_autonomy_settings,public.sima_topics to service_role;
grant select,insert,update,delete on public.sima_topic_fields to service_role;
grant select,insert on public.sima_topic_outcomes,public.sima_topic_transitions to service_role;
grant usage on sequence public.sima_topic_outcomes_id_seq,public.sima_topic_transitions_id_seq to service_role;

commit;

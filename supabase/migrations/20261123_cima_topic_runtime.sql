-- CIMA topic runtime (phase 3). Additive; run after 20261122_cima_topic_autonomy.sql.
-- 1) a discovered topic keeps its term profile so replay and shadow mode assign questions the same way later;
-- 2) activation time is recorded by the database (outcomes before it are 'backtest', after it 'shadow');
-- 3) an outcome is recorded at most once per (topic, source, interaction), so re-running a replay is idempotent.
begin;

alter table public.sima_topics add column if not exists profile jsonb;
alter table public.sima_topics add column if not exists keywords jsonb;
alter table public.sima_topics add column if not exists examples jsonb;
alter table public.sima_topics add column if not exists activated_at timestamptz;

do $$ begin
 if not exists(select 1 from pg_constraint where conname='sima_topics_profile_size') then
  alter table public.sima_topics add constraint sima_topics_profile_size
   check(profile is null or (jsonb_typeof(profile)='array' and octet_length(profile::text) <= 40000));
 end if;
 if not exists(select 1 from pg_constraint where conname='sima_topics_examples_size') then
  alter table public.sima_topics add constraint sima_topics_examples_size
   check((keywords is null or octet_length(keywords::text) <= 4000) and (examples is null or octet_length(examples::text) <= 12000));
 end if;
 if not exists(select 1 from pg_constraint where conname='sima_topic_outcomes_once') then
  alter table public.sima_topic_outcomes add constraint sima_topic_outcomes_once unique(tenant_id,topic_id,source,interaction_id);
 end if;
end $$;

create or replace function public.sima_topics_activation() returns trigger language plpgsql set search_path=public as $$
begin
 if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') then
  new.activated_at := now();
 end if;
 return new;
end $$;
revoke all on function public.sima_topics_activation() from public,anon,authenticated;
drop trigger if exists sima_topics_activation_trg on public.sima_topics;
create trigger sima_topics_activation_trg before insert or update on public.sima_topics
 for each row execute function public.sima_topics_activation();

commit;

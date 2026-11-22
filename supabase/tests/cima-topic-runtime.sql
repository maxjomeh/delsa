-- Transactional tests for 20261123_cima_topic_runtime.sql (run after the phase-1 migration). Everything rolls back.
begin;
create function pg_temp.fails(statement text) returns boolean language plpgsql as $$
begin execute statement; return false; exception when others then return true; end $$;
create function pg_temp.expect(ok boolean, label text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'FAILED: %', label; end if; end $$;

insert into public.profiles(id) values ('00000000-0000-0000-0000-0000000000b1');

-- activation time is stamped by the database, only on the transition to active
insert into public.sima_topics(id,tenant_id,topic_key,label,profile,keywords,examples)
 values ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b1','t_hours','ساعت کاری','[["ساع",0.5],["اعت",0.5]]','["ساعت","کاری"]','["ساعت کاری شما چیه؟"]');
select pg_temp.expect((select activated_at is null from public.sima_topics where topic_key='t_hours'),'proposed topic has no activation time');
update public.sima_topics set status='active' where topic_key='t_hours';
select pg_temp.expect((select activated_at is not null from public.sima_topics where topic_key='t_hours'),'activation time stamped');
create temp table first_stamp as select activated_at from public.sima_topics where topic_key='t_hours';
update public.sima_topics set label='ساعت کاری فروشگاه' where topic_key='t_hours';
select pg_temp.expect((select activated_at from public.sima_topics where topic_key='t_hours')=(select activated_at from first_stamp),'later edits do not move the activation time');

-- profile must be a bounded array
select pg_temp.expect(pg_temp.fails($$update public.sima_topics set profile='{"a":1}' where topic_key='t_hours'$$),'profile must be an array');
select pg_temp.expect(pg_temp.fails($$update public.sima_topics set profile=(select jsonb_agg(to_jsonb(repeat('x',100))) from generate_series(1,1000)) where topic_key='t_hours'$$),'oversized profile refused');

-- an outcome is recorded once per topic/source/interaction: a replay is idempotent
insert into public.sima_topic_outcomes(tenant_id,topic_id,source,outcome,interaction_id)
 values ('00000000-0000-0000-0000-0000000000b1','20000000-0000-0000-0000-000000000001','backtest','accepted','30000000-0000-0000-0000-000000000001');
select pg_temp.expect(pg_temp.fails($$insert into public.sima_topic_outcomes(tenant_id,topic_id,source,outcome,interaction_id) values ('00000000-0000-0000-0000-0000000000b1','20000000-0000-0000-0000-000000000001','backtest','rejected','30000000-0000-0000-0000-000000000001')$$),'duplicate outcome refused');
insert into public.sima_topic_outcomes(tenant_id,topic_id,source,outcome,interaction_id)
 values ('00000000-0000-0000-0000-0000000000b1','20000000-0000-0000-0000-000000000001','shadow','accepted','30000000-0000-0000-0000-000000000001');   -- same interaction, different source: allowed
insert into public.sima_topic_outcomes(tenant_id,topic_id,source,outcome,interaction_id)
 values ('00000000-0000-0000-0000-0000000000b1','20000000-0000-0000-0000-000000000001','human_feedback','accepted',null),
        ('00000000-0000-0000-0000-0000000000b1','20000000-0000-0000-0000-000000000001','human_feedback','accepted',null);       -- feedback without an interaction is not deduplicated
select pg_temp.expect((select count(*) from public.sima_topic_outcomes)=4,'expected four outcome rows');

select 'PASS: cima topic runtime schema' as result;
rollback;

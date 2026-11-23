-- Transactional database tests for 20261122_cima_topic_autonomy.sql. Everything rolls back.
begin;
create function pg_temp.fails(statement text) returns boolean language plpgsql as $$
begin execute statement; return false; exception when others then return true; end $$;
create function pg_temp.expect(ok boolean, label text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'FAILED: %', label; end if; end $$;

insert into public.profiles(id) values ('00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-0000000000a2');

-- a high-risk topic is forced to never_auto by the guard
insert into public.sima_topics(id,tenant_id,topic_key,label,risk_class,status)
 values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','price','قیمت','high','active');
select pg_temp.expect((select never_auto from public.sima_topics where topic_key='price'),'high risk forces never_auto');

-- a low-risk topic cannot be automatic while the tenant has automatic replies off (default)
insert into public.sima_topics(id,tenant_id,topic_key,label,status,stage)
 values ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a1','hours','ساعت کاری','active','suggest');
select pg_temp.expect(pg_temp.fails($$update public.sima_topics set stage='auto' where topic_key='hours'$$),'auto refused while tenant auto_enabled is false');

-- never-auto topics can never be automatic, even when the tenant enabled automatic replies
insert into public.sima_autonomy_settings(tenant_id,auto_enabled) values ('00000000-0000-0000-0000-0000000000a1',true);
select pg_temp.expect(pg_temp.fails($$update public.sima_topics set stage='auto' where topic_key='price'$$),'never_auto topic refused');
select pg_temp.expect(pg_temp.fails($$insert into public.sima_topics(tenant_id,topic_key,label,never_auto,status,stage) values ('00000000-0000-0000-0000-0000000000a1','x1','نمونه',true,'active','auto')$$),'never_auto insert as auto refused');

-- with the tenant enabled, the low-risk active topic may be automatic; a proposed (unreviewed) one may not
update public.sima_topics set stage='auto' where topic_key='hours';
select pg_temp.expect((select stage from public.sima_topics where topic_key='hours')='auto','auto allowed for enabled tenant');
insert into public.sima_topics(tenant_id,topic_key,label) values ('00000000-0000-0000-0000-0000000000a1','proposed_topic','پیشنهادی');
select pg_temp.expect(pg_temp.fails($$update public.sima_topics set stage='auto' where topic_key='proposed_topic'$$),'proposed topic cannot be automatic');

-- another tenant's setting never enables this tenant
insert into public.sima_topics(tenant_id,topic_key,label,status,stage) values ('00000000-0000-0000-0000-0000000000a2','hours','ساعت کاری','active','suggest');
select pg_temp.expect(pg_temp.fails($$update public.sima_topics set stage='auto' where tenant_id='00000000-0000-0000-0000-0000000000a2'$$),'tenant isolation of the auto switch');

-- threshold can never sit below the owner floor
select pg_temp.expect(pg_temp.fails($$update public.sima_topics set confidence_floor=.95, confidence_threshold=.90 where topic_key='hours' and tenant_id='00000000-0000-0000-0000-0000000000a1'$$),'threshold below floor refused');

-- kill switch: pausing demotes every automatic topic and leaves an audit row
update public.sima_autonomy_settings set paused_at=now() where tenant_id='00000000-0000-0000-0000-0000000000a1';
select pg_temp.expect((select stage from public.sima_topics where topic_key='hours' and tenant_id='00000000-0000-0000-0000-0000000000a1')='suggest','pause demotes automatic topics');
select pg_temp.expect((select count(*) from public.sima_topic_transitions where reason='TENANT_PAUSED')=1,'pause is audited');
select pg_temp.expect(pg_temp.fails($$update public.sima_topics set stage='auto' where topic_key='hours' and tenant_id='00000000-0000-0000-0000-0000000000a1'$$),'auto refused while paused');

-- evidence is append-only and tenant-scoped
insert into public.sima_topic_outcomes(tenant_id,topic_id,source,outcome) values ('00000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-000000000002','shadow','accepted');
select pg_temp.expect(pg_temp.fails($$insert into public.sima_topic_outcomes(tenant_id,topic_id,source,outcome) values ('00000000-0000-0000-0000-0000000000a2','10000000-0000-0000-0000-000000000002','shadow','accepted')$$),'outcome cannot cross tenants');

set local role service_role;
select pg_temp.expect(pg_temp.fails($$update public.sima_topic_outcomes set outcome='rejected'$$),'service_role cannot rewrite outcomes');
select pg_temp.expect(pg_temp.fails($$delete from public.sima_topic_outcomes$$),'service_role cannot delete outcomes');
select pg_temp.expect(pg_temp.fails($$delete from public.sima_topic_transitions$$),'service_role cannot delete audit rows');
reset role;

-- browser roles have no direct access at all
set local role authenticated;
select pg_temp.expect(pg_temp.fails($$select 1 from public.sima_topics$$),'authenticated has no direct table access');
reset role;
set local role anon;
select pg_temp.expect(pg_temp.fails($$select 1 from public.sima_autonomy_settings$$),'anon has no direct table access');
reset role;

select 'PASS: cima topic autonomy schema' as result;
rollback;

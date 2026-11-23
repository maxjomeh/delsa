-- Transactional tests for 20261124_cima_auto_send.sql, run on the REAL migration chain (outbox, human review, Zernio, knowledge,
-- phases 1-3). Everything rolls back. Each negative case changes ONE thing and must be refused by the database itself.
begin;
set local request.jwt.claim.role = 'service_role';
create function pg_temp.refused(statement text, needle text) returns boolean language plpgsql as $$
begin execute statement; return false; exception when others then return position(needle in sqlerrm) > 0; end $$;
create function pg_temp.expect(ok boolean, label text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'FAILED: %', label; end if; end $$;

-- ids
create temp table ids as select
 'a0000000-0000-0000-0000-0000000000a1'::uuid tenant, 'a0000000-0000-0000-0000-0000000000a2'::uuid other_tenant,
 'c0000000-0000-0000-0000-0000000000c1'::uuid customer, 'c0000000-0000-0000-0000-0000000000c2'::uuid customer2,
 'e0000000-0000-0000-0000-0000000000e1'::uuid msg, 'e0000000-0000-0000-0000-0000000000e2'::uuid msg2,
 'd0000000-0000-0000-0000-0000000000d1'::uuid review, 'd0000000-0000-0000-0000-0000000000d2'::uuid review2,
 'f0000000-0000-0000-0000-0000000000f1'::uuid topic, 'b0000000-0000-0000-0000-0000000000b1'::uuid knowledge,
 '99999999-0000-0000-0000-000000000001'::uuid product, '77777777-0000-0000-0000-000000000001'::uuid auto_answer,
 '77777777-0000-0000-0000-000000000002'::uuid auto_answer2,
 'aaaaaaaaaaaaaaaaaaaaaaaa'::text account, 'bbbbbbbbbbbbbbbbbbbbbbbb'::text profile;
grant select on ids to public;

insert into public.profiles(id) select tenant from ids union all select other_tenant from ids;
insert into public.store_products(id,name,service_code) select product,'CRM','crm' from ids;
insert into public.customer_subscriptions(customer_id,product_id,plan,starts_at,expires_at)
 select tenant,product,'month',now()-interval '1 day',now()+interval '30 days' from ids;
insert into public.crm_customers(id,tenant_id,name) select customer,tenant,'مشتری یک' from ids union all select customer2,tenant,'مشتری دو' from ids;
insert into public.crm_interactions(id,tenant_id,customer_id,channel,direction,kind,body,external_event_id,occurred_at)
 select msg,tenant,customer,'instagram','inbound','message','ساعت کاری شما چیه؟','zernio-msg:'||md5(account||':'||'msg1'),now()-interval '10 minutes' from ids
 union all select msg2,tenant,customer2,'instagram','inbound','message','ساعت کاری شما چیه؟','zernio-msg:'||md5(account||':'||'msg2'),now()-interval '9 minutes' from ids;
insert into public.crm_zernio_profiles(tenant_id,profile_id) select tenant,profile from ids;
insert into public.crm_zernio_contacts(tenant_id,account_id,participant_id,customer_id,platform)
 select tenant,account,'p1',customer,'instagram' from ids union all select tenant,account,'p2',customer2,'instagram' from ids;
insert into public.crm_zernio_events(event_id,tenant_id,profile_id,account_id,event_type,payload,received_at)
 select gen_random_uuid(),tenant,profile,account,'message.received',
  jsonb_build_object('account',jsonb_build_object('platform','instagram'),'conversation',jsonb_build_object('id','conv1','participantId','p1'),'message',jsonb_build_object('id','msg1')),now() from ids
 union all select gen_random_uuid(),tenant,profile,account,'message.received',
  jsonb_build_object('account',jsonb_build_object('platform','instagram'),'conversation',jsonb_build_object('id','conv2','participantId','p2'),'message',jsonb_build_object('id','msg2')),now() from ids;
insert into public.sima_human_review_cases(id,tenant_id,customer_id,account_id,channel,last_message_id,last_occurred_at,state,conversation_version)
 select review,tenant,customer,account,'instagram',msg,(select occurred_at from public.crm_interactions where id=msg),'awaiting_human',1 from ids
 union all select review2,tenant,customer2,account,'instagram',msg2,(select occurred_at from public.crm_interactions where id=msg2),'awaiting_human',1 from ids;
insert into public.sima_knowledge_entries(id,tenant_id,title,question,answer,status,revision,approved_at)
 select knowledge,tenant,'ساعت کاری','ساعت کاری شما چیه','ساعت کاری ما شنبه تا چهارشنبه ۹ تا ۱۷ است','approved',1,now() from ids;
insert into public.sima_autonomy_settings(tenant_id,auto_enabled) select tenant,true from ids;
insert into public.sima_topics(id,tenant_id,topic_key,label,status,stage) select topic,tenant,'t_hours','ساعت کاری','active','auto' from ids;
select pg_temp.expect((select stage from public.sima_topics where topic_key='t_hours')='auto','fixture: the topic is automatic');
insert into public.sima_auto_answers(id,tenant_id,review_id,customer_id,topic_id,knowledge_entry_id,knowledge_revision,conversation_version,mode,status,answer_text,confidence_lower_bound,threshold)
 select auto_answer,tenant,review,customer,topic,knowledge,1,1,'live','queued','ساعت کاری ما شنبه تا چهارشنبه ۹ تا ۱۷ است',0.93,0.90 from ids;

create function pg_temp.prepare() returns text language sql as $$ select 'select public.sima_prepare_auto_send(''77777777-0000-0000-0000-000000000001'')' $$;

-- ---------- negatives: one change each, refused by the database ----------
savepoint s;
set local request.jwt.claim.role = 'authenticated';
select pg_temp.expect(pg_temp.refused(pg_temp.prepare(),'service_role_required'),'only the service role may prepare');
rollback to s;

savepoint s; delete from public.customer_subscriptions;
select pg_temp.expect(pg_temp.refused(pg_temp.prepare(),'crm_access_denied'),'no active CRM subscription'); rollback to s;
savepoint s; update public.customer_subscriptions set expires_at=now()-interval '1 minute';
select pg_temp.expect(pg_temp.refused(pg_temp.prepare(),'crm_access_denied'),'expired CRM subscription'); rollback to s;

savepoint s; update public.sima_autonomy_settings set auto_enabled=false;
select pg_temp.expect(pg_temp.refused(pg_temp.prepare(),'tenant_automatic_replies_disabled'),'automatic replies off'); rollback to s;
savepoint s; update public.sima_autonomy_settings set paused_at=now();
select pg_temp.expect(pg_temp.refused(pg_temp.prepare(),'tenant_automatic_replies_disabled'),'paused tenant'); rollback to s;
savepoint s; delete from public.sima_autonomy_settings where tenant_id='a0000000-0000-0000-0000-0000000000a1';
select pg_temp.expect(pg_temp.refused(pg_temp.prepare(),'tenant_automatic_replies_disabled'),'no settings row means off'); rollback to s;

savepoint s; update public.sima_topics set stage='suggest';
select pg_temp.expect(pg_temp.refused(pg_temp.prepare(),'topic_not_automatic'),'topic not in stage auto'); rollback to s;
savepoint s; update public.sima_topics set status='retired',stage='learning';
select pg_temp.expect(pg_temp.refused(pg_temp.prepare(),'topic_not_automatic'),'retired topic'); rollback to s;

savepoint s; update public.sima_knowledge_entries set answer='ساعت کاری ما ۱۰ تا ۲۰ است',status='draft',approved_at=null,revision=revision+1;   -- an edit, as the app does it
select pg_temp.expect(pg_temp.refused(pg_temp.prepare(),'answer_not_approved_verbatim'),'knowledge edited after the decision'); rollback to s;
savepoint s; update public.sima_knowledge_entries set answer='ساعت کاری ما ۱۰ تا ۲۰ است',status='approved',approved_at=now(),revision=revision+1;   -- edited AND re-approved: still approved, but not the text that was audited
select pg_temp.expect(pg_temp.refused(pg_temp.prepare(),'answer_not_approved_verbatim'),'knowledge edited and re-approved after the decision: the audited text is no longer the approved text'); rollback to s;
savepoint s; update public.sima_knowledge_entries set status='revoked',approved_at=null,revision=revision+1;
select pg_temp.expect(pg_temp.refused(pg_temp.prepare(),'answer_not_approved_verbatim'),'knowledge revoked'); rollback to s;
savepoint s; update public.sima_knowledge_entries set expires_at=now()-interval '1 minute',revision=revision+1;
select pg_temp.expect(pg_temp.refused(pg_temp.prepare(),'answer_not_approved_verbatim'),'knowledge expired'); rollback to s;
savepoint s; update public.sima_auto_answers set knowledge_entry_id=knowledge_entry_id;   -- (entries are never deleted: revisions reference them; a missing entry is simulated by another tenant's id)
select pg_temp.expect(pg_temp.refused($$select public.sima_prepare_auto_send('77777777-0000-0000-0000-000000000009')$$,'auto_answer_not_sendable'),'an unknown decision id is refused'); rollback to s;

savepoint s; update public.sima_autonomy_settings set auto_hourly_cap=1;
insert into public.sima_auto_answers(id,tenant_id,review_id,customer_id,topic_id,knowledge_entry_id,knowledge_revision,conversation_version,mode,status,answer_text)
 select auto_answer2,tenant,review2,customer2,topic,knowledge,1,1,'live','sent','ساعت کاری ما شنبه تا چهارشنبه ۹ تا ۱۷ است' from ids;
select pg_temp.expect(pg_temp.refused(pg_temp.prepare(),'hourly_cap_reached'),'hourly cap'); rollback to s;
savepoint s; update public.sima_autonomy_settings set auto_customer_daily_cap=1;
insert into public.sima_auto_answers(id,tenant_id,review_id,customer_id,topic_id,knowledge_entry_id,knowledge_revision,conversation_version,mode,status,answer_text)
 select auto_answer2,tenant,review,customer,topic,knowledge,1,2,'live','sent','ساعت کاری ما شنبه تا چهارشنبه ۹ تا ۱۷ است' from ids;
select pg_temp.expect(pg_temp.refused(pg_temp.prepare(),'customer_daily_cap_reached'),'per-customer daily cap'); rollback to s;

savepoint s; update public.crm_customers set do_not_contact=true where id='c0000000-0000-0000-0000-0000000000c1';
select pg_temp.expect(pg_temp.refused(pg_temp.prepare(),'contact_forbidden'),'opted-out customer'); rollback to s;
savepoint s; update public.sima_human_review_cases set conversation_version=2 where id='d0000000-0000-0000-0000-0000000000d1';
select pg_temp.expect(pg_temp.refused(pg_temp.prepare(),'conversation_stale_or_locked'),'the customer wrote again (stale version)'); rollback to s;
savepoint s; update public.sima_human_review_cases set state='resolved' where id='d0000000-0000-0000-0000-0000000000d1';
select pg_temp.expect(pg_temp.refused(pg_temp.prepare(),'conversation_stale_or_locked'),'a human already resolved it'); rollback to s;
savepoint s;
update public.crm_interactions set occurred_at=now()-interval '24 hours' where id='e0000000-0000-0000-0000-0000000000e1';
update public.sima_human_review_cases set last_occurred_at=now()-interval '24 hours' where id='d0000000-0000-0000-0000-0000000000d1';
select pg_temp.expect(pg_temp.refused(pg_temp.prepare(),'reply_window_closed'),'messaging window closed'); rollback to s;
savepoint s;
insert into public.crm_interactions(tenant_id,customer_id,channel,direction,kind,body,occurred_at)
 values('a0000000-0000-0000-0000-0000000000a1','c0000000-0000-0000-0000-0000000000c1','instagram','outbound','message','پاسخ انسان',now()-interval '1 minute');
select pg_temp.expect(pg_temp.refused(pg_temp.prepare(),'newer_business_reply_exists'),'a human already answered'); rollback to s;
savepoint s; delete from public.crm_zernio_contacts where customer_id='c0000000-0000-0000-0000-0000000000c1';
select pg_temp.expect(pg_temp.refused(pg_temp.prepare(),'channel_identity_not_verified'),'unverified channel identity'); rollback to s;
savepoint s; delete from public.crm_zernio_events where payload->'conversation'->>'id'='conv1';
select pg_temp.expect(pg_temp.refused(pg_temp.prepare(),'trusted_conversation_missing'),'no trusted conversation'); rollback to s;
savepoint s;
insert into public.sima_message_outbox(tenant_id,review_id,customer_id,account_id,conversation_id,body,conversation_version)
 values('a0000000-0000-0000-0000-0000000000a1','d0000000-0000-0000-0000-0000000000d1','c0000000-0000-0000-0000-0000000000c1','aaaaaaaaaaaaaaaaaaaaaaaa','conv1','x',1);
select pg_temp.expect(pg_temp.refused(pg_temp.prepare(),'turn_already_has_send'),'one send per turn, even across human/auto'); rollback to s;
savepoint s;
insert into public.sima_auto_answers(id,tenant_id,review_id,customer_id,topic_id,knowledge_entry_id,knowledge_revision,conversation_version,mode,status,answer_text)
 select auto_answer2,tenant,review2,customer2,topic,knowledge,1,1,'dry_run','dry_run','ساعت کاری ما شنبه تا چهارشنبه ۹ تا ۱۷ است' from ids;
select pg_temp.expect(pg_temp.refused('select public.sima_prepare_auto_send(''77777777-0000-0000-0000-000000000002'')','auto_answer_not_sendable'),'a dry-run decision can never be sent'); rollback to s;
savepoint s;
insert into public.sima_auto_answers(id,tenant_id,review_id,customer_id,topic_id,conversation_version,mode,status,reasons)
 select auto_answer2,tenant,review2,customer2,topic,1,'live','blocked','["RISK:LIVE_PRICE_UNVERIFIED"]'::jsonb from ids;
select pg_temp.expect(pg_temp.refused('select public.sima_prepare_auto_send(''77777777-0000-0000-0000-000000000002'')','auto_answer_not_sendable'),'a blocked decision can never be sent'); rollback to s;

-- ---------- table-level guards ----------
select pg_temp.expect(pg_temp.refused($$insert into public.sima_auto_answers(tenant_id,review_id,customer_id,topic_id,conversation_version,mode,status) values('a0000000-0000-0000-0000-0000000000a1','d0000000-0000-0000-0000-0000000000d2','c0000000-0000-0000-0000-0000000000c2','f0000000-0000-0000-0000-0000000000f1',1,'live','queued')$$,'sima_auto_answers_check'),'a live queued decision must carry the approved text and entry');
select pg_temp.expect(pg_temp.refused($$insert into public.sima_auto_answers(tenant_id,review_id,customer_id,topic_id,knowledge_entry_id,conversation_version,mode,status,answer_text) values('a0000000-0000-0000-0000-0000000000a1','d0000000-0000-0000-0000-0000000000d1','c0000000-0000-0000-0000-0000000000c1','f0000000-0000-0000-0000-0000000000f1','b0000000-0000-0000-0000-0000000000b1',1,'live','queued','x')$$,'duplicate key'),'one decision per customer turn');
select pg_temp.expect(pg_temp.refused($$update public.sima_auto_answers set answer_text='متن دیگر'$$,'auto_answer_identity_is_immutable'),'the audited text cannot change');

-- ---------- the happy path ----------
create temp table prepared as select public.sima_prepare_auto_send('77777777-0000-0000-0000-000000000001') as result;
select pg_temp.expect((select (result->>'queued')::boolean from prepared),'prepare returns a queued outbox item');
select pg_temp.expect((select o.actor='cima_auto' and o.status='pending' and o.attempt_count=0 and o.body='ساعت کاری ما شنبه تا چهارشنبه ۹ تا ۱۷ است' and o.conversation_id='conv1'
  from public.sima_message_outbox o where o.id=(select (result->>'outbox_id')::uuid from prepared)),'outbox item is automatic, pending, with the exact approved text and the trusted conversation');
select pg_temp.expect((select outbox_id is not null from public.sima_auto_answers where id='77777777-0000-0000-0000-000000000001'),'the decision points to its outbox item');
select pg_temp.expect(pg_temp.refused(pg_temp.prepare(),'auto_answer_not_sendable'),'a second prepare for the same decision is refused');

-- ---------- claim: last-moment kill switch, human items excluded ----------
savepoint c; update public.sima_autonomy_settings set paused_at=now();
select pg_temp.expect((select public.sima_claim_auto_send((select (result->>'outbox_id')::uuid from prepared)) is null),'a paused tenant cannot claim');
select pg_temp.expect((select status='rejected' and provider_error_code='auto_paused' from public.sima_message_outbox where id=(select (result->>'outbox_id')::uuid from prepared)),'the outbox item is rejected as auto_paused');
rollback to c;
savepoint c;
insert into public.sima_message_outbox(id,tenant_id,review_id,customer_id,account_id,conversation_id,body,conversation_version)
 values('88888888-0000-0000-0000-000000000001','a0000000-0000-0000-0000-0000000000a1','d0000000-0000-0000-0000-0000000000d2','c0000000-0000-0000-0000-0000000000c2','aaaaaaaaaaaaaaaaaaaaaaaa','conv2','متن انسان',1);
select pg_temp.expect((select public.sima_claim_auto_send('88888888-0000-0000-0000-000000000001') is null),'the automatic claim never touches a human outbox item');
select pg_temp.expect((select status='pending' from public.sima_message_outbox where id='88888888-0000-0000-0000-000000000001'),'the human item is left untouched');
rollback to c;
create temp table claimed as select public.sima_claim_auto_send((select (result->>'outbox_id')::uuid from prepared)) as result;
select pg_temp.expect((select result->>'body'='ساعت کاری ما شنبه تا چهارشنبه ۹ تا ۱۷ است' and result->>'conversation_id'='conv1' from claimed),'claim returns the dispatch payload');
select pg_temp.expect((select status='sending' and attempt_count=1 from public.sima_message_outbox where id=(select (result->>'outbox_id')::uuid from prepared)),'claim moves it to sending exactly once');
select pg_temp.expect((select public.sima_claim_auto_send((select (result->>'outbox_id')::uuid from prepared)) is null),'a second claim gets nothing (no double dispatch)');

-- finalize with the existing human finalizer, then settle the decision
select public.sima_finalize_human_send((select (result->>'outbox_id')::uuid from prepared),'accepted','provider-msg-1',null);
update public.sima_auto_answers set status='sent' where id='77777777-0000-0000-0000-000000000001';
select pg_temp.expect((select state='resolved' from public.sima_human_review_cases where id='d0000000-0000-0000-0000-0000000000d1'),'an accepted automatic reply closes the case');
select pg_temp.expect(pg_temp.refused($$update public.sima_auto_answers set status='queued'$$,'auto_answer_status_transition_refused'),'a sent decision cannot go back');
update public.sima_auto_answers set wrong_marked_at=now() where id='77777777-0000-0000-0000-000000000001';
select pg_temp.expect(pg_temp.refused($$update public.sima_auto_answers set wrong_marked_at=null$$,'auto_answer_wrong_mark_is_final'),'a wrong mark is final');

-- ---------- privileges ----------
reset role; set local request.jwt.claim.role = 'service_role';
set local role authenticated;
select pg_temp.expect(pg_temp.refused('select 1 from public.sima_auto_answers','permission denied'),'authenticated cannot read the audit table');
select pg_temp.expect(pg_temp.refused('select public.sima_prepare_auto_send(gen_random_uuid())','permission denied'),'authenticated cannot call prepare');
select pg_temp.expect(pg_temp.refused('select public.sima_claim_auto_send(gen_random_uuid())','permission denied'),'authenticated cannot call claim');
reset role;
set local role anon;
select pg_temp.expect(pg_temp.refused('select public.sima_prepare_auto_send(gen_random_uuid())','permission denied'),'anon cannot call prepare');
reset role;

select 'PASS: cima auto send schema' as result;
rollback;

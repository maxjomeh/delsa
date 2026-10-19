-- Add Zernio lifecycle subscriptions to the private, tenant-isolated inbox queue.
-- Account-less contact, sequence and workflow events are profile-scoped.
begin;
alter table public.crm_zernio_events alter column account_id drop not null;
alter table public.crm_zernio_events drop constraint if exists crm_zernio_events_event_type_check;
alter table public.crm_zernio_events add constraint crm_zernio_events_event_type_check check(event_type in ('account.connected','account.disconnected','message.received','message.sent','message.edited','message.deleted','message.delivered','message.read','message.failed','conversation.started','conversation.control_changed','reaction.received','referral.received','comment.received','review.new','review.updated','contact.tag_added','contact.tag_removed','contact.field_changed','sequence.enrolled','sequence.exited','workflow.run.started','workflow.run.completed','workflow.run.failed','lead.received'));
alter table public.crm_zernio_events add constraint crm_zernio_events_account_required_check check(account_id is not null or event_type in ('contact.tag_added','contact.tag_removed','contact.field_changed','sequence.enrolled','sequence.exited','workflow.run.started','workflow.run.completed','workflow.run.failed'));
commit;

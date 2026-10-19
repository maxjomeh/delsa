
-- Follow-up migration for current cursor and in-flight conversation.
alter table public.crm_zernio_history_sync add column if not exists current_conversation jsonb;
alter table public.crm_zernio_history_sync add column if not exists message_cursor text;

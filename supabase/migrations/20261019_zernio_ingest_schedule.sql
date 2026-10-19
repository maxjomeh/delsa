-- Backup worker: reprocess durable queued events if a serverless after() callback fails.
-- This is independent of external HTTP secrets and sends NO messages.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
 'sima_zernio_customer_projection',
 '*/2 * * * *',
 'select public.crm_zernio_process_batch(100);'
);

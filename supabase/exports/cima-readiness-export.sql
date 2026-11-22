-- CIMA readiness export — READ ONLY. Run it yourself in the Supabase SQL editor and save the single JSON value it returns.
-- It reads two tables of ONE tenant and changes nothing. What leaves the database:
--   * interactions: customer and message ids are replaced by one-way hashes (md5 salted with the tenant id), the message text
--     is cut to 600 characters, and e-mails, links, @handles and long digit runs (phone / card numbers) are masked;
--   * approved knowledge: id, title, question, answer, revision, status, expiry (this is text you wrote and approved).
-- No names, phone numbers, Instagram usernames, tokens or credentials are exported.
--
-- HOW TO USE: replace the uuid on the line marked <<< with YOUR user id (the tenant), run, copy the result into export.json.
with params as (
  select '00000000-0000-0000-0000-000000000000'::uuid as tenant,   -- <<< your tenant id (profiles.id)
         interval '180 days' as lookback,
         20000 as max_rows
), recent as (
  select i.*
  from public.crm_interactions i, params p
  where i.tenant_id = p.tenant and i.kind = 'message' and i.direction in ('inbound', 'outbound')
    and coalesce(i.occurred_at, i.created_at) >= now() - p.lookback
  order by coalesce(i.occurred_at, i.created_at) desc
  limit (select max_rows from params)
)
select jsonb_build_object(
  'format', 'cima-readiness-export/1',
  'exportedAt', now(),
  'interactions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', md5(r.id::text || p.tenant::text),
      'customer_id', md5(r.customer_id::text || p.tenant::text),
      'channel', r.channel, 'direction', r.direction, 'kind', r.kind,
      'occurred_at', coalesce(r.occurred_at, r.created_at),
      'body',
        regexp_replace(
        regexp_replace(
        regexp_replace(
        regexp_replace(left(r.body, 600),
          '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[ایمیل]', 'g'),
          '(https?://|www\.)\S+', '[لینک]', 'gi'),
          '(^|[[:space:](])@[A-Za-z0-9._]{2,}', '\1@[آیدی]', 'g'),
          '[0-9۰-۹٠-٩][0-9۰-۹٠-٩ ().٬,-]{6,}[0-9۰-۹٠-٩]', '[عدد بلند]', 'g')
    ) order by coalesce(r.occurred_at, r.created_at)) from recent r, params p), '[]'::jsonb),
  'knowledge', coalesce((
    select jsonb_agg(jsonb_build_object('id', k.id, 'title', k.title, 'question', k.question, 'answer', k.answer,
                                        'revision', k.revision, 'status', k.status, 'expires_at', k.expires_at) order by k.created_at)
    from public.sima_knowledge_entries k, params p where k.tenant_id = p.tenant and k.status = 'approved'), '[]'::jsonb)
) as export;

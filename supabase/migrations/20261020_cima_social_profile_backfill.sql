-- Backfill existing channel identities without changing human-entered names.
begin;
with ids as (
 select z.tenant_id,z.customer_id,z.platform,
 nullif(pg_catalog.btrim(trim(both '@' from coalesce(z.username,''))), '') uname,
 z.avatar_url
 from public.crm_zernio_contacts z
)
update public.crm_customers c
set instagram=case when ids.platform='instagram' and ids.uname ~ '^[A-Za-z0-9._]{1,30}$'
  and coalesce(c.instagram,'')='' then ids.uname else c.instagram end,
 custom_fields= jsonb_set(
   jsonb_set(coalesce(c.custom_fields,'{}'::jsonb),'{social_platform}',to_jsonb(ids.platform),true),
   '{social_username}',coalesce(to_jsonb(ids.uname),'null'::jsonb),true),
 updated_at=now()
from ids where c.tenant_id=ids.tenant_id and c.id=ids.customer_id
and (c.custom_fields->>'social_username' is distinct from ids.uname
 or (ids.platform='instagram' and ids.uname ~ '^[A-Za-z0-9._]{1,30}$' and coalesce(c.instagram,'')=''));
commit;
-- Tenant-safe identity enrichment from verified Zernio social contact mapping.
-- Never overwrite manually edited customer names or invent social profile images.
begin;
create or replace function public.sima_sync_social_identity()
returns trigger language plpgsql security definer set search_path='' as $body$
declare user_name text; display_name text;
begin
 user_name=nullif(trim(both '@' from pg_catalog.btrim(coalesce(new.username,''))),'');
 if user_name is not null and (length(user_name)>80 or user_name !~ '^[[:alnum:]_.-]+$') then user_name=null;end if;
 display_name=coalesce(user_name, 'مخاطب '||
  case new.platform when 'instagram' then 'اینستاگرام' when 'whatsapp' then 'واتساپ'
  when 'telegram' then 'تلگرام' else 'شبکهٔ اجتماعی' end||' · '||right(new.participant_id,6));
 update public.crm_customers c
 set name=case when pg_catalog.btrim(coalesce(c.name,'')) in ('','مخاطب شبکه اجتماعی')
    then display_name else c.name end,
   instagram=case when new.platform='instagram' and user_name is not null and coalesce(c.instagram,'')=''
     then user_name else c.instagram end,
   custom_fields=jsonb_set(
      jsonb_set(
        jsonb_set(coalesce(c.custom_fields,'{}'::jsonb),'{social_platform}',to_jsonb(new.platform),true),
        '{social_username}',coalesce(to_jsonb(user_name),'null'::jsonb),true),
      '{social_avatar_url}',coalesce(to_jsonb(nullif(new.avatar_url,'')),coalesce(c.custom_fields->'social_avatar_url','null'::jsonb)),true),
   updated_at=now()
 where c.tenant_id=new.tenant_id and c.id=new.customer_id
 and (c.name in ('','مخاطب شبکه اجتماعی')
    or (new.platform='instagram' and user_name is not null and coalesce(c.instagram,'')='')
    or c.custom_fields->>'social_username' is distinct from user_name
    or (new.avatar_url is not null and c.custom_fields->>'social_avatar_url' is distinct from new.avatar_url));
 return new;
end $body$;
revoke all on function public.sima_sync_social_identity() from public,anon,authenticated;
drop trigger if exists sima_sync_social_identity_insert on public.crm_zernio_contacts;
create trigger sima_sync_social_identity_insert after insert or update of username,avatar_url on public.crm_zernio_contacts
for each row execute function public.sima_sync_social_identity();

-- Backfill current identities (same verified tenant and platform participant). 
with names as (
 select c.tenant_id,c.id customer_id,c.name original_name,z.platform,z.participant_id,
    nullif(trim(both '@' from pg_catalog.btrim(coalesce(z.username,''))),'') username,
    z.avatar_url
 from public.crm_customers c join public.crm_zernio_contacts z
  on c.tenant_id=z.tenant_id and c.id=z.customer_id
 where c.name='مخاطب شبکه اجتماعی'
)
update public.crm_customers c
set name=coalesce(n.username,'مخاطب '||
  case n.platform when 'instagram' then 'اینستاگرام' when 'whatsapp' then 'واتساپ' else 'شبکهٔ اجتماعی' end||
  ' · '||right(n.participant_id,6)),
 instagram=case when n.platform='instagram' and n.username is not null and coalesce(c.instagram,'')=''
  then n.username else c.instagram end,
 custom_fields=jsonb_set(c.custom_fields,'{social_username}',coalesce(to_jsonb(n.username),'null'::jsonb),true),
 updated_at=now()
from names n where n.tenant_id=c.tenant_id and n.customer_id=c.id;
commit;
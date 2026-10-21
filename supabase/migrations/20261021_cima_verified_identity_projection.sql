-- CIMA-003: improve EXISTING contact identity trigger, do not introduce a second trigger.
-- Human-validated names, handles, phone numbers and avatar values have precedence.
BEGIN;
CREATE OR REPLACE FUNCTION public.sima_sync_social_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_username text;
 v_avatar text;
BEGIN
 v_username=pg_catalog.btrim(COALESCE(NEW.username,''));
 IF NEW.platform='instagram' THEN
  v_username=pg_catalog.ltrim(v_username,'@');
  IF v_username!~'^[A-Za-z0-9._]{1,30}$' THEN v_username=''; END IF;
 ELSIF length(v_username)>80 OR v_username!~'^[[:alnum:]_.-]+$' THEN v_username=''; END IF;
 v_avatar=pg_catalog.btrim(COALESCE(NEW.avatar_url,''));
 IF length(v_avatar)<12 OR length(v_avatar)>2048 OR v_avatar!~'^https://[^[:space:]<>]+$' THEN v_avatar=''; END IF;

 UPDATE public.crm_customers c
 SET
  name=CASE WHEN v_username<>'' AND
    (pg_catalog.btrim(COALESCE(c.name,'')) IN ('','مخاطب شبکه اجتماعی')
     OR c.name ~ '^مخاطب (اینستاگرام|واتساپ|تلگرام|شبکهٔ اجتماعی) · [^[:space:]]{6}$')
   THEN v_username ELSE c.name END,
  instagram=CASE WHEN NEW.platform='instagram' AND v_username<>'' AND COALESCE(c.instagram,'')=''
   THEN v_username ELSE c.instagram END,
  custom_fields=COALESCE(c.custom_fields,'{}'::jsonb)
   || CASE WHEN v_username<>'' AND COALESCE(c.custom_fields->>'social_username','')=''
     THEN pg_catalog.jsonb_build_object('social_username',v_username) ELSE '{}'::jsonb END
   || CASE WHEN v_avatar<>'' AND COALESCE(c.custom_fields->>'social_avatar_url','')=''
     THEN pg_catalog.jsonb_build_object('social_avatar_url',v_avatar) ELSE '{}'::jsonb END
   || CASE WHEN COALESCE(c.custom_fields->>'social_platform','')=''
     THEN pg_catalog.jsonb_build_object('social_platform',NEW.platform) ELSE '{}'::jsonb END,
  updated_at=now()
 WHERE c.id=NEW.customer_id AND c.tenant_id=NEW.tenant_id
  AND (
    (v_username<>'' AND (
      c.name IN ('','مخاطب شبکه اجتماعی')
      OR c.name ~ '^مخاطب (اینستاگرام|واتساپ|تلگرام|شبکهٔ اجتماعی) · [^[:space:]]{6}
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sima_sync_social_identity() FROM PUBLIC,anon,authenticated;

-- Only replace mechanically generated fallback labels using an existing,
-- account-scoped social contact username. Do not alter any human-entered name.
UPDATE public.crm_customers c SET name=pg_catalog.ltrim(pg_catalog.btrim(z.username),'@'),updated_at=now()
FROM public.crm_zernio_contacts z
WHERE c.id=z.customer_id AND c.tenant_id=z.tenant_id
 AND z.platform='instagram'
 AND pg_catalog.ltrim(pg_catalog.btrim(z.username),'@') ~ '^[A-Za-z0-9._]{1,30}$'
 AND c.name ~ '^مخاطب (اینستاگرام|واتساپ|تلگرام|شبکهٔ اجتماعی) · [^[:space:]]{6}$'
 AND c.name IS DISTINCT FROM pg_catalog.ltrim(pg_catalog.btrim(z.username),'@');
COMMIT;

      OR (NEW.platform='instagram' AND COALESCE(c.instagram,'')='')
      OR COALESCE(c.custom_fields->>'social_username','')=''
    ))
    OR (v_avatar<>'' AND COALESCE(c.custom_fields->>'social_avatar_url','')='')
    OR COALESCE(c.custom_fields->>'social_platform','')=''
  );
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sima_sync_social_identity() FROM PUBLIC,anon,authenticated;

-- Only replace mechanically generated fallback labels using an existing,
-- account-scoped social contact username. Do not alter any human-entered name.
UPDATE public.crm_customers c SET name=pg_catalog.ltrim(pg_catalog.btrim(z.username),'@'),updated_at=now()
FROM public.crm_zernio_contacts z
WHERE c.id=z.customer_id AND c.tenant_id=z.tenant_id
 AND z.platform='instagram'
 AND pg_catalog.ltrim(pg_catalog.btrim(z.username),'@') ~ '^[A-Za-z0-9._]{1,30}$'
 AND c.name ~ '^مخاطب (اینستاگرام|واتساپ|تلگرام|شبکهٔ اجتماعی) · [^[:space:]]{6}$'
 AND c.name IS DISTINCT FROM pg_catalog.ltrim(pg_catalog.btrim(z.username),'@');
COMMIT;

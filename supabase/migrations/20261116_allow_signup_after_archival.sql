-- Supabase Auth soft-deletion keeps a historical public.profiles row with
-- its original email/phone. A new auth.users record for the same number
-- must be able to create a new *active* profile through handle_new_user().
-- Preserve all archived rows and their CRM/website references.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_active_email_unique_idx
  ON public.profiles (email)
  WHERE archived_at IS NULL AND email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_active_phone_unique_idx
  ON public.profiles (phone)
  WHERE archived_at IS NULL AND phone IS NOT NULL;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_email_key;
DROP INDEX IF EXISTS public.profiles_phone_unique_idx;

COMMENT ON INDEX public.profiles_active_email_unique_idx IS
 'Active account login emails must be unique; archived account history is retained.';
COMMENT ON INDEX public.profiles_active_phone_unique_idx IS
 'Active customer mobile numbers must be unique; archived account history is retained.';

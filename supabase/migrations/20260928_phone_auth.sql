-- Enable phone/password accounts while preserving existing profile data.
alter table public.profiles alter column email drop not null;
alter table public.profiles add column if not exists phone text;

create unique index if not exists profiles_phone_unique_idx
  on public.profiles(phone) where phone is not null;

-- Copy native phone values for any accounts that already have them.
update public.profiles as profile
set phone = auth_user.phone
from auth.users as auth_user
where profile.id = auth_user.id
  and profile.phone is null
  and auth_user.phone is not null;

-- Preserve lookup for users created before native phone auth was enabled.
update public.profiles
set phone = '+' || regexp_replace(split_part(email, '@', 1), '^phone-', '')
where phone is null
  and email like 'phone-%@delsa.invalid';

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, phone, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.phone, new.raw_user_meta_data ->> 'phone'),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'user'
  );
  return new;
end;
$$;

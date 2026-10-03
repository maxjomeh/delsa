alter table public.store_products add column service_code text check(service_code is null or service_code='apu');
update public.store_products set service_code='apu' where name ~* '\yAPU\y';
create schema if not exists private;
grant usage on schema private to authenticated;
create function private.has_active_apu() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.customer_subscriptions s join public.store_products p on p.id=s.product_id where s.customer_id=auth.uid() and s.starts_at<=now() and s.expires_at>now() and p.service_code='apu');
$$;
revoke all on function private.has_active_apu() from public,anon;
grant execute on function private.has_active_apu() to authenticated;
create function public.has_active_apu() returns boolean language sql stable security invoker set search_path='' as $$ select private.has_active_apu(); $$;
revoke all on function public.has_active_apu() from public,anon;
grant execute on function public.has_active_apu() to authenticated;
create table public.apu_messages(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 sender_id uuid not null references auth.users(id),
 sender_role text not null check(sender_role in ('customer','admin')),
 body text not null default '' check(char_length(body)<=4000),
 kind text not null default 'message' check(kind in ('message','invoice','attachment')),
 file_path text unique, file_name text, mime_type text, file_size bigint,
 created_at timestamptz not null default clock_timestamp(),
 check(char_length(trim(body))>0 or file_path is not null),
 check((file_path is null and file_name is null and mime_type is null and file_size is null and kind='message') or (file_path is not null and split_part(file_path,'/',1)=user_id::text and file_name is not null and char_length(file_name) between 1 and 240 and mime_type is not null and file_size is not null and file_size between 1 and 20971520))
);
create index apu_messages_user_created on public.apu_messages(user_id,created_at);
alter table public.apu_messages enable row level security;
grant select,insert on public.apu_messages to authenticated;
revoke all on public.apu_messages from anon;
create policy apu_messages_read on public.apu_messages for select to authenticated using(user_id=(select auth.uid()) or (select public.is_admin()));
create policy apu_messages_send on public.apu_messages for insert to authenticated with check(sender_id=(select auth.uid()) and ((sender_role='customer' and user_id=(select auth.uid()) and (select public.has_active_apu())) or (sender_role='admin' and (select public.is_admin()))) and (file_path is null or exists(select 1 from storage.objects o where o.bucket_id='apu-attachments' and o.name=file_path)));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('apu-attachments','apu-attachments',false,20971520,array['application/pdf','image/jpeg','image/png','image/webp','image/gif','text/plain','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.wordprocessingml.document','audio/webm','video/webm','audio/ogg','audio/mpeg','audio/mp4','video/mp4','audio/wav','audio/x-wav']);
create policy apu_files_read on storage.objects for select to authenticated using(bucket_id='apu-attachments' and ((storage.foldername(name))[1]=(select auth.uid())::text or (select public.is_admin())));
create policy apu_files_upload on storage.objects for insert to authenticated with check(bucket_id='apu-attachments' and (((storage.foldername(name))[1]=(select auth.uid())::text and (select public.has_active_apu())) or (select public.is_admin())));
create policy apu_files_cleanup on storage.objects for delete to authenticated using(bucket_id='apu-attachments' and ((storage.foldername(name))[1]=(select auth.uid())::text or (select public.is_admin())) and not exists(select 1 from public.apu_messages where file_path=storage.objects.name));

alter table public.apu_messages add constraint apu_file_metadata_required check(file_path is null or (file_name is not null and mime_type is not null and file_size is not null));

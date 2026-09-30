alter table public.visitor_chats add column full_name text check (full_name is null or char_length(trim(full_name)) between 2 and 120);
alter table public.support_messages add column edited_at timestamptz, add column deleted_at timestamptz, add column hidden_by uuid[] not null default '{}';
alter table public.visitor_chat_messages add column sender_id uuid default auth.uid() references auth.users(id) on delete set null, add column edited_at timestamptz, add column deleted_at timestamptz, add column hidden_by uuid[] not null default '{}', add column visitor_hidden boolean not null default false;
-- Clients can only insert original message fields; action metadata is RPC-only.
revoke insert on public.support_messages,public.visitor_chat_messages from authenticated;
grant insert(user_id,sender_id,sender_role,body) on public.support_messages to authenticated;
grant insert(chat_id,sender_id,sender_role,body) on public.visitor_chat_messages to authenticated;

create function public.support_message_action(p_kind text,p_id uuid,p_action text,p_body text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_admin boolean:=public.is_admin(); v_owned boolean; v_deleted timestamptz; v_role text;
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 if p_kind='customer' then
  select sender_id=v_uid,deleted_at,sender_role into v_owned,v_deleted,v_role from public.support_messages where id=p_id and (user_id=v_uid or v_admin) for update;
 elsif p_kind='visitor' and v_admin then
  select sender_role='admin' and (sender_id=v_uid or sender_id is null),deleted_at,sender_role into v_owned,v_deleted,v_role from public.visitor_chat_messages where id=p_id for update;
 else raise exception 'Access denied'; end if;
 if not found then raise exception 'Message not found'; end if;
 if p_action='hide' then
  if p_kind='customer' then update public.support_messages set hidden_by=array_append(array_remove(hidden_by,v_uid),v_uid) where id=p_id;
  else update public.visitor_chat_messages set hidden_by=array_append(array_remove(hidden_by,v_uid),v_uid) where id=p_id; end if;
 elsif p_action='edit' then
  if not coalesce(v_owned,false) or v_deleted is not null then raise exception 'Only the sender can edit'; end if;
  if char_length(trim(coalesce(p_body,''))) not between 1 and (case when p_kind='visitor' then 2000 else 4000 end) then raise exception 'Invalid message'; end if;
  if p_kind='customer' then update public.support_messages set body=trim(p_body),edited_at=clock_timestamp() where id=p_id;
  else update public.visitor_chat_messages set body=trim(p_body),edited_at=clock_timestamp() where id=p_id; end if;
 elsif p_action='delete' then
  if v_role='system' or not (coalesce(v_owned,false) or v_admin) then raise exception 'Only sender or admin can delete for everyone'; end if;
  if p_kind='customer' then update public.support_messages set body='پیام حذف شد.',deleted_at=coalesce(deleted_at,clock_timestamp()) where id=p_id;
  else update public.visitor_chat_messages set body='پیام حذف شد.',deleted_at=coalesce(deleted_at,clock_timestamp()) where id=p_id; end if;
 else raise exception 'Invalid action'; end if;
end $$;
revoke all on function public.support_message_action(text,uuid,text,text) from public,anon;
grant execute on function public.support_message_action(text,uuid,text,text) to authenticated;

create or replace function public.visitor_chat_read(p_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_chat public.visitor_chats; v_messages jsonb;
begin
 if coalesce(p_token,'') !~ '^[0-9a-f]{64}$' then raise exception 'Invalid chat token'; end if;
 select * into v_chat from public.visitor_chats where access_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 if not found then raise exception 'Chat not found'; end if;
 select coalesce(jsonb_agg(to_jsonb(m)-'hidden_by'-'sender_id'-'visitor_hidden' order by m.created_at,m.id),'[]'::jsonb) into v_messages from public.visitor_chat_messages m where chat_id=v_chat.id and not visitor_hidden;
 return jsonb_build_object('chat_id',v_chat.id,'full_name',v_chat.full_name,'phone',v_chat.phone,'messages',v_messages);
end $$;
create function public.visitor_chat_identify(p_token text,p_name text,p_phone text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_phone text:=regexp_replace(translate(p_phone,'۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩','01234567890123456789'),'[^0-9+]','','g');
begin
 if coalesce(p_token,'') !~ '^[0-9a-f]{64}$' then raise exception 'Invalid chat token'; end if;
 if char_length(trim(coalesce(p_name,''))) not between 2 and 120 or trim(p_name) !~ '[[:space:]]' then raise exception 'Full name required'; end if;
 if coalesce(v_phone,'') !~ '^((\+98|0)?9[0-9]{9}|\+[0-9]{8,15})$' then raise exception 'Invalid phone'; end if;
 update public.visitor_chats set full_name=trim(p_name),phone=v_phone,updated_at=clock_timestamp() where access_hash=encode(extensions.digest(p_token,'sha256'),'hex') returning id into v_id;
 if v_id is null then raise exception 'Chat not found'; end if;
 return public.visitor_chat_read(p_token);
end $$;
create function public.visitor_message_action(p_token text,p_id uuid,p_action text,p_body text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_chat uuid; v_role text; v_deleted timestamptz;
begin
 if coalesce(p_token,'') !~ '^[0-9a-f]{64}$' then raise exception 'Invalid chat token'; end if;
 select id into v_chat from public.visitor_chats where access_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 if v_chat is null then raise exception 'Chat not found'; end if;
 select sender_role,deleted_at into v_role,v_deleted from public.visitor_chat_messages where id=p_id and chat_id=v_chat for update;
 if not found then raise exception 'Message not found'; end if;
 if p_action='hide' then update public.visitor_chat_messages set visitor_hidden=true where id=p_id;
 elsif p_action='edit' then
  if v_role<>'visitor' or v_deleted is not null then raise exception 'Only sender can edit'; end if;
  if char_length(trim(coalesce(p_body,''))) not between 1 and 2000 then raise exception 'Invalid message'; end if;
  update public.visitor_chat_messages set body=trim(p_body),edited_at=clock_timestamp() where id=p_id;
 elsif p_action='delete' then
  if v_role<>'visitor' then raise exception 'Only sender can delete for everyone'; end if;
  update public.visitor_chat_messages set body='پیام حذف شد.',deleted_at=coalesce(deleted_at,clock_timestamp()) where id=p_id;
 else raise exception 'Invalid action'; end if;
 return public.visitor_chat_read(p_token);
end $$;
revoke all on function public.visitor_chat_identify(text,text,text),public.visitor_message_action(text,uuid,text,text) from public;
grant execute on function public.visitor_chat_identify(text,text,text),public.visitor_message_action(text,uuid,text,text) to anon,authenticated;
create or replace function public.visitor_chat_start(p_body text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_chat public.visitor_chats; v_token text; v_time timestamptz:=clock_timestamp();
begin
 if char_length(trim(coalesce(p_body,''))) not between 1 and 2000 then raise exception 'Invalid message'; end if;
 v_token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.visitor_chats(access_hash) values(encode(extensions.digest(v_token,'sha256'),'hex')) returning * into v_chat;
 insert into public.visitor_chat_messages(chat_id,sender_role,body,created_at) values(v_chat.id,'visitor',trim(p_body),v_time),(v_chat.id,'system','ممنون از پیامت! لطفاً فرم نام و نام خانوادگی و شماره تماس را برای پیگیری گفت‌وگو تکمیل کن.',v_time+interval '1 millisecond');
 return public.visitor_chat_read(v_token)||jsonb_build_object('token',v_token);
end $$;
alter policy "Admins reply to visitors" on public.visitor_chat_messages with check ((select public.is_admin()) and sender_role='admin' and sender_id=(select auth.uid()));

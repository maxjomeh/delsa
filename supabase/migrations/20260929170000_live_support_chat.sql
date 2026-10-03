create table public.visitor_chats (
  id uuid primary key default gen_random_uuid(),
  access_hash text not null unique,
  phone text check (phone is null or char_length(phone) between 8 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.visitor_chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.visitor_chats(id) on delete cascade,
  sender_role text not null check (sender_role in ('visitor','admin','system')),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index visitor_chat_messages_order_idx on public.visitor_chat_messages(chat_id,created_at);
create index visitor_chats_updated_idx on public.visitor_chats(updated_at desc);
alter table public.visitor_chats enable row level security;
alter table public.visitor_chat_messages enable row level security;
revoke all on public.visitor_chats, public.visitor_chat_messages from anon, authenticated;
grant select on public.visitor_chats, public.visitor_chat_messages to authenticated;
grant insert on public.visitor_chat_messages to authenticated;
create policy "Admins view visitor chats" on public.visitor_chats for select to authenticated using ((select public.is_admin()));
create policy "Admins view visitor messages" on public.visitor_chat_messages for select to authenticated using ((select public.is_admin()));
create policy "Admins reply to visitors" on public.visitor_chat_messages for insert to authenticated
  with check ((select public.is_admin()) and sender_role = 'admin');

create function public.visitor_chat_start(p_body text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_chat public.visitor_chats; v_token text; v_message public.visitor_chat_messages; v_prompt public.visitor_chat_messages;
begin
  if char_length(trim(coalesce(p_body,''))) not between 1 and 2000 then raise exception 'Invalid message'; end if;
  v_token := encode(gen_random_bytes(32),'hex');
  insert into public.visitor_chats(access_hash) values (encode(extensions.digest(v_token,'sha256'),'hex')) returning * into v_chat;
  insert into public.visitor_chat_messages(chat_id,sender_role,body) values (v_chat.id,'visitor',trim(p_body)) returning * into v_message;
  insert into public.visitor_chat_messages(chat_id,sender_role,body)
    values (v_chat.id,'system','ممنون از پیامت! برای اینکه بتوانیم با شما در تماس باشیم، لطفاً شماره تماس خود را وارد کنید.') returning * into v_prompt;
  return jsonb_build_object('token',v_token,'chat_id',v_chat.id,'messages',jsonb_build_array(to_jsonb(v_message),to_jsonb(v_prompt)));
end $$;

create function public.visitor_chat_read(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_chat public.visitor_chats; v_messages jsonb;
begin
  if coalesce(p_token,'') !~ '^[0-9a-f]{64}$' then raise exception 'Invalid chat token'; end if;
  select * into v_chat from public.visitor_chats where access_hash = encode(extensions.digest(p_token,'sha256'),'hex');
  if not found then raise exception 'Chat not found'; end if;
  select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at,m.id),'[]'::jsonb) into v_messages
    from public.visitor_chat_messages m where m.chat_id = v_chat.id;
  return jsonb_build_object('chat_id',v_chat.id,'phone',v_chat.phone,'messages',v_messages);
end $$;

create function public.visitor_chat_send(p_token text,p_body text default null,p_phone text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_chat public.visitor_chats; v_message public.visitor_chat_messages;
begin
  if coalesce(p_token,'') !~ '^[0-9a-f]{64}$' then raise exception 'Invalid chat token'; end if;
  select * into v_chat from public.visitor_chats where access_hash = encode(extensions.digest(p_token,'sha256'),'hex') for update;
  if not found then raise exception 'Chat not found'; end if;
  if v_chat.updated_at > now() - interval '2 seconds' then raise exception 'Please wait before sending again'; end if;
  if p_phone is not null then
    if regexp_replace(p_phone,'[^0-9+]','','g') !~ '^((\+98|0)?9[0-9]{9}|\+[0-9]{8,15})$' then raise exception 'Invalid phone'; end if;
    update public.visitor_chats set phone = left(regexp_replace(p_phone,'[^0-9+]','','g'),20),updated_at = now() where id = v_chat.id;
    return public.visitor_chat_read(p_token);
  end if;
  if char_length(trim(coalesce(p_body,''))) not between 1 and 2000 then raise exception 'Invalid message'; end if;
  insert into public.visitor_chat_messages(chat_id,sender_role,body) values (v_chat.id,'visitor',trim(p_body)) returning * into v_message;
  update public.visitor_chats set updated_at = now() where id = v_chat.id;
  return public.visitor_chat_read(p_token);
end $$;
revoke all on function public.visitor_chat_start(text),public.visitor_chat_read(text),public.visitor_chat_send(text,text,text) from public;
grant execute on function public.visitor_chat_start(text),public.visitor_chat_read(text),public.visitor_chat_send(text,text,text) to anon,authenticated;

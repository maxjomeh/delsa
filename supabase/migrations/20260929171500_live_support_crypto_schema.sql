create or replace function public.visitor_chat_start(p_body text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_chat public.visitor_chats; v_token text; v_message public.visitor_chat_messages; v_prompt public.visitor_chat_messages;
begin
  if char_length(trim(coalesce(p_body,''))) not between 1 and 2000 then raise exception 'Invalid message'; end if;
  v_token := encode(extensions.gen_random_bytes(32),'hex');
  insert into public.visitor_chats(access_hash) values (encode(extensions.digest(v_token,'sha256'),'hex')) returning * into v_chat;
  insert into public.visitor_chat_messages(chat_id,sender_role,body,created_at)
    values (v_chat.id,'visitor',trim(p_body),clock_timestamp()) returning * into v_message;
  insert into public.visitor_chat_messages(chat_id,sender_role,body,created_at)
    values (v_chat.id,'system','ممنون از پیامت! برای اینکه بتوانیم با شما در تماس باشیم، لطفاً شماره تماس خود را وارد کنید.',v_message.created_at + interval '1 millisecond') returning * into v_prompt;
  return jsonb_build_object('token',v_token,'chat_id',v_chat.id,'messages',jsonb_build_array(to_jsonb(v_message),to_jsonb(v_prompt)));
end $$;

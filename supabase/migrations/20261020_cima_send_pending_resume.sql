-- Release pending-but-never-attempted human sends only on another explicit click.
-- SECURITY DEFINER functions remain EXECUTE-granted to service_role exclusively.
-- No attempt is re-sent if it was already claimed or has an unknown outcome.
begin;
do $patch$
declare src text;needle text;replacement text;
begin
 src=pg_get_functiondef('public.sima_prepare_human_send(uuid,bigint,text)'::regprocedure);
 needle=$p$
 if exists(select 1 from public.sima_message_outbox s
  where s.tenant_id=v_case.tenant_id and s.review_id=v_case.id
   and s.conversation_version=v_case.conversation_version) then
   raise exception 'turn_already_has_send';end if;$p$;
 replacement=$p$
 select s.id into v_id from public.sima_message_outbox s
  where s.tenant_id=v_case.tenant_id and s.review_id=v_case.id
   and s.conversation_version=v_case.conversation_version;
 if v_id is not null then
   if exists(select 1 from public.sima_message_outbox s where s.id=v_id
     and s.status='pending' and s.attempt_count=0 and s.body=btrim(p_body))
   then return jsonb_build_object('outbox_id',v_id,'queued',true,'resumed_pending',true);
   else raise exception 'turn_already_has_send';end if;
 end if;$p$;
 if position(needle in src)=0 then raise exception 'prepare_guard_changed';end if;
 execute replace(src,needle,replacement);
 src=pg_get_functiondef('public.sima_claim_human_send(uuid)'::regprocedure);
 needle=$p$
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' then raise exception 'service_role_required';end if;$p$;
 if position(needle in src)=0 then raise exception 'claim_guard_changed';end if;
 execute replace(src,needle,'');
 src=pg_get_functiondef('public.sima_finalize_human_send(uuid,text,text,text)'::regprocedure);
 if position(needle in src)=0 then raise exception 'finalize_guard_changed';end if;
 execute replace(src,needle,'');
end $patch$;
revoke all on function public.sima_claim_human_send(uuid) from public,anon,authenticated;
grant execute on function public.sima_claim_human_send(uuid) to service_role;
revoke all on function public.sima_finalize_human_send(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.sima_finalize_human_send(uuid,text,text,text) to service_role;
commit;
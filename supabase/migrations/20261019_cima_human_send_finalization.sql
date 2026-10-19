begin;
create or replace function public.sima_finalize_human_send(
 p_outbox_id uuid,p_status text,p_message_id text default null,p_error_code text default null
) returns jsonb language plpgsql security definer set search_path='' as $function$
declare o public.sima_message_outbox%rowtype;v_updated integer;
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' then raise exception 'service_role_required';end if;
 if p_status not in('accepted','rejected','unknown') then raise exception 'invalid_delivery_state';end if;
 if p_status='accepted' and (p_message_id is null or length(p_message_id)<1 or length(p_message_id)>255) then
  raise exception 'provider_receipt_missing';end if;
 select * into o from public.sima_message_outbox where id=p_outbox_id for update;
 if not found then raise exception 'outbox_not_found';end if;
 if o.status<>'sending' then return jsonb_build_object('status',o.status,'updated',false);end if;
 update public.sima_message_outbox
 set status=p_status,provider_message_id=case when p_status='accepted' then p_message_id else null end,
     provider_error_code=left(p_error_code,100),
     sent_at=case when p_status='accepted' then now() else null end,updated_at=now()
 where id=o.id;
 if p_status='accepted' then
  update public.sima_human_review_cases
  set state='resolved',updated_at=now(),draft_text=o.body,draft_version=o.conversation_version
  where tenant_id=o.tenant_id and id=o.review_id and conversation_version=o.conversation_version
   and state in('awaiting_human','drafting');
  get diagnostics v_updated=row_count;
 else v_updated=0;
 end if;
 return jsonb_build_object('status',p_status,'review_closed',v_updated>0);
end $function$;
revoke all on function public.sima_finalize_human_send(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.sima_finalize_human_send(uuid,text,text,text) to service_role;

-- Orphaned dispatches must never remain indefinitely marked "sending".
-- This SQL job does not call the provider or retry messages.
select cron.schedule('sima_outbox_unknown_reaper','*/3 * * * *',
 $$update public.sima_message_outbox set status='unknown',provider_error_code='dispatcher_lost',updated_at=now()
   where status='sending' and updated_at<now()-interval '3 minutes';$$);
commit;
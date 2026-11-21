-- Run AFTER builder-instagram.sql (locally: supabase/tests/local-postgres/run.sh supabase/tests/builder-instagram.sql).
-- Needs two ordinary accounts. Everything is rolled back.
begin;
do $$
declare a uuid;b uuid;ra uuid;rb uuid;r record;n integer;denied boolean;cipher text:=repeat('x',48);ids uuid[];i integer;
begin
 select id into a from public.profiles where role<>'admin' order by id limit 1;
 select id into b from public.profiles where role<>'admin' and id<>a order by id limit 1;
 if a is null or b is null then raise exception 'two accounts needed';end if;
 -- ---- connect / reconnect (service side)
 execute 'set local role service_role';
 ra=public.builder_connect_instagram(a,'17841400000001','shop_a',cipher,now()+interval '60 days');
 if ra is null then raise exception 'connect must return the row id';end if;
 if public.builder_connect_instagram(a,'17841400000001','shop_a2',cipher||'y',now()+interval '59 days')<>ra then raise exception 'reconnecting the same account must reuse the row';end if;
 rb=public.builder_connect_instagram(b,'17841400000001','shop_a_other_owner',cipher,now()+interval '60 days');
 if rb=ra then raise exception 'another owner gets their own row';end if;
 reset role;
 if (select username from public.builder_instagram_accounts where id=ra)<>'shop_a2' then raise exception 'reconnect refreshes the username';end if;
 if (select count(*) from private.builder_instagram_tokens where account_row=ra)<>1 then raise exception 'exactly one token per account';end if;
 -- ---- invalid input
 execute 'set local role service_role';
 denied=false;begin perform public.builder_connect_instagram(a,'not-numeric',cipher,cipher,now()+interval '1 day');exception when others then denied=true;end;
 if not denied then raise exception 'non numeric account id must be rejected';end if;
 denied=false;begin perform public.builder_connect_instagram(a,'17841400000009','x','short',now()+interval '1 day');exception when others then denied=true;end;
 if not denied then raise exception 'too short ciphertext must be rejected';end if;
 denied=false;begin perform public.builder_connect_instagram(a,'17841400000009','x',cipher,now()-interval '1 day');exception when others then denied=true;end;
 if not denied then raise exception 'past expiry must be rejected';end if;
 denied=false;begin perform public.builder_connect_instagram('00000000-0000-0000-0000-00000000ffff','17841400000009','x',cipher,now()+interval '1 day');exception when others then denied=true;end;
 if not denied then raise exception 'unknown owner must be rejected';end if;
 -- ---- token access is owner scoped
 select * into r from public.builder_instagram_token(a,ra);
 if r.ciphertext is null or r.account_id<>'17841400000001' then raise exception 'owner reads own token';end if;
 if exists(select 1 from public.builder_instagram_token(b,ra)) then raise exception 'another owner must not read the token';end if;
 if exists(select 1 from public.builder_instagram_token(a,rb)) then raise exception 'owner must not read another owner''s row';end if;
 -- ---- limit of 5 accounts per owner
 for i in 2..5 loop perform public.builder_connect_instagram(a,'1784140000010'||i,'acc'||i,cipher,now()+interval '60 days');end loop;
 denied=false;begin perform public.builder_connect_instagram(a,'17841400000199','acc6',cipher,now()+interval '60 days');exception when others then denied=(sqlerrm like '%builder_instagram_limit%');end;
 if not denied then raise exception 'sixth account must hit the limit';end if;
 if public.builder_connect_instagram(a,'17841400000001','shop_a',cipher,now()+interval '60 days')<>ra then raise exception 'reconnecting an existing account is allowed at the limit';end if;
 -- ---- refresh, expire, disconnect
 if not public.builder_instagram_store_token(a,ra,cipher||'z',now()+interval '58 days') then raise exception 'store_token';end if;
 if public.builder_instagram_store_token(b,ra,cipher,now()+interval '58 days') then raise exception 'store_token is owner scoped';end if;
 perform public.builder_instagram_mark_expired(a,ra);
 if exists(select 1 from public.builder_instagram_token(a,ra)) then raise exception 'expired accounts return no token';end if;
 if not public.builder_instagram_store_token(a,ra,cipher||'w',now()+interval '58 days') then raise exception 'a refreshed expired account reconnects';end if;
 perform public.builder_disconnect_instagram(b,ra);
 if not exists(select 1 from public.builder_instagram_token(a,ra)) then raise exception 'another owner cannot disconnect';end if;
 perform public.builder_disconnect_instagram(a,ra);
 if exists(select 1 from public.builder_instagram_token(a,ra)) then raise exception 'disconnected accounts return no token';end if;
 reset role;
 if exists(select 1 from private.builder_instagram_tokens where account_row=ra) then raise exception 'disconnect deletes the token';end if;
 -- ---- browser roles
 perform set_config('request.jwt.claim.sub',a::text,true);execute 'set local role authenticated';
 select count(*) into n from public.builder_instagram_accounts;
 if n<>5 or exists(select 1 from public.builder_instagram_accounts where owner_id<>a) then raise exception 'RLS: an owner sees only their own accounts (saw %)',n;end if;
 denied=false;begin perform ciphertext from private.builder_instagram_tokens;exception when others then denied=true;end;
 if not denied then raise exception 'tokens are unreadable for authenticated';end if;
 denied=false;begin perform public.builder_instagram_token(a,rb);exception when others then denied=true;end;
 if not denied then raise exception 'token function is service-only';end if;
 denied=false;begin perform public.builder_connect_instagram(a,'17841400000777','x',cipher,now()+interval '1 day');exception when others then denied=true;end;
 if not denied then raise exception 'connect is service-only';end if;
 denied=false;begin insert into public.builder_instagram_accounts(owner_id,account_id) values(a,'17841400000778');exception when others then denied=true;end;
 if not denied then raise exception 'direct inserts are refused';end if;
 denied=false;begin update public.builder_instagram_accounts set status='connected';exception when others then denied=true;end;
 if not denied then raise exception 'direct updates are refused';end if;
 reset role;
 execute 'set local role anon';
 denied=false;begin perform count(*) from public.builder_instagram_accounts;exception when others then denied=true;end;
 if not denied then raise exception 'anon has no access';end if;
 reset role;
 raise notice 'PASS: builder instagram connection (owner isolation, token secrecy, limits, expiry, disconnect, RLS)';
end $$;
rollback;

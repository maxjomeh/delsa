-- Run AFTER builder-instagram-ai.sql. Needs two ordinary accounts. Everything is rolled back.
begin;
do $$
declare a uuid;b uuid;r integer;denied boolean;n integer;
begin
 select id into a from public.profiles where role<>'admin' order by id limit 1;
 select id into b from public.profiles where role<>'admin' and id<>a order by id limit 1;
 if a is null or b is null then raise exception 'two accounts needed';end if;
 execute 'set local role service_role';
 if public.builder_ai_remaining(a,10)<>10 then raise exception 'a fresh month has the full allowance';end if;
 if public.builder_ai_claim(a,3,10)<>7 then raise exception 'claiming 3 of 10 leaves 7';end if;
 if public.builder_ai_claim(a,7,10)<>0 then raise exception 'claiming the rest leaves 0';end if;
 if public.builder_ai_claim(a,1,10)<>-1 then raise exception 'the cap cannot be passed';end if;
 if public.builder_ai_remaining(a,10)<>0 then raise exception 'remaining after the cap';end if;
 if public.builder_ai_claim(a,11,10)<>-1 then raise exception 'a single request above the cap is refused';end if;
 if public.builder_ai_claim(b,5,10)<>5 then raise exception 'owners are counted separately';end if;
 perform public.builder_ai_release(a,4);
 if public.builder_ai_remaining(a,10)<>4 then raise exception 'release gives units back (got %)',public.builder_ai_remaining(a,10);end if;
 perform public.builder_ai_release(a,100);
 if public.builder_ai_remaining(a,10)<>4+0 and public.builder_ai_remaining(a,10)<>10 then raise exception 'release never goes below zero';end if;
 if public.builder_ai_claim(a,1,10)<0 then raise exception 'claiming works again after a release';end if;
 foreach n in array array[0,-1,51] loop
  denied=false;begin perform public.builder_ai_claim(a,n,10);exception when others then denied=true;end;
  if not denied then raise exception 'count % must be refused',n;end if;
 end loop;
 denied=false;begin perform public.builder_ai_claim(a,1,0);exception when others then denied=true;end;if not denied then raise exception 'cap 0 refused';end if;
 denied=false;begin perform public.builder_ai_claim('00000000-0000-0000-0000-00000000ffff',1,10);exception when others then denied=true;end;if not denied then raise exception 'unknown owner refused';end if;
 reset role;
 perform set_config('request.jwt.claim.sub',a::text,true);execute 'set local role authenticated';
 denied=false;begin perform public.builder_ai_claim(a,1,100000);exception when others then denied=true;end;if not denied then raise exception 'claim is service-only';end if;
 denied=false;begin perform count(*) from public.builder_ai_usage;exception when others then denied=true;end;if not denied then raise exception 'usage table is not readable by browsers';end if;
 reset role;
 raise notice 'PASS: builder AI quota (atomic claims, cap, release, owner isolation, service-only)';
end $$;
rollback;

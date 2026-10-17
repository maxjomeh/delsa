-- PENDING EXPLICIT APPROVAL: not applied to production. FREE_BUILDER_ENABLED stays false.
-- An explicit free enrollment grants only the requested site-builder tier.
create table public.builder_free_memberships(
 customer_id uuid primary key references public.profiles(id),
 created_at timestamptz not null default now()
);
alter table public.builder_free_memberships enable row level security;
revoke all on public.builder_free_memberships from public,anon;
grant select,insert on public.builder_free_memberships to authenticated;
create policy builder_free_membership_read on public.builder_free_memberships for select to authenticated
 using(customer_id=(select auth.uid()) or (select public.is_admin()));
create policy builder_free_membership_enroll on public.builder_free_memberships for insert to authenticated
 with check(customer_id=(select auth.uid()));
-- No automatic enrollment, no edits to paid subscriptions, no new anonymous writes.
create or replace function public.has_site_builder_access() returns boolean language sql stable security invoker set search_path='' as $$
 select public.is_admin() or exists(select 1 from public.customer_subscriptions s join public.store_products p on p.id=s.product_id where s.customer_id=auth.uid() and s.starts_at<=now() and s.expires_at>now() and p.service_code='site_builder')
 or exists(select 1 from public.builder_free_memberships where customer_id=auth.uid());
$$;
create or replace function public.get_builder_site_plan(p_site uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare ownerid uuid; paid boolean; used bigint;
begin
 if auth.uid() is null then raise exception 'store_access_denied';end if;
 select owner_id into ownerid from public.builder_sites where id=p_site and deleted_at is null and (owner_id=auth.uid() or public.is_admin());
 if not found then raise exception 'store_access_denied';end if;
 paid=exists(select 1 from public.customer_subscriptions a join public.store_products b on b.id=a.product_id where a.customer_id=ownerid and a.starts_at<=now() and a.expires_at>now() and b.service_code='site_builder')
 or exists(select 1 from public.profiles where id=ownerid and role='admin');
 select count(*) into used from public.builder_products where site_id=p_site and status<>'archived';
 return jsonb_build_object('paid',paid,'limit',case when paid then null else 10 end,'used',used);
end $$;
revoke all on function public.get_builder_site_plan(uuid) from public,anon;
grant execute on function public.get_builder_site_plan(uuid) to authenticated;

create or replace function private.enforce_builder_product_quota() returns trigger language plpgsql volatile security invoker set search_path='' as $$
declare ownerid uuid; paid boolean; used bigint;
begin
 if new.status='archived' then return new;end if;
 if tg_op='UPDATE' and old.status<>'archived' then return new;end if;
 -- Serialize all additions and activations, including direct table writes and CSV RPC calls.
 select owner_id into ownerid from public.builder_sites where id=new.site_id and deleted_at is null and (owner_id=auth.uid() or public.is_admin()) for update;
 if not found then raise exception 'store_access_denied';end if;
 paid=exists(select 1 from public.customer_subscriptions a join public.store_products b on b.id=a.product_id where a.customer_id=ownerid and a.starts_at<=now() and a.expires_at>now() and b.service_code='site_builder')
 or exists(select 1 from public.profiles where id=ownerid and role='admin');
 if not paid then
  -- A separate volatile statement after the lock sees earlier competing commits.
  select count(*) into used from public.builder_products where site_id=new.site_id and status<>'archived';
  if used>=10 then raise exception 'builder_free_product_limit';end if;
 end if;
 return new;
end $$;
revoke all on function private.enforce_builder_product_quota() from public,anon,authenticated;
drop trigger if exists builder_product_quota on public.builder_products;
create trigger builder_product_quota before insert or update of status on public.builder_products for each row execute function private.enforce_builder_product_quota();

CREATE OR REPLACE FUNCTION private.builder_checkout(p_slug text, p_key uuid, p_customer jsonb, p_items jsonb, p_coupon text, p_method text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare sid uuid; ownerid uuid; settings public.builder_shop_settings; c public.builder_coupons; v record; line record;
 oid uuid; existing public.builder_orders; subtotal bigint=0; discount bigint=0; tax bigint=0; shipping bigint=0; xphone text; item_count integer; response jsonb;
begin
 if p_key is null then raise exception 'invalid_request';end if;
 -- Same browser request key returns the same receipt, without disclosing names or addresses.
 perform pg_advisory_xact_lock(hashtextextended(p_key::text,0));
 select b.site_id,s.owner_id into sid,ownerid from public.builder_publications b join public.builder_sites s on s.id=b.site_id where b.slug=p_slug and b.is_live and s.deleted_at is null;
 if sid is null then raise exception 'store_unavailable';end if;
 select * into existing from public.builder_orders where checkout_key=p_key;
 if found then
 if existing.site_id<>sid then raise exception 'invalid_request';end if;
 return jsonb_build_object('number',existing.number,'token',existing.checkout_key,'total',existing.total,'subtotal',existing.subtotal,'discount',existing.discount,'tax',existing.tax,'shipping',existing.shipping);
 end if;
 if not exists(select 1 from public.customer_subscriptions a join public.store_products b on b.id=a.product_id where a.customer_id=ownerid and a.starts_at<=now() and a.expires_at>now() and b.service_code='site_builder') and not exists(select 1 from public.profiles where id=ownerid and role='admin') and not (exists(select 1 from public.builder_free_memberships where customer_id=ownerid) and (select count(*) from public.builder_products where site_id=sid and status<>'archived')<=10) then raise exception 'store_unavailable';end if;
 select * into settings from public.builder_shop_settings where site_id=sid;
 if not found or not settings.accepting_orders or (p_method='cod' and not settings.allow_cod) or (p_method='bank' and (not settings.allow_bank or length(trim(settings.bank_instructions))=0)) or p_method not in ('cod','bank') or p_method is null then raise exception 'checkout_disabled';end if;
 xphone=translate(trim(p_customer->>'phone'),'۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩','01234567890123456789');
 if xphone is null or xphone !~ '^09[0-9]{9}$' then raise exception 'invalid_phone';end if;
 if cardinality(settings.shipping_regions)>0 and not((p_customer->>'province')=any(settings.shipping_regions)) then raise exception 'shipping_unavailable';end if;
 perform pg_advisory_xact_lock(hashtextextended(sid::text||xphone,0));
 if (select count(*) from public.builder_orders o where o.site_id=sid and o.phone=xphone and o.created_at>now()-interval '30 seconds')>0 then raise exception 'try_later';end if;
 if (select count(*) from public.builder_orders where site_id=sid and created_at>now()-interval '1 minute')>=60 then raise exception 'try_later';end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 50 then raise exception 'invalid_cart';end if;
 if exists(select 1 from jsonb_array_elements(p_items) x where jsonb_typeof(x)<>'object' or coalesce(x->>'quantity','')!~ '^[0-9]{1,2}$' or coalesce(x->>'variant_id','')!~ '^[0-9a-f-]{36}$') then raise exception 'invalid_cart';end if;
 select count(distinct x->>'variant_id') into item_count from jsonb_array_elements(p_items) x;
 if item_count<>jsonb_array_length(p_items) then raise exception 'invalid_cart';end if;
 perform 1 from public.builder_products b where b.site_id=sid and b.id in (select a.product_id from public.builder_variants a where a.id in (select (x->>'variant_id')::uuid from jsonb_array_elements(p_items) x)) order by b.id for update;
 -- Deterministic row locks prevent overselling and competing checkout deadlocks.
 for line in select (x->>'variant_id')::uuid id,(x->>'quantity')::integer qty from jsonb_array_elements(p_items) x order by (x->>'variant_id')::uuid loop
 if line.qty not between 1 and 99 then raise exception 'invalid_cart';end if;
 select a.*,b.title,b.status into v from public.builder_variants a join public.builder_products b on b.id=a.product_id and b.site_id=a.site_id where a.id=line.id and a.site_id=sid for update of a,b;
 if not found or not v.enabled or v.status<>'published' then raise exception 'product_unavailable';end if;
 if v.manage_stock and v.stock<line.qty then raise exception 'stock_unavailable';end if;
 subtotal=subtotal+coalesce(v.sale_price,v.price)*line.qty;
 end loop;
 if nullif(trim(p_coupon),'') is not null then
 select * into c from public.builder_coupons where site_id=sid and code=upper(trim(p_coupon)) for update;
 if not found or not c.enabled or (c.expires_at is not null and c.expires_at<=now()) or (c.usage_limit is not null and c.used_count>=c.usage_limit) or subtotal<c.min_subtotal then raise exception 'coupon_invalid';end if;
 discount=least(subtotal,case when c.kind='percent' then floor(subtotal::numeric*c.amount/100)::bigint else c.amount end);
 end if;
 tax=round((subtotal-discount)::numeric*settings.tax_percent/100)::bigint;
 shipping=case when settings.free_shipping_threshold is not null and subtotal-discount>=settings.free_shipping_threshold then 0 else settings.shipping_fee end;
 insert into public.builder_orders(site_id,checkout_key,full_name,phone,province,city,address,postal_code,customer_note,subtotal,discount,tax,shipping,total,coupon_id,payment_method)
 values(sid,p_key,trim(p_customer->>'full_name'),xphone,trim(p_customer->>'province'),trim(p_customer->>'city'),trim(p_customer->>'address'),translate(trim(p_customer->>'postal_code'),'۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩','01234567890123456789'),coalesce(p_customer->>'note',''),subtotal,discount,tax,shipping,subtotal-discount+tax+shipping,c.id,p_method) returning id into oid;
 for line in select (x->>'variant_id')::uuid id,(x->>'quantity')::integer qty from jsonb_array_elements(p_items) x loop
 select a.*,b.title into v from public.builder_variants a join public.builder_products b on b.id=a.product_id where a.id=line.id;
 insert into public.builder_order_items(order_id,site_id,variant_id,title,sku,quantity,unit_price,stock_managed) values(oid,sid,v.id,v.title||case when v.label='پیش‌فرض' then '' else ' — '||v.label end,v.sku,line.qty,coalesce(v.sale_price,v.price),v.manage_stock);
 if v.manage_stock then update public.builder_variants set stock=stock-line.qty where id=v.id;end if;
 end loop;
 if c.id is not null then update public.builder_coupons set used_count=used_count+1 where id=c.id;end if;
 insert into public.builder_customers(site_id,full_name,phone,tags,status) select sid,trim(p_customer->>'full_name'),xphone,'خریدار فروشگاه','new' where not exists(select 1 from public.builder_customers bc where bc.site_id=sid and bc.phone=xphone);
 insert into public.builder_events(site_id,kind,entity_id,payload) values(sid,'order.created',oid,jsonb_build_object('total',subtotal-discount+tax+shipping,'payment_method',p_method));
 select jsonb_build_object('number',builder_orders.number,'token',builder_orders.checkout_key,'total',builder_orders.total,'subtotal',builder_orders.subtotal,'discount',builder_orders.discount,'tax',builder_orders.tax,'shipping',builder_orders.shipping) into response from public.builder_orders where id=oid;
 return response;
end $function$
;

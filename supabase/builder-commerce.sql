-- DELSA commerce: each store owns its catalog, settings, coupons and orders.
create table public.builder_products (
 id uuid primary key default gen_random_uuid(), site_id uuid not null references public.builder_sites(id),
 title text not null check(length(title) between 2 and 180), slug text not null check(slug ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
 kind text not null default 'simple' check(kind in ('simple','variable')), status text not null default 'draft' check(status in ('draft','published','archived')),
 description text not null default '' check(length(description)<=12000), summary text not null default '' check(length(summary)<=500),
 category text not null default '' check(length(category)<=120),brand text not null default '' check(length(brand)<=120),
 images text[] not null default '{}' check(cardinality(images)<=12), tags text[] not null default '{}' check(cardinality(tags)<=20),
 attributes jsonb not null default '{}' check(jsonb_typeof(attributes)='object' and octet_length(attributes::text)<=5000),
 featured boolean not null default false, weight_grams integer not null default 0 check(weight_grams between 0 and 10000000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(site_id,slug), unique(id,site_id)
);
create index builder_products_site_idx on public.builder_products(site_id,status,created_at desc);
create table public.builder_variants (
 id uuid primary key default gen_random_uuid(), site_id uuid not null, product_id uuid not null,
 foreign key(product_id,site_id) references public.builder_products(id,site_id),
 label text not null check(length(label) between 1 and 180), sku text not null check(length(sku) between 1 and 80),
 price bigint not null check(price between 0 and 1000000000000), sale_price bigint check(sale_price>=0 and sale_price<=price),
 stock integer not null default 0 check(stock between 0 and 100000000), manage_stock boolean not null default true,
 enabled boolean not null default true, attributes jsonb not null default '{}' check(jsonb_typeof(attributes)='object' and octet_length(attributes::text)<=3000),
 unique(site_id,sku),unique(id,site_id)
);
create index builder_variants_product_idx on public.builder_variants(product_id);
create table public.builder_shop_settings (
 site_id uuid primary key references public.builder_sites(id), accepting_orders boolean not null default false,
 shipping_fee bigint not null default 0 check(shipping_fee between 0 and 1000000000),
 free_shipping_threshold bigint check(free_shipping_threshold between 0 and 1000000000000),
 tax_percent numeric(5,2) not null default 0 check(tax_percent between 0 and 100),
 allow_cod boolean not null default true, allow_bank boolean not null default false,
 bank_instructions text not null default '' check(length(bank_instructions)<=2000),
 contact_phone text not null default '' check(length(contact_phone)<=24),
 shipping_regions text[] not null default '{}' check(cardinality(shipping_regions)<=40),
 policies text not null default '' check(length(policies)<=6000),updated_at timestamptz not null default now()
);
create table public.builder_coupons (
 id uuid primary key default gen_random_uuid(),site_id uuid not null references public.builder_sites(id),
 code text not null check(code ~ '^[A-Z0-9_-]{2,40}$'),kind text not null check(kind in ('percent','fixed')),
 amount bigint not null check(amount>0 and amount<=1000000000000 and (kind<>'percent' or amount<=100)),
 min_subtotal bigint not null default 0 check(min_subtotal>=0),usage_limit integer check(usage_limit>0),
 used_count integer not null default 0 check(used_count>=0),expires_at timestamptz,enabled boolean not null default true,unique(site_id,code)
);
create table public.builder_orders (
 id uuid primary key default gen_random_uuid(), number bigint generated always as identity unique,
 site_id uuid not null references public.builder_sites(id), checkout_key uuid not null unique,
 full_name text not null check(length(full_name) between 2 and 120),phone text not null check(phone ~ '^09[0-9]{9}$'),
 province text not null check(length(province) between 2 and 100),city text not null check(length(city) between 2 and 100),
 address text not null check(length(address) between 8 and 1000),postal_code text not null check(postal_code ~ '^[0-9]{10}$'),
 customer_note text not null default '' check(length(customer_note)<=2000),internal_note text not null default '' check(length(internal_note)<=4000),
 subtotal bigint not null,discount bigint not null,tax bigint not null,shipping bigint not null,total bigint not null,
 coupon_id uuid references public.builder_coupons(id),payment_method text not null check(payment_method in ('cod','bank')),
 payment_status text not null default 'unpaid' check(payment_status in ('unpaid','paid','refunded')),
 status text not null default 'pending' check(status in ('pending','processing','shipped','completed','cancelled','refunded')),
 tracking_code text not null default '' check(length(tracking_code)<=200),stock_returned boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,site_id)
);
create index builder_orders_site_idx on public.builder_orders(site_id,created_at desc);
create index builder_orders_phone_idx on public.builder_orders(site_id,phone,created_at desc);
create table public.builder_order_items (
 id uuid primary key default gen_random_uuid(),order_id uuid not null,site_id uuid not null,
 foreign key(order_id,site_id) references public.builder_orders(id,site_id),
 variant_id uuid not null,foreign key(variant_id,site_id) references public.builder_variants(id,site_id),
 title text not null,sku text not null,quantity integer not null check(quantity between 1 and 99),unit_price bigint not null,
 stock_managed boolean not null,unique(order_id,variant_id)
);
create index builder_order_items_order_idx on public.builder_order_items(order_id);
create index builder_order_items_variant_idx on public.builder_order_items(variant_id);
create table public.builder_events (
 id bigint generated always as identity primary key,site_id uuid not null references public.builder_sites(id),
 kind text not null,entity_id uuid not null,payload jsonb not null default '{}',actor_id uuid,created_at timestamptz not null default now()
);
create index builder_events_site_idx on public.builder_events(site_id,id desc);
-- Private data: no public grants. Every policy explicitly checks the parent owner.
do $$ declare t text;begin
 foreach t in array array['builder_products','builder_variants','builder_shop_settings','builder_coupons','builder_orders','builder_order_items','builder_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy %I on public.%I for select to authenticated using(exists(select 1 from public.builder_sites s where s.id=site_id and (s.owner_id=(select auth.uid()) or (select public.is_admin()))))',t||'_owner_read',t);
 end loop;
 foreach t in array array['builder_products','builder_variants','builder_shop_settings','builder_coupons'] loop
 execute format('grant insert on public.%I to authenticated',t);
 execute format('create policy %I on public.%I for insert to authenticated with check((select public.has_site_builder_access()) and exists(select 1 from public.builder_sites s where s.id=site_id and (s.owner_id=(select auth.uid()) or (select public.is_admin()))))',t||'_owner_insert',t);
 execute format('create policy %I on public.%I for update to authenticated using((select public.has_site_builder_access()) and exists(select 1 from public.builder_sites s where s.id=site_id and (s.owner_id=(select auth.uid()) or (select public.is_admin())))) with check((select public.has_site_builder_access()) and exists(select 1 from public.builder_sites s where s.id=site_id and (s.owner_id=(select auth.uid()) or (select public.is_admin()))))',t||'_owner_update',t);
 end loop;
end $$;
grant update(title,slug,kind,status,description,summary,category,brand,images,tags,attributes,featured,weight_grams,updated_at) on public.builder_products to authenticated;
grant update(label,sku,price,sale_price,stock,manage_stock,enabled,attributes) on public.builder_variants to authenticated;
grant update(accepting_orders,shipping_fee,free_shipping_threshold,tax_percent,allow_cod,allow_bank,bank_instructions,contact_phone,shipping_regions,policies,updated_at) on public.builder_shop_settings to authenticated;
grant update(code,kind,amount,min_subtotal,usage_limit,expires_at,enabled) on public.builder_coupons to authenticated;
-- Anonymous visitors can read only the catalog of a live site, never customer/order data.
grant select on public.builder_products,public.builder_variants,public.builder_shop_settings to anon;
create policy builder_products_public on public.builder_products for select to anon,authenticated using(status='published' and exists(select 1 from public.builder_publications p where p.site_id=builder_products.site_id and p.is_live));
create policy builder_variants_public on public.builder_variants for select to anon,authenticated using(enabled and exists(select 1 from public.builder_products p where p.id=product_id and p.site_id=builder_variants.site_id and p.status='published' and exists(select 1 from public.builder_publications b where b.site_id=p.site_id and b.is_live)));
create policy builder_settings_public on public.builder_shop_settings for select to anon,authenticated using(exists(select 1 from public.builder_publications p where p.site_id=builder_shop_settings.site_id and p.is_live));
-- Save a product and its variations atomically; existing order references are preserved.
create function public.save_builder_product(p_site uuid,p_product uuid,p_document jsonb,p_variants jsonb,p_expected timestamptz default null) returns uuid language plpgsql security invoker set search_path='' as $$
declare pid uuid; v jsonb; vid uuid; keep uuid[]='{}'; old public.builder_products; current_stock integer;
begin
 if not public.has_site_builder_access() or not exists(select 1 from public.builder_sites where id=p_site and (owner_id=auth.uid() or public.is_admin())) then raise exception 'store_access_denied';end if;
 if jsonb_typeof(p_variants)<>'array' or jsonb_array_length(p_variants) not between 1 and 100 then raise exception 'invalid_variants';end if;
 if p_document->>'kind'='simple' and jsonb_array_length(p_variants)<>1 then raise exception 'simple_requires_one_variant';end if;
 if p_product is not null then
 select * into old from public.builder_products where id=p_product and site_id=p_site for update;
 if not found or old.updated_at is distinct from p_expected then raise exception 'product_changed';end if;pid=p_product;
 update public.builder_products set title=p_document->>'title',slug=p_document->>'slug',kind=p_document->>'kind',status=p_document->>'status',description=coalesce(p_document->>'description',''),summary=coalesce(p_document->>'summary',''),category=coalesce(p_document->>'category',''),brand=coalesce(p_document->>'brand',''),images=array(select jsonb_array_elements_text(coalesce(p_document->'images','[]'))),tags=array(select jsonb_array_elements_text(coalesce(p_document->'tags','[]'))),attributes=coalesce(p_document->'attributes','{}'),featured=coalesce((p_document->>'featured')::boolean,false),weight_grams=coalesce((p_document->>'weight_grams')::integer,0),updated_at=clock_timestamp() where id=pid;
 else
 insert into public.builder_products(site_id,title,slug,kind,status,description,summary,category,brand,images,tags,attributes,featured,weight_grams) values(p_site,p_document->>'title',p_document->>'slug',p_document->>'kind',p_document->>'status',coalesce(p_document->>'description',''),coalesce(p_document->>'summary',''),coalesce(p_document->>'category',''),coalesce(p_document->>'brand',''),array(select jsonb_array_elements_text(coalesce(p_document->'images','[]'))),array(select jsonb_array_elements_text(coalesce(p_document->'tags','[]'))),coalesce(p_document->'attributes','{}'),coalesce((p_document->>'featured')::boolean,false),coalesce((p_document->>'weight_grams')::integer,0)) returning id into pid;
 end if;
 for v in select value from jsonb_array_elements(p_variants) loop
 vid=coalesce(nullif(v->>'id','')::uuid,gen_random_uuid());
 select stock into current_stock from public.builder_variants where id=vid and product_id=pid for update;
 if found and (v->>'expected_stock') is not null and current_stock<>(v->>'expected_stock')::integer then raise exception 'stock_changed';end if;
 if vid=any(keep) then raise exception 'invalid_variants';end if;
 if exists(select 1 from public.builder_variants where id=vid and (site_id<>p_site or product_id<>pid)) then raise exception 'variant_access_denied';end if;
 insert into public.builder_variants(id,site_id,product_id,label,sku,price,sale_price,stock,manage_stock,attributes,enabled) values(vid,p_site,pid,v->>'label',v->>'sku',(v->>'price')::bigint,nullif(v->>'sale_price','')::bigint,(v->>'stock')::integer,(v->>'manage_stock')::boolean,coalesce(v->'attributes','{}'),true)
 on conflict(id) do update set label=excluded.label,sku=excluded.sku,price=excluded.price,sale_price=excluded.sale_price,stock=excluded.stock,manage_stock=excluded.manage_stock,attributes=excluded.attributes,enabled=true;
 keep=array_append(keep,vid);
 end loop;
 update public.builder_variants set enabled=false where product_id=pid and site_id=p_site and not(id=any(keep));
 return pid;
end $$;
revoke all on function public.save_builder_product(uuid,uuid,jsonb,jsonb,timestamptz) from public,anon;
grant execute on function public.save_builder_product(uuid,uuid,jsonb,jsonb,timestamptz) to authenticated;
-- Definer code is necessary ONLY for guest checkout and immutable order transitions.
-- It lives in a non-exposed schema, uses explicit store/entitlement checks and no dynamic SQL.
-- Clients have no INSERT/UPDATE grants on orders or their prices. All amounts come from the database.
create function private.builder_checkout(p_slug text,p_key uuid,p_customer jsonb,p_items jsonb,p_coupon text,p_method text) returns jsonb language plpgsql security definer set search_path='' as $$
declare sid uuid; ownerid uuid; settings public.builder_shop_settings; c public.builder_coupons; v record; line record;
 oid uuid; existing public.builder_orders; subtotal bigint=0; discount bigint=0; tax bigint=0; shipping bigint=0; xphone text; item_count integer; response jsonb;
begin
 if p_key is null then raise exception 'invalid_request';end if;
 -- Same browser request key returns the same receipt, without disclosing names or addresses.
 perform pg_advisory_xact_lock(hashtextextended(p_key::text,0));
 select b.site_id,s.owner_id into sid,ownerid from public.builder_publications b join public.builder_sites s on s.id=b.site_id where b.slug=p_slug and b.is_live;
 if sid is null then raise exception 'store_unavailable';end if;
 select * into existing from public.builder_orders where checkout_key=p_key;
 if found then
 if existing.site_id<>sid then raise exception 'invalid_request';end if;
 return jsonb_build_object('number',existing.number,'token',existing.checkout_key,'total',existing.total,'subtotal',existing.subtotal,'discount',existing.discount,'tax',existing.tax,'shipping',existing.shipping);
 end if;
 if not exists(select 1 from public.customer_subscriptions a join public.store_products b on b.id=a.product_id where a.customer_id=ownerid and a.starts_at<=now() and a.expires_at>now() and b.service_code='site_builder') and not exists(select 1 from public.profiles where id=ownerid and role='admin') then raise exception 'store_unavailable';end if;
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
end $$;
revoke all on function private.builder_checkout(text,uuid,jsonb,jsonb,text,text) from public;
grant usage on schema private to anon,authenticated;
grant execute on function private.builder_checkout(text,uuid,jsonb,jsonb,text,text) to anon,authenticated;
create function public.checkout_builder_store(p_slug text,p_key uuid,p_customer jsonb,p_items jsonb,p_coupon text default '',p_method text default 'cod') returns jsonb language sql security invoker set search_path='' as $$ select private.builder_checkout(p_slug,p_key,p_customer,p_items,p_coupon,p_method) $$;
revoke all on function public.checkout_builder_store(text,uuid,jsonb,jsonb,text,text) from public;
grant execute on function public.checkout_builder_store(text,uuid,jsonb,jsonb,text,text) to anon,authenticated;
create function private.builder_receipt(p_slug text,p_token uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('number',o.number,'status',o.status,'payment_status',o.payment_status,'payment_method',o.payment_method,'total',o.total,'subtotal',o.subtotal,'discount',o.discount,'tax',o.tax,'shipping',o.shipping,'tracking_code',o.tracking_code,'created_at',o.created_at,'items',(select jsonb_agg(jsonb_build_object('title',i.title,'quantity',i.quantity,'unit_price',i.unit_price)) from public.builder_order_items i where i.order_id=o.id)) from public.builder_orders o join public.builder_publications p on p.site_id=o.site_id where p.slug=p_slug and o.checkout_key=p_token
$$;
revoke all on function private.builder_receipt(text,uuid) from public;
grant execute on function private.builder_receipt(text,uuid) to anon,authenticated;
create function public.get_builder_receipt(p_slug text,p_token uuid) returns jsonb language sql stable security invoker set search_path='' as $$ select private.builder_receipt(p_slug,p_token) $$;
revoke all on function public.get_builder_receipt(text,uuid) from public;
grant execute on function public.get_builder_receipt(text,uuid) to anon,authenticated;
create function private.builder_order_transition(p_order uuid,p_status text,p_payment text,p_note text,p_tracking text) returns void language plpgsql security definer set search_path='' as $$
declare o public.builder_orders;i record;
begin
 if auth.uid() is null then raise exception 'store_access_denied';end if;
 select * into o from public.builder_orders where id=p_order and exists(select 1 from public.builder_sites s where s.id=site_id and (s.owner_id=auth.uid() or public.is_admin())) for update;
 if not found or not public.has_site_builder_access() then raise exception 'store_access_denied';end if;
 if p_status not in ('pending','processing','shipped','completed','cancelled','refunded') or p_payment not in ('unpaid','paid','refunded') then raise exception 'invalid_transition';end if;
 if o.status in ('cancelled','refunded') and p_status<>o.status then raise exception 'terminal_order';end if;
 if p_status<>o.status and not ((o.status='pending' and p_status in ('processing','cancelled')) or (o.status='processing' and p_status in ('shipped','completed','cancelled','refunded')) or (o.status='shipped' and p_status in ('completed','refunded')) or (o.status='completed' and p_status='refunded')) then raise exception 'invalid_transition';end if;
 if (p_status='refunded' and p_payment<>'refunded') or (p_payment='refunded' and p_status<>'refunded') or (p_status='cancelled' and p_payment<>'unpaid') or (p_status='completed' and p_payment<>'paid') then raise exception 'invalid_payment_state';end if;
 if p_status in ('cancelled','refunded') and not o.stock_returned then
 for i in select * from public.builder_order_items where order_id=o.id order by variant_id loop
 if i.stock_managed then update public.builder_variants set stock=stock+i.quantity where id=i.variant_id and site_id=o.site_id;end if;
 end loop;
 if o.coupon_id is not null then update public.builder_coupons set used_count=greatest(0,used_count-1) where id=o.coupon_id;end if;
 end if;
 update public.builder_orders set status=p_status,payment_status=p_payment,internal_note=coalesce(p_note,''),tracking_code=coalesce(p_tracking,''),stock_returned=o.stock_returned or p_status in ('cancelled','refunded'),updated_at=clock_timestamp() where id=o.id;
 insert into public.builder_events(site_id,kind,entity_id,payload,actor_id) values(o.site_id,'order.updated',o.id,jsonb_build_object('from',o.status,'to',p_status,'payment',p_payment),auth.uid());
end $$;
revoke all on function private.builder_order_transition(uuid,text,text,text,text) from public,anon;
grant execute on function private.builder_order_transition(uuid,text,text,text,text) to authenticated;
create function public.update_builder_order(p_order uuid,p_status text,p_payment text,p_note text default '',p_tracking text default '') returns void language sql security invoker set search_path='' as $$ select private.builder_order_transition(p_order,p_status,p_payment,p_note,p_tracking) $$;
revoke all on function public.update_builder_order(uuid,text,text,text,text) from public,anon;
grant execute on function public.update_builder_order(uuid,text,text,text,text) to authenticated;
-- Audit records are generated internally; clients cannot fabricate or edit them.
create function private.builder_catalog_audit() returns trigger language plpgsql security definer set search_path='' as $$ begin
 insert into public.builder_events(site_id,kind,entity_id,payload,actor_id) values(new.site_id,case when tg_table_name='builder_products' then 'product.saved' else 'variant.updated' end,new.id,case when tg_table_name='builder_variants' then jsonb_build_object('sku',to_jsonb(new)->'sku','price',to_jsonb(new)->'price','sale_price',to_jsonb(new)->'sale_price','stock',to_jsonb(new)->'stock') else jsonb_build_object('title',to_jsonb(new)->'title','status',to_jsonb(new)->'status') end,auth.uid());return new;
end $$;
revoke all on function private.builder_catalog_audit() from public,anon,authenticated;
create trigger builder_product_audit after insert or update on public.builder_products for each row execute function private.builder_catalog_audit();
create trigger builder_variant_audit after insert or update on public.builder_variants for each row execute function private.builder_catalog_audit();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('builder-product-images','builder-product-images',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy builder_image_upload on storage.objects for insert to authenticated with check(bucket_id='builder-product-images' and (select public.has_site_builder_access()) and exists(select 1 from public.builder_sites s where s.id::text=(storage.foldername(objects.name))[1] and (s.owner_id=(select auth.uid()) or (select public.is_admin()))));
create policy builder_image_delete on storage.objects for delete to authenticated using(bucket_id='builder-product-images' and (select public.has_site_builder_access()) and exists(select 1 from public.builder_sites s where s.id::text=(storage.foldername(objects.name))[1] and (s.owner_id=(select auth.uid()) or (select public.is_admin()))));
create policy builder_image_owner_read on storage.objects for select to authenticated using(bucket_id='builder-product-images' and exists(select 1 from public.builder_sites s where s.id::text=(storage.foldername(objects.name))[1] and (s.owner_id=(select auth.uid()) or (select public.is_admin()))));

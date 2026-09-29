create policy "customers read own store" on public.customer_stores
for select to authenticated
using (customer_id = (select auth.uid()));

create policy "customers read own subscriptions" on public.customer_subscriptions
for select to authenticated
using (customer_id = (select auth.uid()));

create policy "customers read subscribed products" on public.store_products
for select to authenticated
using (exists (
  select 1 from public.customer_subscriptions cs
  where cs.product_id = store_products.id and cs.customer_id = (select auth.uid())
));

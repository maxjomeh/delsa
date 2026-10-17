-- Applied 2026-10-12. Keep CRM unpublished while product capabilities are designed.
begin;
alter table public.store_products drop constraint if exists store_products_service_code_check;
alter table public.store_products add constraint store_products_service_code_check check(service_code is null or service_code in ('apu','site_builder','crm'));
insert into public.store_products(name,description,price,is_published,service_code)
select 'سیما — CRM هوشمند دلسا','مدیریت ارتباط با مشتری با هستهٔ مشترک و قابلیت‌های قابل تنظیم برای هر صنف. محصول در مرحلهٔ طراحی و آماده‌سازی است.',null,false,'crm'
where not exists(select 1 from public.store_products where service_code='crm');
commit;

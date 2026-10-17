-- Keep the existing service identity so previously assigned subscriptions stay valid.
-- Price is managed by the admin and is not changed by this seed.
insert into public.store_products(id,name,description,is_published,service_code)
values('38ba2004-0021-4717-b06f-dc21493b83b5','سایت ساز','ساخت سایت و فروشگاه مستقیم در پنل مشتری با سه قالب متفاوت؛ طراحی صفحات، محصولات ساده و متغیر، موجودی، سفارش‌ها، تخفیف، ارسال و دفتر مشتریان. با ثبت اشتراک توسط مدیر در حساب مشتری، ساخت سایت خودکار فعال می‌شود و نیازی به پیام به پشتیبانی نیست. پرداخت فروشگاه دستی یا هنگام تحویل؛ درگاه آنلاین، دامنه اختصاصی و اجرای اتوماسیون‌ها هنوز فعال نیست.',true,'site_builder')
on conflict(id) do update set name=excluded.name,description=excluded.description,is_published=excluded.is_published;

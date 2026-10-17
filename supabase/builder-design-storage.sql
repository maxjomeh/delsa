-- Resolve the uploaded object path explicitly, avoiding builder_sites.name shadowing.
alter policy builder_image_upload on storage.objects with check(
 bucket_id='builder-product-images' and (select public.has_site_builder_access())
 and exists(select 1 from public.builder_sites s where s.id::text=(storage.foldername(objects.name))[1] and (s.owner_id=(select auth.uid()) or (select public.is_admin()))));
alter policy builder_image_delete on storage.objects using(
 bucket_id='builder-product-images' and (select public.has_site_builder_access())
 and exists(select 1 from public.builder_sites s where s.id::text=(storage.foldername(objects.name))[1] and (s.owner_id=(select auth.uid()) or (select public.is_admin()))));
alter policy builder_image_owner_read on storage.objects using(
 bucket_id='builder-product-images'
 and exists(select 1 from public.builder_sites s where s.id::text=(storage.foldername(objects.name))[1] and (s.owner_id=(select auth.uid()) or (select public.is_admin()))));


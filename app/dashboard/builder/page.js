import {redirect} from 'next/navigation';
import {createClient} from '../../../lib/supabase/server';
import SiteBuilder from '../../../components/SiteBuilder';
export const dynamic='force-dynamic';
export const metadata={title:'سایت‌ساز و فروشگاه‌ساز | پنل مشتری دلسا'};
export default async function CustomerBuilder(){const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login?next=/dashboard/builder');const [sites,access]=await Promise.all([db.from('builder_sites').select('*').order('created_at',{ascending:false}).limit(100),db.rpc('has_site_builder_access')]);return <SiteBuilder userId={user.id} initialSites={sites.data||[]} access={Boolean(access.data)} initialError={sites.error||access.error?'اطلاعات سایت‌ها کامل بارگذاری نشد. صفحه را تازه‌سازی کنید.':''}/>}

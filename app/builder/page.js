import {createClient} from '../../lib/supabase/server';
import SiteBuilder from '../../components/SiteBuilder';
export const dynamic='force-dynamic';
export const metadata={title:'سایت‌ساز دلسا | ساخت سایت و مدیریت مشتریان'};
export default async function BuilderPage(){const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return <SiteBuilder userId={null} initialSites={[]} access={false}/>;const [sites,access]=await Promise.all([db.from('builder_sites').select('*').order('created_at',{ascending:false}).limit(100),db.rpc('has_site_builder_access')]);return <SiteBuilder userId={user.id} initialSites={sites.data||[]} access={Boolean(access.data)} initialError={sites.error?'بارگذاری سایت‌ها انجام نشد. صفحه را تازه‌سازی کنید.':''}/>}

import {redirect} from 'next/navigation';
import {createClient} from '../../../lib/supabase/server';
import SiteBuilder from '../../../components/SiteBuilder';
import {getI18n} from '../../../lib/i18n/server';
export const dynamic='force-dynamic';
export const metadata={title:'سایت‌ساز و فروشگاه‌ساز دلسا'};
export default async function BuilderPage(){const {href}=await getI18n();const db=await createClient();const {data:{user}}=await db.auth.getUser();if(user)redirect(href('/dashboard/builder'));return <SiteBuilder userId={null} initialSites={[]} access={false}/>}

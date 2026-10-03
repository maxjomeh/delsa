import {redirect} from 'next/navigation';
import {createClient} from '../../lib/supabase/server';
import SiteBuilder from '../../components/SiteBuilder';
export const dynamic='force-dynamic';
export const metadata={title:'سایت‌ساز و فروشگاه‌ساز دلسا'};
export default async function BuilderPage(){const db=await createClient();const {data:{user}}=await db.auth.getUser();if(user)redirect('/dashboard/builder');return <SiteBuilder userId={null} initialSites={[]} access={false}/>}

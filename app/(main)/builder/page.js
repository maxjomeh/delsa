import {redirect} from 'next/navigation';
import {createClient} from '../../../lib/supabase/server';
import BuilderLanding from '../../../components/home/BuilderLanding';
export const dynamic='force-dynamic';
export const metadata={title:'سایت‌ساز و فروشگاه‌ساز دلسا',description:'سایت و فروشگاه آنلاین خودت را با قالب‌های آماده، ویرایشگر بصری و پنل مدیریت بساز و منتشر کن. رایگان شروع کن.'};
export default async function BuilderPage(){const db=await createClient();const {data:{user}}=await db.auth.getUser();if(user)redirect('/dashboard/builder');return <BuilderLanding/>}

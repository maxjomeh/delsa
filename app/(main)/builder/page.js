import {redirect} from 'next/navigation';
import {createClient} from '../../../lib/supabase/server';
import BuilderLanding from '../../../components/home/BuilderLanding';
import {getI18n,loadMessages} from '../../../lib/i18n/server';
export const dynamic='force-dynamic';
export async function generateMetadata(){const {t}=await getI18n();return {title:t('سایت‌ساز و فروشگاه‌ساز دلسا'),description:t('سایت و فروشگاه آنلاین خودت را با قالب‌های آماده، ویرایشگر بصری و پنل مدیریت بساز و منتشر کن. رایگان شروع کن.')}}
export default async function BuilderPage(){const {locale,href}=await getI18n();const db=await createClient();const {data:{user}}=await db.auth.getUser();if(user)redirect(href('/dashboard/builder'));
// Template, industry and starter copy are translated with the "site" dictionary.
const siteMessages=await loadMessages(locale,'site');return <BuilderLanding siteMessages={siteMessages}/>}

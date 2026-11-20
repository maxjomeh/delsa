import {redirect} from 'next/navigation';
import {getI18n} from '../../../../lib/i18n/server';
export default async function CustomerBuilder(){const {href}=await getI18n();redirect(href('/dashboard?tab=builder'))}

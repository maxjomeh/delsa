import '../../home.css';
import '../../pages.css';
import AnimationStory from '../../../components/AnimationStory';
import {getI18n} from '../../../lib/i18n/server';
import HomeHeader from '../../../components/home/HomeHeader';
import SiteFooter from '../../../components/home/SiteFooter';
export async function generateMetadata(){const {t}=await getI18n();return {title:t('روایت متحرک APU | دلسا'),description:t('روایت کلاژ و اینفوگرافیک اِی پی یو؛ ۹ سکانس از فاکتور خرید تا به‌روزرسانی قیمت.')}}
export default function AnimationsPage(){return <div className="hx"><HomeHeader home={false}/><div className="hx-story"><AnimationStory/></div><SiteFooter/></div>}

import '../home.css';
import '../pages.css';
import AnimationStory from '../../components/AnimationStory';
import HomeHeader from '../../components/home/HomeHeader';
import SiteFooter from '../../components/home/SiteFooter';
export const metadata={title:'روایت متحرک APU | دلسا',description:'روایت کلاژ و اینفوگرافیک اِی پی یو؛ ۹ سکانس از فاکتور خرید تا به‌روزرسانی قیمت.'};
export default function AnimationsPage(){return <div className="hx"><HomeHeader home={false}/><div className="hx-story"><AnimationStory/></div><SiteFooter/></div>}

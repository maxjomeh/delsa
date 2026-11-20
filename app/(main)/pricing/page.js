import '../../home.css';
import '../../pages.css';
import Link from '../../../components/i18n/Link';
import {getI18n} from '../../../lib/i18n/server';
import {ArrowUpLeft, Check, Clock3, RefreshCw, ShieldCheck} from 'lucide-react';
import HomeHeader from '../../../components/home/HomeHeader';
import SiteFooter from '../../../components/home/SiteFooter';
export async function generateMetadata(){const {t}=await getI18n();return {title:t('دسترسی APU | دلسا'),description:t('دسترسی به پایش هوشمند قیمت در DELSA APU.')}}
export default async function PricingPage(){const {t}=await getI18n();return <div className="hx">
<HomeHeader home={false}/>
<main className="hx-page">
<section className="hx-wrap hx-pagehero">
<div className="hx-aurora" aria-hidden="true"><span className="hx-blob a"/><span className="hx-blob b"/></div>
<span className="hx-eyebrow"><RefreshCw size={16}/> {t('دسترسی دلسا APU')}</span>
<h1>{t('قیمت‌ها را پایش کن،')}<br/><span className="hx-grad">{t('با کنترل خودت.')}</span></h1>
<p className="hx-lead">{t('APU در حال آماده‌سازی برای اتصال فروشگاه‌ها و منابع قیمت است. در این مرحله می‌توانی حساب بسازی و برای شروع آماده باشی.')}</p>
<div className="hx-promise"><span><Check size={18}/> {t('مقایسه‌ی قیمت')}</span><span><Check size={18}/> {t('بازبینی تغییرها')}</span><span><ShieldCheck size={18}/> {t('تصمیم نهایی با شما')}</span></div>
</section>
<section className="hx-wrap">
<article className="hx-plan">
<span className="hx-ribbon">{t('دسترسی آغازین')}</span>
<div className="hx-plan-top"><span className="hx-tagpill">{t('برای فروشگاه‌های آنلاین')}</span><span className="hx-plan-mark"><img src="/delsa-mark.svg" alt=""/></span></div>
<h2>APU</h2>
<p className="hx-plan-desc">{t('پایش قیمت و آماده‌سازی برای به‌روزرسانی امن محصول‌ها.')}</p>
<div className="hx-amount">{t('به‌زودی')}</div>
<p className="hx-plan-note">{t('هزینه و جزئیات پیش از فعال‌سازی اعلام می‌شود.')}</p>
<ul>
<li><Check size={20}/> {t('پایش قیمت در منابع انتخابی')}</li>
<li><Check size={20}/> {t('هشدار اختلاف‌های مهم')}</li>
<li><Check size={20}/> {t('تأیید پیش از تغییر')}</li>
<li><Clock3 size={20}/> {t('اتصال فروشگاه در حال آماده‌سازی')}</li>
</ul>
<Link className="hx-btn hx-btn-primary" href="/signup">{t('ساخت حساب APU')} <ArrowUpLeft size={18}/></Link>
</article>
</section>
<p className="hx-fine hx-wrap">{t('قیمت‌گذاری و پرداخت هنوز فعال نیست. ثبت‌نام هزینه‌ای ندارد و حساب، دسترسی فعال به اتصال‌های فروشگاهی ایجاد نمی‌کند.')}</p>
</main>
<SiteFooter/>
</div>}

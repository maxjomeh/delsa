import '../../home.css';
import '../../pages.css';
import Link from '../../../components/i18n/Link';
import { getI18n } from '../../../lib/i18n/server';
import HomeHeader from '../../../components/home/HomeHeader';
import SiteFooter from '../../../components/home/SiteFooter';
import { ArrowLeft, ArrowUpLeft, ShoppingBag } from 'lucide-react';
import { SITE_BUILDER_PRODUCT } from '../../../lib/site-builder';
import { createClient } from '../../../lib/supabase/server';

export const dynamic = 'force-dynamic';
export async function generateMetadata() { const { t } = await getI18n(); return { title: t('فروشگاه دلسا'), description: t('محصول‌ها و سرویس‌های دلسا را در فروشگاه ببینید.') }; }

function priceLabel(value, t, intl) {
  if (value === null || value === undefined || value === '') return t('برای قیمت تماس بگیرید');
  return new Intl.NumberFormat(intl).format(Number(value)) + ' ' + t('تومان');
}

export default async function StorePage() {
  const { t, intl } = await getI18n();
  const supabase = await createClient();
  const { data: products = [], error } = await supabase.from('store_products')
    .select('id,name,description,price,image_url').eq('is_published', true).order('created_at', { ascending: false });
  const visibleProducts = error ? [] : products || [];
  return <div className="hx">
    <HomeHeader home={false}/>
    <main className="store-main hx-wrap">
      <section className="store-heading"><span className="hx-eyebrow"><ShoppingBag size={16}/> {t('فروشگاه دلسا')}</span><h1>{t('محصول‌های دلسا')}</h1><p>{t('سرویس‌های قابل ارائه را ببینید و محصول موردنیازتان را انتخاب کنید.')}</p></section>
      {visibleProducts.length ? <section className="store-product-grid" aria-label={t('محصول‌ها')}>{visibleProducts.map(product => <article className="store-product-card" key={product.id}>
        <div className="store-product-image">{product.image_url ? <img src={product.image_url} alt={product.name} loading="lazy"/> : <span><ShoppingBag size={30}/></span>}</div>
        <div className="store-product-copy"><span className="store-product-label">DELSA</span><h2>{product.name}</h2><p>{product.description || t('برای دریافت اطلاعات بیشتر دربارهٔ این محصول با ما در ارتباط باشید.')}</p></div>
        <div className="store-product-bottom"><strong>{priceLabel(product.price, t, intl)}</strong><Link href={product.id===SITE_BUILDER_PRODUCT?'/builder':'/login'}>{t('اطلاعات بیشتر')} <ArrowLeft size={16}/></Link></div>
      </article>)}</section> : <section className="store-empty"><span><ShoppingBag size={25}/></span><h2>{error ? t('فروشگاه در حال آماده‌سازی است') : t('محصولی برای نمایش ثبت نشده است')}</h2><p>{t('با اضافه‌شدن محصول از پنل مدیریت، همین‌جا نمایش داده می‌شود.')}</p><Link className="button primary" href="/">{t('بازگشت به صفحهٔ اصلی')} <ArrowUpLeft size={17}/></Link></section>}
    </main>
    <SiteFooter/>
  </div>;
}

import '../home.css';
import '../pages.css';
import Link from 'next/link';
import HomeHeader from '../../components/home/HomeHeader';
import SiteFooter from '../../components/home/SiteFooter';
import { ArrowLeft, ArrowUpLeft, ShoppingBag } from 'lucide-react';
import { SITE_BUILDER_PRODUCT } from '../../lib/site-builder';
import { createClient } from '../../lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'فروشگاه دلسا', description: 'محصول‌ها و سرویس‌های دلسا را در فروشگاه ببینید.' };

function priceLabel(value) {
  if (value === null || value === undefined || value === '') return 'برای قیمت تماس بگیرید';
  return new Intl.NumberFormat('fa-IR').format(Number(value)) + ' تومان';
}

export default async function StorePage() {
  const supabase = await createClient();
  const { data: products = [], error } = await supabase.from('store_products')
    .select('id,name,description,price,image_url').eq('is_published', true).order('created_at', { ascending: false });
  const visibleProducts = error ? [] : products || [];
  return <div className="hx">
    <HomeHeader home={false}/>
    <main className="store-main hx-wrap">
      <section className="store-heading"><span className="hx-eyebrow"><ShoppingBag size={16}/> فروشگاه دلسا</span><h1>محصول‌های دلسا</h1><p>سرویس‌های قابل ارائه را ببینید و محصول موردنیازتان را انتخاب کنید.</p></section>
      {visibleProducts.length ? <section className="store-product-grid" aria-label="محصول‌ها">{visibleProducts.map(product => <article className="store-product-card" key={product.id}>
        <div className="store-product-image">{product.image_url ? <img src={product.image_url} alt={product.name} loading="lazy"/> : <span><ShoppingBag size={30}/></span>}</div>
        <div className="store-product-copy"><span className="store-product-label">DELSA</span><h2>{product.name}</h2><p>{product.description || 'برای دریافت اطلاعات بیشتر دربارهٔ این محصول با ما در ارتباط باشید.'}</p></div>
        <div className="store-product-bottom"><strong>{priceLabel(product.price)}</strong><Link href={product.id===SITE_BUILDER_PRODUCT?'/builder':'/login'}>اطلاعات بیشتر <ArrowLeft size={16}/></Link></div>
      </article>)}</section> : <section className="store-empty"><span><ShoppingBag size={25}/></span><h2>{error ? 'فروشگاه در حال آماده‌سازی است' : 'محصولی برای نمایش ثبت نشده است'}</h2><p>با اضافه‌شدن محصول از پنل مدیریت، همین‌جا نمایش داده می‌شود.</p><Link className="button primary" href="/">بازگشت به صفحهٔ اصلی <ArrowUpLeft size={17}/></Link></section>}
    </main>
    <SiteFooter/>
  </div>;
}

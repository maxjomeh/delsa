import {cache} from 'react';
import {notFound} from 'next/navigation';
import {createPublicClient} from '../../../../lib/supabase/public';
import {normalizeDocument} from '../../../../lib/site-builder';
import BuilderStorefront from '../../../../components/BuilderStorefront';
import {defaultShop} from '../../../../lib/builder-commerce';
// Published sites are public and cookie-free, so they are served from the ISR cache.
// Publishing/unpublishing calls /api/builder/revalidate; the TTL bounds stock/price staleness
// (checkout re-validates price and stock in the database).
export const revalidate=60;
// Deduplicates the read between generateMetadata and the page within one render.
const load=cache(async(slug,pathKey)=>{const path=pathKey?pathKey.split('/'):[];if(!/^[a-z0-9][a-z0-9-]{2,47}$/.test(slug)||path.length>2)return null;const db=createPublicClient();const {data}=await db.from('builder_publications').select('site_id,name,slug,document').eq('slug',slug).eq('is_live',true).maybeSingle();if(!data)return null;const doc=normalizeDocument(data.document);let view='page',pageSlug=path[0]||'',productSlug='';if(['shop','cart','checkout','orders'].includes(path[0])&&path.length===1)view=path[0];else if(path[0]==='product'&&path.length===2){view='product';productSlug=path[1]}else if(path.length>1||!doc.pages.some(p=>p.slug===pageSlug))return null;const [catalog,settings]=await Promise.all([db.from('builder_products').select('*,variants:builder_variants(*)').eq('site_id',data.site_id).eq('status','published').order('created_at',{ascending:false}).limit(1000),db.from('builder_shop_settings').select('*').eq('site_id',data.site_id).maybeSingle()]);if(catalog.error||settings.error)throw new Error('Store data unavailable');const products=(catalog.data||[]).map(p=>({...p,variants:p.variants.filter(v=>v.enabled)}));if(view==='product'&&!products.some(p=>p.slug===productSlug))return null;return {site:{...data,document:doc},products,settings:{...defaultShop,...settings.data,free_shipping_threshold:settings.data?.free_shipping_threshold??null},view,pageSlug,productSlug}});
async function read(params){const {slug,path=[]}=await params;return load(slug,path.join('/'))}
const origin=process.env.NEXT_PUBLIC_SITE_URL||'https://www.delsaai.ir';
export async function generateMetadata({params}){
 const s=await read(params);
 if(!s)return {title:'سایت یافت نشد',robots:{index:false,follow:false},referrer:'same-origin'};
 const {site,view,pageSlug,productSlug,products}=s,name=site.name,product=products.find(p=>p.slug===productSlug),page=view==='page'?site.document.pages.find(p=>p.slug===pageSlug):null;
 const title=product?product.title+' | '+name:view==='shop'?'فروشگاه | '+name:page&&page.slug!==''?page.title+' | '+name:name;
 const description=(product?.summary||page?.description||site.document.description||'').trim()||undefined;
 const image=[product?.images?.[0],...(page?.blocks||[]).map(b=>b.image)].find(x=>/^https:\/\//i.test(x||''));
 const path='/s/'+site.slug+(view==='product'?'/product/'+productSlug:view==='page'?(pageSlug?'/'+pageSlug:''):'/'+view);
 const indexable=!['cart','checkout','orders'].includes(view);
 return {metadataBase:new URL(origin),title,description,alternates:{canonical:path},openGraph:{title,description,url:path,siteName:name,locale:'fa_IR',type:'website',...(image?{images:[image]}:{})},twitter:{card:image?'summary_large_image':'summary',title,description,...(image?{images:[image]}:{})},robots:{index:indexable,follow:true},referrer:'same-origin'};
}
export default async function PublicSite({params}){const s=await read(params);if(!s)notFound();return <BuilderStorefront key={s.site.slug} {...s}/>}

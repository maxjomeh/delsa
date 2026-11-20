import {cache} from 'react';
import {notFound} from 'next/navigation';
import {createPublicClient} from '../../../../../lib/supabase/public';
import {normalizeDocument} from '../../../../../lib/site-builder';
import BuilderStorefront from '../../../../../components/BuilderStorefront';
import {safePermalink} from '../../../../../lib/builder-instagram';
import {defaultShop} from '../../../../../lib/builder-commerce';
import {loadMessages} from '../../../../../lib/i18n/messages';
import {LOCALE_INFO,createTranslator} from '../../../../../lib/i18n/config';
import {listingFor,listingKinds,safeDecode,safeJson,productJsonLd,listingJsonLd} from '../../../../../lib/book-seo';
// Published sites are public and cookie-free, so they are served from the ISR cache.
// Publishing/unpublishing calls /api/builder/revalidate; the TTL bounds stock/price staleness
// (checkout re-validates price and stock in the database).
export const revalidate=60;
// No pages are prebuilt; an empty list opts this dynamic route into on-demand static rendering (ISR).
export function generateStaticParams(){return []}
// Deduplicates the read between generateMetadata and the page within one render.
const load=cache(async(slug,pathKey)=>{const path=pathKey?pathKey.split('/'):[];if(!/^[a-z0-9][a-z0-9-]{2,47}$/.test(slug)||path.length>2)return null;const db=createPublicClient();const {data}=await db.from('builder_publications').select('site_id,name,slug,document').eq('slug',slug).eq('is_live',true).maybeSingle();if(!data)return null;const doc=normalizeDocument(data.document);let view='page',pageSlug=path[0]||'',productSlug='',listingKey='';if(['shop','cart','checkout','orders'].includes(path[0])&&path.length===1)view=path[0];else if(path[0]==='product'&&path.length===2){view='product';productSlug=path[1]}else if((path[0]==='author'||path[0]==='publisher')&&path.length===2){view=path[0];listingKey=safeDecode(path[1])}else if(path.length>1||!doc.pages.some(p=>p.slug===pageSlug))return null;const [catalog,settings,videoRows,linkRows]=await Promise.all([db.from('builder_products').select('*,variants:builder_variants(*)').eq('site_id',data.site_id).eq('status','published').order('created_at',{ascending:false}).limit(1000),db.from('builder_shop_settings').select('*').eq('site_id',data.site_id).maybeSingle(),db.from('builder_product_videos').select('product_id,url,poster,position').eq('site_id',data.site_id).order('position',{ascending:true}).limit(1000),db.from('builder_instagram_imports').select('product_id,permalink').eq('site_id',data.site_id).limit(1000)]);if(catalog.error||settings.error)throw new Error('Store data unavailable');// Videos are optional (the table may not exist yet): a failure only means "no videos".
 const videosOf={};for(const v of (videoRows?.error?[]:videoRows?.data||[]))(videosOf[v.product_id]||=[]).push({url:v.url,poster:v.poster});
 // "View on Instagram" links: RLS only returns published products of live sites whose owner left the button on (table optional too).
 const linkOf={};for(const l of (linkRows?.error?[]:linkRows?.data||[])){const u=safePermalink(l.permalink);if(u)linkOf[l.product_id]=u}
 const products=(catalog.data||[]).map(p=>({...p,variants:p.variants.filter(v=>v.enabled),videos:videosOf[p.id]||[],instagram:linkOf[p.id]||''}));if(view==='product'&&!products.some(p=>p.slug===productSlug))return null;const listing=(view==='author'||view==='publisher')?listingFor(products,view,listingKey):null;if((view==='author'||view==='publisher')&&!listing)return null;return {site:{...data,document:doc},products,listing,settings:{...defaultShop,...settings.data,free_shipping_threshold:settings.data?.free_shipping_threshold??null},view,pageSlug,productSlug}});
async function read(params){const {slug,path=[]}=await params;return load(slug,path.join('/'))}
const origin=process.env.NEXT_PUBLIC_SITE_URL||'https://www.delsaai.ir';
export async function generateMetadata({params}){
 const s=await read(params);
 if(!s)return {title:'سایت یافت نشد',robots:{index:false,follow:false},referrer:'same-origin'};
 const {site,view,pageSlug,productSlug,products,listing}=s,name=site.name,lang=site.document.lang,t=createTranslator(lang,await loadMessages(lang,'site'),{quiet:true}),product=products.find(p=>p.slug===productSlug),page=view==='page'?site.document.pages.find(p=>p.slug===pageSlug):null;
 const title=listing?(listing.kind==='author'?t('کتاب‌های {name}',{name:listing.name}):t('کتاب‌های ناشر {name}',{name:listing.name}))+' | '+name:product?product.title+' | '+name:view==='shop'?t('فروشگاه')+' | '+name:page&&page.slug!==''?page.title+' | '+name:name;
 const description=(listing?t('فهرست کتاب‌های {kind} {name} در فروشگاه {shop} ({n} کتاب).',{kind:t(listingKinds[listing.kind]),name:listing.name,shop:name,n:listing.products.length}):product?.summary||page?.description||site.document.description||'').trim()||undefined;
 const image=[listing?.products?.[0]?.images?.[0],product?.images?.[0],...(page?.blocks||[]).map(b=>b.image)].find(x=>/^https:\/\//i.test(x||''));
 const path='/s/'+site.slug+(listing?'/'+view+'/'+encodeURIComponent(listing.slug):view==='product'?'/product/'+productSlug:view==='page'?(pageSlug?'/'+pageSlug:''):'/'+view);
 const indexable=!['cart','checkout','orders'].includes(view);
 return {metadataBase:new URL(origin),title,description,alternates:{canonical:path},openGraph:{title,description,url:path,siteName:name,locale:LOCALE_INFO[lang].og,type:'website',...(image?{images:[image]}:{})},twitter:{card:image?'summary_large_image':'summary',title,description,...(image?{images:[image]}:{})},robots:{index:indexable,follow:true},referrer:'same-origin'};
}
// schema.org JSON-LD for the book industry: Product+Book on product pages, CollectionPage on author/publisher pages.
function jsonLdFor(s){
 if(s.site.document.industry!=='books')return null;
 const base='/s/'+s.site.slug;
 if(s.listing)return listingJsonLd({origin,base,listing:s.listing});
 const product=s.view==='product'?s.products.find(p=>p.slug===s.productSlug):null;
 return product?productJsonLd({origin,base,product,siteName:s.site.name}):null;
}
export default async function PublicSite({params}){const s=await read(params);if(!s)notFound();const ld=jsonLdFor(s);
// The site renders in its own language (document.lang); its dictionary is loaded here so the route stays static (ISR).
const messages=await loadMessages(s.site.document.lang,'site');return <>{ld&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJson(ld)}}/>}<BuilderStorefront key={s.site.slug} messages={messages} {...s}/></>}

// Book-store helpers that need no database changes: author/publisher listings derived from the industry
// fields of a site's own products, edition comparison, and schema.org JSON-LD.
import {faNorm} from './book-isbn';

export const listingKinds={author:'نویسنده',publisher:'ناشر'};
// URL segment for a person/publisher name: normalised, Persian letters kept, everything else becomes "-".
export const nameSlug=name=>faNorm(name).replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-+|-+$/g,'');
// "A، B" / "A, B" / "A; B" -> ["A","B"] (a product can have several authors).
export const peopleOf=value=>[...new Set(String(value??'').split(/[،,;؛]/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean))].slice(0,10);
export const listingPath=(kind,name)=>`/${kind}/${encodeURIComponent(nameSlug(name))}`;
export function safeDecode(segment){try{return decodeURIComponent(segment)}catch{return ''}}

// Products of a site that belong to one author/publisher page; null when there are none (404).
export function listingFor(products,kind,slug){
 if(!listingKinds[kind]||!slug)return null;
 let name='';
 const list=products.filter(p=>{const hit=peopleOf(p.attributes?.[kind]).find(n=>nameSlug(n)===slug);if(hit&&!name)name=hit;return Boolean(hit)});
 return list.length?{kind,name,slug,products:list}:null;
}
// Every author/publisher that has a page: [{name,slug,count}] (used by the sitemap and tests).
export function listingIndex(products,kind){
 const map=new Map();
 for(const p of products)for(const n of peopleOf(p.attributes?.[kind])){const slug=nameSlug(n);if(!slug)continue;const e=map.get(slug)||{name:n,slug,count:0};e.count++;map.set(slug,e)}
 return [...map.values()];
}
// Other products of the same site that are another edition/translation of the same book:
// same normalised title and same first author.
export function editionsOf(products,product){
 const key=p=>faNorm(p.title)+'|'+nameSlug(peopleOf(p.attributes?.author)[0]||'');
 const k=key(product);
 return products.filter(p=>p.id!==product.id&&key(p)===k);
}

// JSON.stringify that is safe inside <script type="application/ld+json">.
export const safeJson=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');

const LANGUAGES={'فارسی':'fa','انگلیسی':'en','عربی':'ar','فرانسوی':'fr','آلمانی':'de'};
const FORMATS={'شومیز':'Paperback','گالینگور':'Hardcover','جلد سخت':'Hardcover','نسخه الکترونیکی':'EBook'};
const https=x=>/^https:\/\//i.test(x||'');
const cheapest=p=>{const v=(p.variants||[]).filter(x=>x.enabled!==false);return v.length?v.reduce((a,b)=>Number(b.sale_price??b.price)<Number(a.sale_price??a.price)?b:a):null};

// schema.org Product + Book. Prices are stored in toman; schema.org needs ISO 4217, so they are sent as IRR (rial = toman * 10).
export function productJsonLd({origin,base,product,siteName}){
 const a=product.attributes||{},url=origin+base+'/product/'+product.slug,v=cheapest(product),images=(product.images||[]).filter(https).slice(0,6);
 const authors=peopleOf(a.author),translators=peopleOf(a.translator),year=Number(a.publish_year);
 const ld={'@context':'https://schema.org','@type':['Product','Book'],name:product.title,url,
  ...(images.length?{image:images}:{}),
  ...((product.summary||product.description)?{description:String(product.summary||product.description).slice(0,300)}:{}),
  ...(a.isbn?{isbn:a.isbn}:{}),
  ...(authors.length?{author:authors.map(name=>({'@type':'Person',name}))}:{}),
  ...(translators.length?{translator:translators.map(name=>({'@type':'Person',name}))}:{}),
  ...(a.publisher?{publisher:{'@type':'Organization',name:a.publisher}}:{}),
  ...(Number(a.pages)>0?{numberOfPages:Number(a.pages)}:{}),
  ...(LANGUAGES[a.language]?{inLanguage:LANGUAGES[a.language]}:{}),
  ...(a.edition?{bookEdition:a.edition}:{}),
  ...(FORMATS[a.cover]?{bookFormat:'https://schema.org/'+FORMATS[a.cover]}:{}),
  // Jalali years (1200-1500) cannot be expressed as an ISO date, so only Gregorian years are sent.
  ...(year>=1800&&year<=2200?{datePublished:String(year)}:{})};
 if(v){
  const inStock=!v.manage_stock||Number(v.stock)>0;
  ld.sku=v.sku||undefined;
  ld.offers={'@type':'Offer',url,priceCurrency:'IRR',price:String(Math.round(Number(v.sale_price??v.price))*10),availability:'https://schema.org/'+(inStock?'InStock':'OutOfStock'),...(siteName?{seller:{'@type':'Organization',name:siteName}}:{})};
 }
 return ld;
}
export function listingJsonLd({origin,base,listing}){
 const {kind,name,slug,products}=listing,url=origin+base+'/'+kind+'/'+encodeURIComponent(slug);
 return {'@context':'https://schema.org','@type':'CollectionPage',name:(kind==='author'?'کتاب‌های ':'کتاب‌های ناشر ')+name,url,
  about:{'@type':kind==='author'?'Person':'Organization',name},
  mainEntity:{'@type':'ItemList',numberOfItems:products.length,itemListElement:products.slice(0,50).map((p,i)=>({'@type':'ListItem',position:i+1,url:origin+base+'/product/'+p.slug,name:p.title}))}};
}

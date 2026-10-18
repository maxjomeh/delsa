// Price values remain integer IRR. Convert for display only.
export function productId(input) {
 const text=String(input||'').trim();
 if(/^(?:dkp-)?[1-9]\d{0,11}$/.test(text)) return text.replace('dkp-','');
 try {const u=new URL(text);if(u.protocol!=='https:'||!['digikala.com','www.digikala.com'].includes(u.hostname)||u.username||u.password||u.port)throw Error();const m=u.pathname.match(/^\/product\/dkp-([1-9]\d{0,11})(?:\/|$)/);if(m)return m[1];}catch{}
 throw new Error('لینک محصول دیجی‌کالا یا کد DKP معتبر وارد کنید.');
}
const id=v=>v==null?'':String(v);
export function parseProduct(payload,expectedId) {
 const p=payload?.data?.product;
 if(!p||id(p.id)!==id(expectedId)||!Array.isArray(p.variants)||typeof p.title_fa!=='string')throw Error('ساختار پاسخ دیجی‌کالا تغییر کرده یا کامل نیست.');
 if(p.variants.length>300)throw Error('تعداد پیشنهادها نیازمند دریافت صفحه‌بندی‌شده است.');
 const seen=new Set();const offers=[];
 for(const v of p.variants){
  const price=v?.price?.selling_price;
  // Unknown stock is not eligible. No inference from product-level availability.
  const stock=v?.price?.order_limit;
  if(v.status!=='marketable'||v.price?.is_locked_for_digiplus===true||(v.price?.min_order_limit||1)>1||!Number.isSafeInteger(price)||price<=0||!Number.isInteger(stock)||stock<=0||!v.id||!v.seller?.id||!v.seller?.title)continue;
  const key=id(v.id);if(seen.has(key))continue;seen.add(key);
  const attributes={color:id(v.color?.id),size:id(v.size?.id),warranty:id(v.warranty?.id),themes:(Array.isArray(v.themes)?v.themes:[]).map(t=>({label:String(t.label||''),id:id(t.value?.id),title:String(t.value?.title||'')})).sort((a,b)=>a.label.localeCompare(b.label))};
  offers.push({id:key,sellerId:id(v.seller.id),seller:v.seller.title.slice(0,200),price,group:JSON.stringify(attributes),color:v.color?.title||'',size:v.size?.title||'',warranty:v.warranty?.title_fa||'',shipping:null});
 }
 offers.sort((a,b)=>a.price-b.price||a.id.localeCompare(b.id));
 return {title:p.title_fa.slice(0,300),offers,coverage:'returned_variants'};
}
export function recommend(offers,config,now=Date.now()) {
 if(!config.group||!config.checked_at||now-new Date(config.checked_at).getTime()>3600000)return null;
 return offers.filter(o=>o.group===config.group&&!(config.excluded||[]).includes(o.sellerId)).sort((a,b)=>a.price-b.price||a.id.localeCompare(b.id))[0]||null;
}
export async function fetchProduct(dkp,fetcher=fetch){
 const url=`https://api.digikala.com/v2/product/${productId(dkp)}/`;
 const options={headers:{Accept:'application/json'},cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(7000)};
 let response=await fetcher(url,options);
 // The CDN may establish an anonymous session with a same-URL redirect.
 // Follow once, only to this exact fixed URL; never follow external redirects.
 if([301,302,303,307,308].includes(response.status)&&response.headers.get('location')===url){
  const cookies=response.headers.getSetCookie?.()||[response.headers.get('set-cookie')||''];
  const cookie=cookies.map(c=>c.split(';')[0]).find(c=>/^digicdn_cookie=[A-Za-z0-9_-]{1,200}$/.test(c));
  if(cookie)response=await fetcher(url,{...options,headers:{...options.headers,Cookie:cookie},signal:AbortSignal.timeout(7000)});
 }
 if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw Error('دریافت اطلاعات دیجی‌کالا ناموفق بود؛ اطلاعات قبلی حفظ شد.');
 const raw=await response.text();if(raw.length>4000000)throw Error('پاسخ منبع بیش از حد بزرگ است.');
 return parseProduct(JSON.parse(raw),dkp);
}

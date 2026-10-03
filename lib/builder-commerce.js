export const money=n=>new Intl.NumberFormat('fa-IR').format(Number(n||0))+' تومان';
export const orderStates={pending:'در انتظار بررسی',processing:'در حال آماده‌سازی',shipped:'ارسال‌شده',completed:'تکمیل‌شده',cancelled:'لغوشده',refunded:'مرجوع‌شده'};
export const paymentStates={unpaid:'پرداخت‌نشده',paid:'پرداخت‌شده',refunded:'بازپرداخت ثبت‌شده'};
export const productStates={draft:'پیش‌نویس',published:'منتشرشده',archived:'بایگانی'};
export const normalizeText=s=>String(s||'').replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).toLowerCase();
export const effectivePrice=v=>Number(v.sale_price??v.price);
export const blankVariant=()=>({id:null,label:'پیش‌فرض',sku:'',price:'',sale_price:'',stock:0,manage_stock:true,attributes:{}});
export const blankProduct=()=>({title:'',slug:'',kind:'simple',status:'published',description:'',summary:'',category:'',brand:'',images:[],tags:[],attributes:{},featured:false,weight_grams:0,variants:[blankVariant()]});
export const defaultShop={accepting_orders:false,shipping_fee:0,free_shipping_threshold:'',tax_percent:0,allow_cod:true,allow_bank:false,bank_instructions:'',contact_phone:'',shipping_regions:[],policies:''};
export function commerceError(e){const m=e?.message||'';const map={builder_free_product_limit:'سقف طرح رایگان ۱۰ محصول فعال است؛ یک محصول را بایگانی کنید یا اشتراک سایت‌ساز بگیرید.',store_access_denied:'دسترسی یا اشتراک فروشگاه معتبر نیست.',product_changed:'محصول تغییر کرده است؛ اطلاعات را دوباره بارگذاری کنید.',stock_changed:'موجودی پس از بازکردن فرم تغییر کرده است؛ اطلاعات محصول را دوباره بارگذاری کنید.',store_unavailable:'فروشگاه در دسترس نیست.',checkout_disabled:'ثبت سفارش یا روش پرداخت انتخابی فعال نیست.',invalid_phone:'شماره موبایل را به شکل 09123456789 وارد کنید.',shipping_unavailable:'ارسال به استان انتخاب‌شده فعال نیست.',invalid_cart:'سبد خرید معتبر نیست.',stock_unavailable:'موجودی یکی از کالاها کافی نیست. سبد را اصلاح کنید.',product_unavailable:'یکی از کالاها دیگر قابل خرید نیست.',coupon_invalid:'کد تخفیف معتبر نیست یا شرایط استفاده را ندارد.',try_later:'کمی صبر کنید و دوباره تلاش کنید.',terminal_order:'سفارش لغوشده یا مرجوع‌شده دوباره فعال نمی‌شود.',invalid_transition:'این تغییر وضعیت سفارش مجاز نیست.',invalid_payment_state:'وضعیت پرداخت با وضعیت سفارش سازگار نیست.'};if(e?.code==='23505')return 'آدرس محصول یا SKU تکراری است.';if(e?.code==='23514'||e?.code==='23502'||e?.code==='22P02')return 'فیلدها را بررسی کنید؛ قیمت، موجودی و اطلاعات الزامی باید معتبر باشند.';return Object.entries(map).find(([key])=>m.includes(key))?.[1]||'عملیات انجام نشد. اتصال و اعتبار اشتراک را بررسی کنید.'}
export function downloadCSV(name,rows){const quote=v=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};const u=URL.createObjectURL(new Blob(['\ufeff'+rows.map(r=>r.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
export function parseCSV(text){const rows=[];let row=[],cell='',quoted=false;const s=text.replace(/^\ufeff/,'');let first='',inside=false;for(const c of s){if(c==='"')inside=!inside;if(!inside&&(c==='\n'||c==='\r'))break;if(!inside)first+=c}const delimiter=first.includes(',')?',':first.includes(';')?';':first.includes('\t')?'\t':',';for(let i=0;i<s.length;i++){const c=s[i];if(c==='"'){if(quoted&&s[i+1]==='"'){cell+='"';i++}else if(!quoted&&cell!=='')throw Error('invalid_csv');else quoted=!quoted}else if(c===delimiter&&!quoted){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&s[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x!==''))rows.push(row);row=[];cell=''}else cell+=c}if(quoted)throw Error('invalid_csv');row.push(cell);if(row.some(x=>x!==''))rows.push(row);return rows}
export const productCSVHeaders=['title','slug','kind','status','category','brand','sku','variant','price','sale_price','stock','manage_stock','summary','description','images'];
export function productRows(products){return [productCSVHeaders,...products.flatMap(p=>(p.variants||[]).filter(v=>v.enabled!==false).map(v=>[p.title,p.slug,p.kind,p.status,p.category,p.brand,v.sku,v.label,v.price,v.sale_price??'',v.stock,v.manage_stock?'1':'0',p.summary,p.description,p.images.join('|')]))]}
export function productSlug(title){
 const letters={'ا':'a','آ':'a','ب':'b','پ':'p','ت':'t','ث':'s','ج':'j','چ':'ch','ح':'h','خ':'kh','د':'d','ذ':'z','ر':'r','ز':'z','ژ':'zh','س':'s','ش':'sh','ص':'s','ض':'z','ط':'t','ظ':'z','ع':'a','غ':'gh','ف':'f','ق':'gh','ک':'k','گ':'g','ل':'l','م':'m','ن':'n','و':'v','ه':'h','ی':'y'};
 const slug=[...normalizeText(title)].map(c=>letters[c]||c).join('').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70).replace(/-+$/,'');
 return slug.length>=2?slug:'product';
}
export const simpleProductRows=()=>[['نام محصول','قیمت','موجودی','دسته‌بندی','برند','شناسه','آدرس تصویر'],['محصول نمونه',100000,10,'لوازم جانبی','','','']];
export function importProductRows(rows){
 if(rows.length<2||rows.length>501)throw Error('حداکثر ۵۰۰ ردیف محصول وارد کنید.');
 const aliases={'نام محصول':'title','نام':'title','قیمت':'price','موجودی':'stock','دسته‌بندی':'category','دسته بندی':'category','برند':'brand','شناسه':'sku','آدرس تصویر':'images','آدرس محصول':'slug','وضعیت':'status'};
 const headers=rows[0].map(x=>aliases[x.trim()]||x.trim().toLowerCase());
 if(!['title','price'].every(x=>headers.includes(x)))throw Error('ستون‌های نام محصول و قیمت لازم‌اند.');
 if(new Set(headers).size!==headers.length)throw Error('عنوان ستون‌ها تکراری است.');
 const groups=new Map(),skus=new Set();
 for(const [index,row] of rows.slice(1).entries()){
 try{
 if(row.length!==headers.length)throw Error('تعداد ستون‌ها یکسان نیست.');
 const r=Object.fromEntries(headers.map((h,i)=>[h,row[i].trim()]));
 const number=(x,blank=false)=>{if(blank&&!x)return '';const n=normalizeText(x||'0').replace(/[,٬\s]/g,'');if(!/^\d+$/.test(n)||!Number.isSafeInteger(Number(n)))throw Error('قیمت و موجودی باید عدد مثبت باشند.');return Number(n)};
 const slug=r.slug||productSlug(r.title),kind=r.kind||'simple',status=r.status||'published',sku=r.sku||'';
 if(!/^[a-z0-9][a-z0-9-]{1,79}$/.test(slug)||r.title.length<2||!['simple','variable'].includes(kind)||!Object.keys(productStates).includes(status))throw Error('نام، آدرس یا وضعیت محصول معتبر نیست.');
 if(sku&&skus.has(sku))throw Error('شناسه تکراری است.');if(sku)skus.add(sku);
 if(!r.price)throw Error('قیمت لازم است.');const price=number(r.price),sale=number(r.sale_price,true),stock=number(r.stock);
 if(price>1e12||stock>1e8||(sale!==''&&sale>price))throw Error('قیمت یا موجودی خارج از محدوده است.');
 if(r.manage_stock&&!['0','1'].includes(r.manage_stock))throw Error('کنترل موجودی باید صفر یا یک باشد.');
 const images=(r.images||'').split('|').filter(Boolean);if(images.length>12||images.some(s=>!/^https:\/\//i.test(s)))throw Error('آدرس تصویر باید با HTTPS شروع شود.');
 // Only an explicit slug groups variations or updates an existing product.
 const key=r.slug||'new-'+index;
 let p=groups.get(key);if(!p){p={...blankProduct(),title:r.title,slug,autoSlug:!r.slug,kind,status,category:r.category||'',brand:r.brand||'',summary:r.summary||'',description:r.description||'',images,variants:[]};groups.set(key,p)}else if(p.title!==r.title||p.kind!==kind||p.status!==status)throw Error('اطلاعات تنوع‌های یک محصول یکسان نیست.');
 p.variants.push({...blankVariant(),label:r.variant||'پیش‌فرض',sku,price,sale_price:sale,stock,manage_stock:r.manage_stock!=='0'});
 }catch(e){throw Error('ردیف '+(index+2)+': '+e.message)}
 }
 for(const p of groups.values())if((p.kind==='simple'&&p.variants.length!==1)||p.variants.length>100)throw Error('تعداد تنوع‌ها معتبر نیست.');
 return [...groups.values()];
}
export function attributeText(obj){return Object.entries(obj||{}).map(([k,v])=>k+': '+String(v)).join('\n')}
export function parseAttributes(text){return Object.fromEntries(text.split('\n').map(s=>{const i=s.indexOf(':');return i>0?[s.slice(0,i).trim(),s.slice(i+1).trim()]:null}).filter(Boolean).slice(0,30))}

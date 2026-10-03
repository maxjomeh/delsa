export const SITE_BUILDER_PRODUCT='38ba2004-0021-4717-b06f-dc21493b83b5';
export const templates=[
 {id:'studio',name:'استودیوی خلاق',description:'جسور و تحریریه‌ای؛ تیترهای درشت، بنفش و لیمویی، چیدمان نامتقارن برای برندهای خلاق',color:'#7c3aed'},
 {id:'catalog',name:'بازار کاتالوگ',description:'فروشگاه گرم و محصول‌محور؛ ویترین دو ستونه، کارت‌های منظم و رنگ آجری',color:'#e85130'},
 {id:'consultant',name:'مشاور حرفه‌ای',description:'خدمات و مشاوره؛ طراحی آبی، معرفی فرایند همکاری و دعوت روشن به ارتباط',color:'#2563eb'}
];
export const blockLabels={hero:'بخش اصلی',text:'متن و توضیحات',features:'ویژگی‌ها',contact:'اطلاعات تماس',image:'تصویر',products:'محصولات فروشگاه'};
export const uid=()=>globalThis.crypto.randomUUID();
export function newBlock(type){return {id:uid(),type,title:type==='hero'?'کسب‌وکارت را معرفی کن':type==='products'?'محصولات فروشگاه':'عنوان بخش',text:'توضیح کوتاه این بخش را بنویس.',button:'بیشتر بدانید',url:'#contact',items:['ویژگی اول','ویژگی دوم','ویژگی سوم'],image:''}}
export function starter(template,name){
 const block=(type,fields)=>({...newBlock(type),...fields});
 const contact=block('contact',{title:'گفت‌وگو را شروع کنیم',text:'برای پرسش دربارهٔ محصولات و خدمات، اطلاعات تماس خود را در این بخش قرار دهید.',button:'ارتباط با ما',url:''});
 const presets={
 studio:[block('hero',{title:name,text:'ایده‌های خوب، شایستهٔ یک تجربهٔ متفاوت‌اند. محصولات و خدمات ما را از نزدیک بشناسید.',button:'کشف محصولات',url:'#products'}),block('features',{title:'اینجا، متفاوت فکر می‌کنیم.',text:'ارزش‌های برندتان را با زبان خودتان معرفی کنید.',items:['طراحی با هویت مستقل','توجه به جزئیات','ارتباط مستقیم با شما']}),block('products',{title:'منتخب محصولات',text:'انتخاب‌هایی با شخصیت.'}),block('text',{title:'داستان ما، از یک ایده شروع شد.',text:'از مسیر کسب‌وکارتان بگویید؛ چه چیزی برایتان مهم است و چه تجربه‌ای برای مشتری می‌سازید؟'}),contact],
 catalog:[block('hero',{title:name,text:'انتخاب درست از یک ویترین روشن شروع می‌شود. محصولات را ببینید، مقایسه کنید و انتخاب کنید.',button:'دیدن ویترین',url:'#products'}),block('products',{title:'ویترین فروشگاه',text:'محصول مورد نظرتان را پیدا کنید.'}),block('features',{title:'خرید با خیال روشن',text:'مزیت‌های واقعی فروشگاهتان را اینجا معرفی کنید.',items:['اطلاعات دقیق محصول','انتخاب و مقایسهٔ آسان','پیگیری سفارش از فروشگاه']}),block('contact',{...contact,title:'برای انتخاب، کنارتان هستیم.'})],
 consultant:[block('hero',{title:name,text:'از اولین پرسش تا تصمیم بعدی، همراه شما هستیم. خدمات، تخصص و مسیر همکاری ما را بشناسید.',button:'آشنایی با خدمات',url:'#services'}),block('text',{title:'مسئلهٔ شما، نقطهٔ شروع ماست.',text:'حوزهٔ تخصص و روش کار خود را توضیح دهید تا بازدیدکننده بداند برای چه نیازی می‌تواند با شما ارتباط بگیرد.'}),block('features',{title:'مسیر همکاری',text:'از شناخت نیاز تا راه‌حل قابل اجرا.',items:['گفت‌وگو و شناخت نیاز','طراحی مسیر پیشنهادی','اجرا و پیگیری نتیجه']}),block('products',{title:'خدمات و محصولات',text:'راه‌حل مناسب نیازتان را انتخاب کنید.'}),block('contact',{...contact,title:'قدم بعدی را با هم برداریم.'})]
 };
 const id=templates.some(t=>t.id===template)?template:'studio';
 return {template:id,color:templates.find(t=>t.id===id).color,description:'',pages:[{id:uid(),slug:'',title:'خانه',blocks:presets[id]}]};
}
export function safeUrl(value){const s=String(value||'').trim();return /^(https?:\/\/|mailto:|tel:|#|\/(?!\/))/i.test(s)?s:''}
export function normalizeDocument(value){const d=value&&typeof value==='object'?value:{};return {template:templates.some(t=>t.id===d.template)?d.template:'studio',color:/^#[0-9a-f]{6}$/i.test(d.color||'')?d.color:'#ff642d',description:String(d.description||'').slice(0,300),pages:(Array.isArray(d.pages)?d.pages:[]).filter(p=>p&&typeof p==='object').slice(0,20).map((p,i)=>({id:String(p.id||i),title:String(p.title||'صفحه').slice(0,120),slug:i===0?'':/^[a-z0-9-]{1,48}$/.test(p.slug||'')?p.slug:'page-'+i,blocks:(Array.isArray(p.blocks)?p.blocks:[]).slice(0,30).filter(b=>blockLabels[b?.type]).map((b,j)=>({id:String(b.id||j),type:b.type,title:String(b.title||'').slice(0,180),text:String(b.text||'').slice(0,4000),button:String(b.button||'').slice(0,80),url:safeUrl(b.url),image:/^https:\/\//i.test(b.image||'')?String(b.image).slice(0,2048):'',items:(Array.isArray(b.items)?b.items:[]).slice(0,12).map(s=>String(s).slice(0,240))}))}))}}

// Enable only after builder-free-plan.sql is approved and verified on the database.
export const FREE_BUILDER_ENABLED=false;
import {normalizeDesign} from './builder-design';
export const SITE_BUILDER_PRODUCT='38ba2004-0021-4717-b06f-dc21493b83b5';
export const templates=[
 {id:'studio',name:'قالب آوان',description:'جسور و تحریریه‌ای؛ تیترهای درشت، بنفش و لیمویی، چیدمان نامتقارن برای برندهای خلاق',color:'#7c3aed'},
 {id:'catalog',name:'قالب ویترین',description:'فروشگاه گرم و محصول‌محور؛ ویترین دو ستونه، کارت‌های منظم و رنگ آجری',color:'#e85130'},
 {id:'consultant',name:'قالب سپهر',description:'خدمات و مشاوره؛ طراحی آبی، معرفی فرایند همکاری و دعوت روشن به ارتباط',color:'#2563eb'}
];
export const blockLabels={hero:'بخش اصلی',text:'متن و توضیحات',features:'ویژگی‌ها',contact:'اطلاعات تماس',image:'تصویر',products:'محصولات فروشگاه',heading:'عنوان',button:'دکمه',divider:'خط جداکننده',spacer:'فاصلهٔ خالی',faq:'سوالات متداول',testimonials:'نظر مشتریان',stats:'آمار و اعداد',pricing:'جدول تعرفه‌ها',steps:'مراحل همکاری',team:'اعضای تیم',gallery:'گالری تصاویر',video:'ویدیو',quote:'نقل‌قول',checklist:'لیست مزایا',alert:'نوار اطلاع‌رسانی',logos:'لوگوهای همکاران',links:'لینک‌های اجتماعی',hours:'ساعات کاری',progress:'نوار پیشرفت',table:'جدول مقایسه'};
export const uid=()=>globalThis.crypto.randomUUID();
export const elementGroups={basic:'پایه',media:'رسانه',business:'کسب‌وکار',engagement:'ارتباط'};
export const elementMeta={
 hero:{group:'basic'},text:{group:'basic'},heading:{group:'basic'},button:{group:'basic'},divider:{group:'basic'},spacer:{group:'basic'},features:{group:'business'},products:{group:'business'},contact:{group:'engagement'},image:{group:'media'},
 faq:{group:'engagement',description:'پرسش و پاسخ بازشونده',hint:'پرسش | پاسخ',items:['چطور سفارش بدهم؟ | محصول را انتخاب کنید و به سبد خرید اضافه کنید.','ارسال چقدر طول می‌کشد؟ | زمان ارسال را قبل از خرید با ما هماهنگ کنید.']},
 testimonials:{group:'engagement',description:'تجربهٔ مشتریان شما',hint:'نظر | نام مشتری | عنوان یا شهر',items:['نظر واقعی مشتری را اینجا وارد کنید. | نام مشتری | شهر یا عنوان']},
 stats:{group:'business',description:'عددهای مهم کسب‌وکار',hint:'عدد | عنوان',items:['۱۰+ | سال تجربه','۲۴ | ساعت پاسخ‌گویی','۳ | شعبه']},
 pricing:{group:'business',description:'کارت‌های قیمت و خدمات',hint:'نام طرح | قیمت | توضیح',items:['پایه | تماس بگیرید | مناسب شروع کسب‌وکار','حرفه‌ای | تماس بگیرید | خدمات گسترده‌تر']},
 steps:{group:'business',description:'مسیر همکاری قدم به قدم',hint:'عنوان مرحله | توضیح',items:['گفت‌وگوی اولیه | نیاز شما را می‌شناسیم.','برنامه‌ریزی | مسیر انجام کار را مشخص می‌کنیم.','اجرا و تحویل | نتیجه را بررسی و تحویل می‌دهیم.']},
 team:{group:'business',description:'معرفی اعضای کسب‌وکار',hint:'نام | سمت | توضیح',items:['نام همکار | مدیر فروش | معرفی کوتاه همکار']},
 gallery:{group:'media',description:'تصاویر با توضیح',hint:'آدرس HTTPS تصویر | توضیح تصویر',items:[]},
 video:{group:'media',description:'پخش فایل ویدیویی',hint:'لینک مستقیم MP4 یا WebM؛ لینک صفحهٔ یوتیوب نیست.'},
 quote:{group:'basic',description:'نقل‌قول برجسته'},
 checklist:{group:'business',description:'مزایا با علامت تایید',hint:'هر مزیت در یک ردیف',items:['اطلاعات شفاف','پیگیری آسان','پاسخ‌گویی مستقیم']},
 alert:{group:'engagement',description:'خبر، تخفیف یا اطلاعیه'},
 logos:{group:'media',description:'تصویر برندها و همکاران',hint:'آدرس HTTPS لوگو | نام برند',items:[]},
 links:{group:'engagement',description:'شبکه‌های اجتماعی و لینک‌ها',hint:'نام لینک | آدرس کامل',items:['تماس با ما | tel:09123456789','اینستاگرام | https://instagram.com/']},
 hours:{group:'engagement',description:'روزها و زمان پاسخ‌گویی',hint:'روز | ساعت',items:['شنبه تا چهارشنبه | ۹ تا ۱۸','پنجشنبه | ۹ تا ۱۳','جمعه | تعطیل']},
 progress:{group:'business',description:'مهارت‌ها و درصد پیشرفت',hint:'عنوان | درصد از ۰ تا ۱۰۰',items:['عنوان مهارت | ۸۰','پیشرفت پروژه | ۶۰']},
 table:{group:'business',description:'مقایسهٔ مشخصات و خدمات',hint:'سلول‌ها را با | جدا کن؛ ردیف اول عنوان ستون‌هاست.',items:['ویژگی | پایه | حرفه‌ای','پشتیبانی | عادی | اختصاصی','زمان تحویل | توافقی | توافقی']}
};
export function newBlock(type){return {id:uid(),type,title:type==='hero'?'کسب‌وکارت را معرفی کن':type==='products'?'محصولات فروشگاه':elementMeta[type]?.description?blockLabels[type]:'عنوان بخش',text:'توضیح کوتاه این بخش را بنویس.',button:'بیشتر بدانید',url:'#contact',items:[...(elementMeta[type]?.items||['ویژگی اول','ویژگی دوم','ویژگی سوم'])],image:'',style:{},mobileStyle:{}}}
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
export function normalizeDocument(value){const d=value&&typeof value==='object'?value:{};return {template:templates.some(t=>t.id===d.template)?d.template:'studio',color:/^#[0-9a-f]{6}$/i.test(d.color||'')?d.color:'#ff642d',description:String(d.description||'').slice(0,300),pages:(Array.isArray(d.pages)?d.pages:[]).filter(p=>p&&typeof p==='object').slice(0,20).map((p,i)=>({id:String(p.id||i),title:String(p.title||'صفحه').slice(0,120),slug:i===0?'':/^[a-z0-9-]{1,48}$/.test(p.slug||'')?p.slug:'page-'+i,columns:[1,2,3,4].includes(p.columns)?p.columns:1,gap:Number.isFinite(Number(p.gap))?Math.max(0,Math.min(80,Number(p.gap))):0,blocks:(Array.isArray(p.blocks)?p.blocks:[]).slice(0,30).filter(b=>blockLabels[b?.type]).map((b,j)=>({id:String(b.id||j),type:b.type,style:normalizeDesign(b.style),mobileStyle:normalizeDesign(b.mobileStyle),title:String(b.title||'').slice(0,180),text:String(b.text||'').slice(0,4000),button:String(b.button||'').slice(0,80),url:safeUrl(b.url),image:/^https:\/\//i.test(b.image||'')?String(b.image).slice(0,2048):'',items:(Array.isArray(b.items)?b.items:[]).slice(0,12).map(s=>String(s).slice(0,['gallery','logos','links'].includes(b.type)?2200:600))}))}))}}

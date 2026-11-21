// Free enrollment and server-side quota verified on the database.
export const FREE_BUILDER_ENABLED=true;
import {normalizeDesign} from './builder-design';
import {industryById,normalizeIndustry} from './builder-industries';
import {templateById,isKnownTemplate,DEFAULT_TEMPLATE} from './builder-templates';
import {normalizeFonts} from './builder-fonts';
import {normalizeSurface} from './builder-surfaces';
// Language of a site (document.lang): drives the template copy, storefront labels and text direction.
// Keep in sync with LOCALES in lib/i18n/config.js (checked by supabase/tests/site-i18n.test.cjs).
const SITE_LANGS=['fa','en','ar','tr'];
// Marks Persian UI text that the editor translates when it displays it (see lib/i18n/config.js).
const tx=s=>s;
export const normalizeLang=v=>SITE_LANGS.includes(v)?v:'fa';
export const SITE_BUILDER_PRODUCT='38ba2004-0021-4717-b06f-dc21493b83b5';
export {templates,legacyTemplates,allTemplates,templateById,isKnownTemplate,isV2,DEFAULT_TEMPLATE} from './builder-templates';
export const blockLabels={hero:tx('بخش اصلی'),text:tx('متن و توضیحات'),features:tx('ویژگی‌ها'),contact:tx('اطلاعات تماس'),image:tx('تصویر'),products:tx('محصولات فروشگاه'),heading:tx('عنوان'),button:tx('دکمه'),divider:tx('خط جداکننده'),spacer:tx('فاصلهٔ خالی'),faq:tx('سوالات متداول'),testimonials:tx('نظر مشتریان'),stats:tx('آمار و اعداد'),pricing:tx('جدول تعرفه‌ها'),steps:tx('مراحل همکاری'),team:tx('اعضای تیم'),gallery:tx('گالری تصاویر'),video:tx('ویدیو'),quote:tx('نقل‌قول'),checklist:tx('لیست مزایا'),alert:tx('نوار اطلاع‌رسانی'),logos:tx('لوگوهای همکاران'),links:tx('لینک‌های اجتماعی'),hours:tx('ساعات کاری'),progress:tx('نوار پیشرفت'),table:tx('جدول مقایسه'),bookSpotlight:tx('کتاب هفته'),authorSpotlight:tx('نویسندهٔ ویژه'),marquee:tx('نوار متحرک'),banner:tx('بنر تبلیغاتی'),timeline:tx('خط زمان')};
export const uid=()=>globalThis.crypto.randomUUID();
// Animation intensity of a published site. Existing sites without the field get the gentlest level.
export const motionLevels=[{id:'simple',name:'ساده',description:'ظریف و کم‌حرکت'},{id:'balanced',name:'متعادل',description:'ورود تدریجی و حرکت نرم'},{id:'cinematic',name:'سینمایی',description:'حرکت عمیق‌تر و محو‌شدگی'}];
export const elementGroups={basic:tx('پایه'),media:tx('رسانه'),business:tx('کسب‌وکار'),engagement:tx('ارتباط'),books:tx('کتاب')};
export const elementMeta={
 hero:{group:'basic'},text:{group:'basic'},heading:{group:'basic'},button:{group:'basic'},divider:{group:'basic'},spacer:{group:'basic'},features:{group:'business'},products:{group:'business'},contact:{group:'engagement'},image:{group:'media'},
 faq:{group:'engagement',description:tx('پرسش و پاسخ بازشونده'),hint:tx('پرسش | پاسخ'),items:['چطور سفارش بدهم؟ | محصول را انتخاب کنید و به سبد خرید اضافه کنید.','ارسال چقدر طول می‌کشد؟ | زمان ارسال را قبل از خرید با ما هماهنگ کنید.']},
 testimonials:{group:'engagement',description:tx('تجربهٔ مشتریان شما'),hint:tx('نظر | نام مشتری | عنوان یا شهر'),items:['نظر واقعی مشتری را اینجا وارد کنید. | نام مشتری | شهر یا عنوان']},
 stats:{group:'business',description:tx('عددهای مهم کسب‌وکار'),hint:tx('عدد | عنوان'),items:['۱۰+ | سال تجربه','۲۴ | ساعت پاسخ‌گویی','۳ | شعبه']},
 pricing:{group:'business',description:tx('کارت‌های قیمت و خدمات'),hint:tx('نام طرح | قیمت | توضیح'),items:['پایه | تماس بگیرید | مناسب شروع کسب‌وکار','حرفه‌ای | تماس بگیرید | خدمات گسترده‌تر']},
 steps:{group:'business',description:tx('مسیر همکاری قدم به قدم'),hint:tx('عنوان مرحله | توضیح'),items:['گفت‌وگوی اولیه | نیاز شما را می‌شناسیم.','برنامه‌ریزی | مسیر انجام کار را مشخص می‌کنیم.','اجرا و تحویل | نتیجه را بررسی و تحویل می‌دهیم.']},
 team:{group:'business',description:tx('معرفی اعضای کسب‌وکار'),hint:tx('نام | سمت | توضیح'),items:['نام همکار | مدیر فروش | معرفی کوتاه همکار']},
 gallery:{group:'media',description:tx('تصاویر با توضیح'),hint:tx('آدرس HTTPS تصویر | توضیح تصویر'),items:[]},
 video:{group:'media',description:tx('پخش فایل ویدیویی'),hint:tx('لینک مستقیم MP4 یا WebM؛ لینک صفحهٔ یوتیوب نیست.')},
 quote:{group:'basic',description:tx('نقل‌قول برجسته')},
 checklist:{group:'business',description:tx('مزایا با علامت تایید'),hint:tx('هر مزیت در یک ردیف'),items:['اطلاعات شفاف','پیگیری آسان','پاسخ‌گویی مستقیم']},
 alert:{group:'engagement',description:tx('خبر، تخفیف یا اطلاعیه')},
 logos:{group:'media',description:tx('تصویر برندها و همکاران'),hint:tx('آدرس HTTPS لوگو | نام برند'),items:[]},
 links:{group:'engagement',description:tx('شبکه‌های اجتماعی و لینک‌ها'),hint:tx('نام لینک | آدرس کامل'),items:['تماس با ما | tel:09123456789','اینستاگرام | https://instagram.com/']},
 hours:{group:'engagement',description:tx('روزها و زمان پاسخ‌گویی'),hint:tx('روز | ساعت'),items:['شنبه تا چهارشنبه | ۹ تا ۱۸','پنجشنبه | ۹ تا ۱۳','جمعه | تعطیل']},
 progress:{group:'business',description:tx('مهارت‌ها و درصد پیشرفت'),hint:tx('عنوان | درصد از ۰ تا ۱۰۰'),items:['عنوان مهارت | ۸۰','پیشرفت پروژه | ۶۰']},
 table:{group:'business',description:tx('مقایسهٔ مشخصات و خدمات'),hint:tx('سلول‌ها را با | جدا کن؛ ردیف اول عنوان ستون‌هاست.'),items:['ویژگی | پایه | حرفه‌ای','پشتیبانی | عادی | اختصاصی','زمان تحویل | توافقی | توافقی']},
 marquee:{group:'media',description:tx('نوار متحرک شعار و خبر'),hint:tx('هر عبارت در یک ردیف؛ نوار به‌صورت پیوسته می‌چرخد.'),items:['فروش ویژه','ارسال رایگان','گارانتی اصالت','پشتیبانی ۲۴ ساعته']},
 banner:{group:'engagement',description:tx('بنر تمام‌عرض با دکمه'),hint:tx('عنوان، توضیح، دکمه و تصویر پس‌زمینه (اختیاری) از پنل محتوا.'),items:[]},
 timeline:{group:'business',description:tx('مسیر و رویدادها به ترتیب زمان'),hint:tx('سال یا عنوان کوتاه | عنوان | توضیح'),items:['۱۳۹۸ | شروع | اولین قدم‌ها را برداشتیم.','۱۴۰۱ | رشد | تیم و محصولات بزرگ‌تر شد.','امروز | ادامه | هر روز بهتر از دیروز.']},
 bookSpotlight:{group:'books',description:tx('نمایش ویژهٔ کتاب هفته؛ محصولِ «ویژه» انتخاب می‌شود'),hint:tx('کتاب از محصولات فروشگاه با گزینهٔ «محصول ویژه» خوانده می‌شود.'),items:[]},
 authorSpotlight:{group:'books',description:tx('معرفی نویسنده و کتاب‌هایش در فروشگاه'),hint:tx('نام نویسنده را در عنوان بنویسید؛ کتاب‌ها از فیلد «نویسنده» محصولات پیدا می‌شوند.'),items:[]}
};
// `tr` (optional) translates the Persian default copy into the site's language (see starter()).
export function newBlock(type,tr=s=>s){
 const part=s=>{const whole=tr(s);return whole!==s?whole:s.split(' | ').map(tr).join(' | ')};
 return {id:uid(),type,title:tr(type==='hero'?'کسب‌وکارت را معرفی کن':type==='products'?'محصولات فروشگاه':elementMeta[type]?.description?blockLabels[type]:'عنوان بخش'),text:tr('توضیح کوتاه این بخش را بنویس.'),button:tr('بیشتر بدانید'),url:'#contact',items:[...(elementMeta[type]?.items||['ویژگی اول','ویژگی دوم','ویژگی سوم'])].map(part),image:'',style:{},mobileStyle:{}}
}
// `lang`/`messages`: starter copy is written in Persian and translated with the site dictionary (messages[persian]).
export function starter(template,name,industry,lang='fa',messages=null){
 const tr=s=>messages&&Object.prototype.hasOwnProperty.call(messages,s)?messages[s]:s;
 const block=(type,fields)=>({...newBlock(type),...fields});
 const contact=block('contact',{title:'گفت‌وگو را شروع کنیم',text:'برای پرسش دربارهٔ محصولات و خدمات، اطلاعات تماس خود را در این بخش قرار دهید.',button:'ارتباط با ما',url:''});
 const presets={
 studio:[block('hero',{title:name,text:'ایده‌های خوب، شایستهٔ یک تجربهٔ متفاوت‌اند. محصولات و خدمات ما را از نزدیک بشناسید.',button:'کشف محصولات',url:'#products'}),block('features',{title:'اینجا، متفاوت فکر می‌کنیم.',text:'ارزش‌های برندتان را با زبان خودتان معرفی کنید.',items:['طراحی با هویت مستقل','توجه به جزئیات','ارتباط مستقیم با شما']}),block('products',{title:'منتخب محصولات',text:'انتخاب‌هایی با شخصیت.'}),block('text',{title:'داستان ما، از یک ایده شروع شد.',text:'از مسیر کسب‌وکارتان بگویید؛ چه چیزی برایتان مهم است و چه تجربه‌ای برای مشتری می‌سازید؟'}),contact],
 catalog:[block('hero',{title:name,text:'انتخاب درست از یک ویترین روشن شروع می‌شود. محصولات را ببینید، مقایسه کنید و انتخاب کنید.',button:'دیدن ویترین',url:'#products'}),block('products',{title:'ویترین فروشگاه',text:'محصول مورد نظرتان را پیدا کنید.'}),block('features',{title:'خرید با خیال روشن',text:'مزیت‌های واقعی فروشگاهتان را اینجا معرفی کنید.',items:['اطلاعات دقیق محصول','انتخاب و مقایسهٔ آسان','پیگیری سفارش از فروشگاه']}),block('contact',{...contact,title:'برای انتخاب، کنارتان هستیم.'})],
 consultant:[block('hero',{title:name,text:'از اولین پرسش تا تصمیم بعدی، همراه شما هستیم. خدمات، تخصص و مسیر همکاری ما را بشناسید.',button:'آشنایی با خدمات',url:'#services'}),block('text',{title:'مسئلهٔ شما، نقطهٔ شروع ماست.',text:'حوزهٔ تخصص و روش کار خود را توضیح دهید تا بازدیدکننده بداند برای چه نیازی می‌تواند با شما ارتباط بگیرد.'}),block('features',{title:'مسیر همکاری',text:'از شناخت نیاز تا راه‌حل قابل اجرا.',items:['گفت‌وگو و شناخت نیاز','طراحی مسیر پیشنهادی','اجرا و پیگیری نتیجه']}),block('products',{title:'خدمات و محصولات',text:'راه‌حل مناسب نیازتان را انتخاب کنید.'}),block('contact',{...contact,title:'قدم بعدی را با هم برداریم.'})],
 editorial:[block('hero',{title:name,text:'کتاب‌ها، نویسنده‌ها و گفت‌وگوهایی که ارزش خواندن دارند؛ هر هفته با یک پیشنهاد تازه.',button:'مرور قفسه‌ها',url:'#products'}),block('bookSpotlight',{title:'کتاب هفته',text:'دربارهٔ کتابی که این هفته پیشنهاد می‌کنید بنویسید: چرا خواندنش ارزش دارد و برای چه کسی مناسب است.'}),block('products',{title:'تازه‌های قفسه',text:'منتخب کتاب‌های موجود فروشگاه.'}),block('authorSpotlight',{title:'نام نویسنده',text:'معرفی کوتاه نویسندهٔ ویژه و آثارش در فروشگاه.'}),block('features',{title:'چرا از ما بخوانید؟',text:'',items:['انتخاب دقیق و اطلاعات شفاف','نسخه و ناشر هر کتاب مشخص است','ارسال و پیگیری مطمئن']}),block('faq',{title:'پیش از خرید',text:'پرسش‌های رایج دربارهٔ نسخه، چاپ و ارسال.'}),contact],
 commerce:[block('hero',{title:name,text:'همه‌چیز برای انتخاب سریع: جست‌وجو، فیلتر و خرید در چند کلیک.',button:'دیدن همهٔ محصولات',url:'#products'}),block('products',{title:'ویترین فروشگاه',text:'پرفروش‌ها، تازه‌ها و تخفیف‌ها در یک نگاه.'}),block('features',{title:'خرید با خیال راحت',text:'',items:['ارسال سریع','پرداخت امن','پشتیبانی واقعی']}),block('faq',{title:'پرسش‌های خرید',text:'پاسخ پرسش‌های رایج را متناسب با فروشگاه خود ویرایش کنید.'}),contact],
 cinematic:[block('hero',{title:name,text:'کتاب‌ها را مثل یک فیلم خوب کشف کنید: جلدها، قصه‌ها و تجربه‌ای فراموش‌نشدنی.',button:'شروع تماشا',url:'#products'}),block('bookSpotlight',{title:'کتاب هفته',text:'دربارهٔ کتاب ویژه‌ای که این هفته روی پرده است بنویسید.'}),block('products',{title:'روی پرده',text:'کتاب‌های منتخب فروشگاه.'}),block('features',{title:'تجربهٔ ما',text:'',items:['انتخاب‌شده با وسواس','جلدها و نسخه‌های اصل','ارسال مطمئن']}),contact]
 };
 const retail={
 atelier:['استایل خودت را پیدا کن.','پوشاک و اکسسوری را با توجه به جزئیات انتخاب کنید.','مجموعهٔ تازه','انتخاب آگاهانه',['راهنمای اندازه','جزئیات جنس و دوخت','پاسخ‌گویی دربارهٔ سفارش']],
 tech:['انتخاب هوشمند، هر روز.','مشخصات را بررسی کنید و ابزار مناسب نیازتان را پیدا کنید.','ویترین دیجیتال','قبل از خرید، مقایسه کنید.',['مشخصات دقیق','مقایسهٔ مدل‌ها','راهنمای انتخاب']],
 botanical:['از طبیعت، برای زندگی.','محصولات طبیعی را با شناخت ترکیبات و کاربردشان انتخاب کنید.','انتخاب‌های طبیعی','داستان هر محصول',['معرفی ترکیبات','راهنمای مصرف','شرایط نگهداری']],
 jewel:['جزئیاتی که می‌درخشند.','زیورآلات و اکسسوری برای لحظه‌ها و سلیقهٔ شما.','مجموعهٔ منتخب','انتخابی با توجه به جزئیات',['اطلاعات متریال','راهنمای اندازه','شرایط نگهداری']],
 home:['خانه‌ای به سلیقهٔ تو.','دکور و لوازم کاربردی برای فضایی که دوستش دارید.','ویترین خانه','هماهنگ با فضای شما',['ابعاد دقیق','معرفی متریال','راهنمای چیدمان']],
 sport:['برای حرکت بعدی آماده‌ای؟','پوشاک و تجهیزات مناسب تمرین و مسیرتان را انتخاب کنید.','تجهیزات حرکت','آمادهٔ انتخاب',['راهنمای اندازه','مشخصات کاربردی','انتخاب مناسب تمرین']]
 };
 if(retail[template]){const [title,text,productsTitle,featuresTitle,items]=retail[template];const hero=block('hero',{title,text,button:'دیدن محصولات',url:'#products'}),products=block('products',{title:productsTitle,text:'محصولات منتشرشدهٔ فروشگاه اینجا نمایش داده می‌شوند.'}),features=block('features',{title:featuresTitle,text:'اطلاعات و خدمات واقعی فروشگاهتان را معرفی کنید.',items}),story=block('text',{title:'دربارهٔ '+name,text:'داستان برند، معیار انتخاب محصولات و ارزش‌های فروشگاهتان را اینجا بنویسید.'}),faq=block('faq',{title:'پیش از خرید',text:'پاسخ‌های فروشگاهتان را متناسب با شرایط واقعی ویرایش کنید.'});
 presets[template]=template==='atelier'?[hero,story,products,features,contact]:template==='tech'?[hero,features,products,faq,contact]:template==='botanical'?[hero,features,story,products,contact]:template==='jewel'?[hero,products,story,faq,contact]:template==='home'?[hero,story,features,products,contact]:[hero,products,features,faq,contact];}
 const meta=templateById(template);
 // Current templates are built from a recipe (block order) plus their own copy; the legacy ones keep their presets.
 if(meta?.recipe){const c=meta.copy,make={
  hero:()=>block('hero',{title:name,text:c.hero,button:c.button,url:'#products'}),
  products:()=>block('products',{title:c.productsTitle,text:c.productsText}),
  features:()=>block('features',{title:c.featuresTitle,text:'',items:c.featuresItems}),
  text:()=>block('text',{title:c.storyTitle||tr('دربارهٔ {name}').replace('{name}',name),text:c.storyText||'داستان برند، معیار انتخاب محصولات و ارزش‌های فروشگاهتان را اینجا بنویسید.'}),
  quote:()=>block('quote',{title:c.quoteBy||name,text:c.quote||''}),
  contact:()=>contact};
  presets[template]=meta.recipe.map(t=>(make[t]||(()=>block(t,{})))());}
 const id=isKnownTemplate(template)?template:DEFAULT_TEMPLATE,ind=industryById(industry);
 // Industry copy and starter blocks are applied on top of the template layout; the template stays independent.
 let blocks=presets[id];
 if(ind.id!=='general'){
  blocks=blocks.map(b=>b.type==='features'&&ind.copy.featuresTitle?{...b,title:ind.copy.featuresTitle,items:ind.copy.featuresItems||b.items}:b.type==='products'&&ind.copy.productsTitle?{...b,title:ind.copy.productsTitle}:b);
  for(const extra of ind.extraBlocks){
   if(blocks.some(b=>b.type===extra.type))continue;
   const at=blocks.map(b=>b.type).lastIndexOf('contact'),added=block(extra.type,{title:extra.title,text:extra.text||'',items:extra.items||[]});
   blocks=at<0?[...blocks,added]:[...blocks.slice(0,at),added,...blocks.slice(at)];
  }
 }
 if(messages){const items=a=>(a||[]).map(x=>String(x).split(' | ').map(tr).join(' | '));blocks=blocks.map(b=>({...b,title:b.title===name?b.title:tr(b.title),text:tr(b.text),button:tr(b.button),items:items(b.items)}))}
 return {lang:normalizeLang(lang),template:id,industry:ind.id,color:templateById(id).color,description:'',motion:'balanced',fonts:{display:'',body:''},surface:'',pages:[{id:uid(),slug:'',title:tr('خانه'),blocks}]};
}
export function safeUrl(value){const s=String(value||'').trim();return /^(https?:\/\/|mailto:|tel:|#|\/(?!\/))/i.test(s)?s:''}
export function normalizeDocument(value){const d=value&&typeof value==='object'?value:{};return {lang:normalizeLang(d.lang),template:isKnownTemplate(d.template)?d.template:'studio',fonts:normalizeFonts(d.fonts),surface:normalizeSurface(d.surface),color:/^#[0-9a-f]{6}$/i.test(d.color||'')?d.color:'#ff642d',motion:motionLevels.some(m=>m.id===d.motion)?d.motion:'simple',industry:normalizeIndustry(d.industry),description:String(d.description||'').slice(0,300),pages:(Array.isArray(d.pages)?d.pages:[]).filter(p=>p&&typeof p==='object').slice(0,20).map((p,i)=>({id:String(p.id||i),title:String(p.title||'صفحه').slice(0,120),description:String(p.description||'').slice(0,300),slug:i===0?'':/^[a-z0-9-]{1,48}$/.test(p.slug||'')?p.slug:'page-'+i,columns:[1,2,3,4].includes(p.columns)?p.columns:1,gap:Number.isFinite(Number(p.gap))?Math.max(0,Math.min(80,Number(p.gap))):0,blocks:(Array.isArray(p.blocks)?p.blocks:[]).slice(0,30).filter(b=>blockLabels[b?.type]).map((b,j)=>({id:String(b.id||j),type:b.type,style:normalizeDesign(b.style),mobileStyle:normalizeDesign(b.mobileStyle),title:String(b.title||'').slice(0,180),text:String(b.text||'').slice(0,4000),button:String(b.button||'').slice(0,80),url:safeUrl(b.url),image:/^https:\/\//i.test(b.image||'')?String(b.image).slice(0,2048):'',items:(Array.isArray(b.items)?b.items:[]).slice(0,12).map(s=>String(s).slice(0,['gallery','logos','links'].includes(b.type)?2800:elementMeta[b.type]?.hint?2000:600))}))}))}}

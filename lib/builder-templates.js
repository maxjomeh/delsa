// Template catalog of the site builder.
//  - `templates`: the current collection (v2). Every entry has its own typography, palette, layout, artwork and motion
//    (components/templates-v2/<id>.css). Only these are offered when a site is created or restyled.
//  - `legacyTemplates`: the earlier collection. They stay renderable so published sites keep their look until their
//    owner moves them to a new template; they are never offered for new sites.
// `fonts` are registry ids (lib/builder-fonts.js) and document the default pairing used by the template CSS.
export const templates=[
 {id:'zarrin',name:'زرنگار',description:'لوکس و زرین؛ زمینهٔ شب، حلقهٔ طلایی چرخان، خطوط ظریف و قاب‌های محراب‌دار',color:'#d4af37',
  tagline:'زیورآلات، ساعت و هدیه‌های ماندگار',signature:'زر · ظرافت · ماندگاری',fonts:{display:'aref-ruqaa',body:'vazirmatn',accent:'cinzel'},
  recipe:['hero','products','quote','features','testimonials','contact'],
  copy:{hero:'درخششی که به نگاه اول یادت می‌ماند. مجموعه‌ای دست‌چین از جزئیات ناب برای لحظه‌های ویژه.',button:'مشاهدهٔ مجموعه',productsTitle:'مجموعهٔ منتخب',productsText:'قطعه‌هایی با وسواس انتخاب شده‌اند.',featuresTitle:'چرا زرنگار؟',featuresItems:['اصالت و کیفیت تضمین‌شده','بسته‌بندی هدیه','پشتیبانی پس از خرید'],quote:'زیبایی در جزئیات است؛ جزئیات، تفاوت را می‌سازند.',quoteBy:'هنر ما'}},
 {id:'bagh',name:'باغ ایرانی',description:'بوستان و اسلیمی؛ قاب‌های محرابی، برگ‌های شناور و سبز عمیق برای محصولات طبیعی',color:'#2f6b4f',
  tagline:'طبیعت، طعم و آرامش',signature:'برگ · عطر · آرامش',fonts:{display:'markazi',body:'vazirmatn',accent:'mirza'},
  recipe:['hero','features','products','steps','faq','contact'],
  copy:{hero:'از باغ تا خانهٔ شما؛ محصولات طبیعی با طعم و عطر اصیل و داستان روشن.',button:'ورود به باغ',productsTitle:'چیدهٔ تازه',productsText:'محصولات این فصل را ببینید.',featuresTitle:'ارزش‌های باغ',featuresItems:['مزرعه تا مصرف‌کننده','بدون افزودنی','بسته‌بندی بهداشتی'],storyTitle:'داستان ما',storyText:'مسیر هر محصول را از مزرعه تا سفرهٔ شما بنویسید.'}},
 {id:'qalam',name:'قلم و مرکب',description:'ادبی و کاغذی؛ مهر شنگرف، حروف نستعلیق، قفسهٔ کتاب و جوهر روی کاغذ',color:'#b3261e',
  tagline:'کتاب، قلم و فرهنگ',signature:'کتاب · قلم · فرهنگ',fonts:{display:'nastaliq',body:'vazirmatn',accent:'amiri'},
  recipe:['hero','quote','products','text','faq','contact'],
  copy:{hero:'کتابی که انتخاب می‌کنی، بخشی از تو می‌شود. نشر، نویسنده و قفسه‌هایی که می‌ارزند.',button:'مرور قفسه‌ها',productsTitle:'تازه‌های قفسه',productsText:'کتاب‌های منتخب این هفته.',storyTitle:'سخنی با خواننده',storyText:'دربارهٔ سلیقهٔ کتابخانه و معیار انتخاب کتاب‌هایتان بنویسید.',quote:'کتاب، خانه‌ای است که هر بار از نو در آن زندگی می‌کنی.',quoteBy:'کتاب‌فروشی ما'}},
 {id:'shab',name:'شب نئون',description:'آینده‌نگر و نورانی؛ زمینهٔ تاریک، نور دنبال‌کنندهٔ نشانگر، حاشیه‌های درخشان و شبکهٔ فنی',color:'#22d3ee',
  tagline:'فناوری برای نسل بعد',signature:'سریع · دقیق · آینده',fonts:{display:'reem-kufi',body:'vazirmatn',accent:'unbounded'},search:true,
  recipe:['hero','stats','products','features','faq','contact'],
  copy:{hero:'ابزار و کالای دیجیتال با مشخصات شفاف؛ مقایسه کن، انتخاب کن، همین امشب بگیر.',button:'شروع کن',productsTitle:'ویترین دیجیتال',productsText:'جدیدترین مدل‌ها با مشخصات دقیق.',featuresTitle:'چرا از ما بخری؟',featuresItems:['گارانتی معتبر','ارسال همان روز','مشاورهٔ خرید'],}},
 {id:'jashn',name:'جشن رنگ',description:'شاد و بازیگوش؛ رنگ‌های آبنباتی، سایهٔ سخت، برچسب‌های چرخان و حرکت فنری',color:'#ff4f8b',
  tagline:'هدیه، شیرینی و شادی',signature:'رنگ · شادی · هدیه',fonts:{display:'lalezar',body:'vazirmatn',accent:'lemonada'},promo:true,
  recipe:['hero','products','features','testimonials','faq','contact'],
  copy:{hero:'همه‌چیز برای ساختن یک روز شاد! هدیه، شیرینی و سورپرایزهای رنگی.',button:'بریم سراغ هدیه‌ها',productsTitle:'پرطرفدارها',productsText:'انتخاب‌های شاد و رنگی.',featuresTitle:'بسته‌بندی شاد',featuresItems:['کارت تبریک رایگان','بسته‌بندی هدیه','ارسال سریع']}},
 {id:'sang',name:'سنگ و بتن',description:'برنالیستی و معماری؛ شبکهٔ خشن، شماره‌گذاری، لبه‌های تیز و پنل‌های لغزنده',color:'#ff5a1f',
  tagline:'فضا، متریال و ساختار',signature:'ساختار · متریال · فضا',fonts:{display:'kufam',body:'vazirmatn',accent:'bebas'},
  recipe:['hero','text','features','products','stats','contact'],
  copy:{hero:'دکور، مبلمان و متریال برای ساختن فضایی که می‌ماند؛ ساده، محکم و دقیق.',button:'مشاهدهٔ پروژه‌ها',productsTitle:'کاتالوگ',productsText:'محصولات با ابعاد و متریال دقیق.',featuresTitle:'روش کار',featuresItems:['اندازه‌گیری و مشاوره','انتخاب متریال','نصب و تحویل'],storyTitle:'دربارهٔ ما',storyText:'فلسفهٔ طراحی و ساخت کارتان را بنویسید.'}},
 {id:'deco',name:'آرت‌دکو',description:'شیک و هندسی؛ پرتو آفتاب، قاب‌های پله‌ای، برنج و فیروزه‌ای برای کافه و رستوران',color:'#c9a227',
  tagline:'کافه، رستوران و میزبانی',signature:'ذوق · میزبانی · شب‌های خوب',fonts:{display:'el-messiri',body:'vazirmatn',accent:'limelight'},
  recipe:['hero','text','products','hours','testimonials','contact'],
  copy:{hero:'میزبانی با ذوق و منویی که حالتان را خوب می‌کند. شب‌های ما را از نزدیک ببینید.',button:'دیدن منو',productsTitle:'منوی ویژه',productsText:'انتخاب سرآشپز این هفته.',storyTitle:'داستان این خانه',storyText:'از ایده، مواد اولیه و فضای مجموعهٔ خود بنویسید.'}},
 {id:'noor',name:'نور و شیشه',description:'رؤیایی و شیشه‌ای؛ شفق‌های شناور، پنل‌های مات و حرکت نرم برای زیبایی و سلامت',color:'#a78bfa',
  tagline:'زیبایی، مراقبت و آرامش',signature:'نور · نرمی · مراقبت',fonts:{display:'harmattan',body:'vazirmatn',accent:'cormorant'},
  recipe:['hero','features','products','steps','testimonials','contact'],
  copy:{hero:'مراقبتی که از پوست شروع می‌شود و تا حس خوب ادامه دارد. ملایم، مؤثر و ایمن.',button:'کشف محصولات',productsTitle:'مجموعهٔ مراقبت',productsText:'محصولات پرفروش و تازه‌ها.',featuresTitle:'وعدهٔ ما',featuresItems:['ترکیبات ایمن','مناسب پوست حساس','تست‌شده'],}},
 {id:'pars',name:'گلیم پارس',description:'سنتی و اصیل؛ نقش ترنج و گلیم، لاجورد و قرمز روناسی، حاشیه‌های رقصان',color:'#a3242b',
  tagline:'هنر دست، ادویه و میراث',signature:'اصالت · دستکاری · میراث',fonts:{display:'amiri',body:'vazirmatn',accent:'katibeh'},
  recipe:['hero','text','products','features','faq','contact'],
  copy:{hero:'هنر دست ایرانی و محصولات اصیل؛ هر قطعه داستانی از خاک و دست دارد.',button:'دیدن گنجینه',productsTitle:'گنجینه',productsText:'دست‌ساخته‌ها و محصولات اصیل.',featuresTitle:'اصالت ما',featuresItems:['دست‌ساز و اصیل','منبع شناخته‌شده','بسته‌بندی محافظ'],storyTitle:'از ریشه‌ها',storyText:'خاستگاه و روش تولید محصولاتتان را بنویسید.'}},
 {id:'sorat',name:'سرعت',description:'پرانرژی و مورب؛ برش‌های تند، خطوط سرعت، نوار متحرک و شمارندهٔ پویا برای ورزش و خودرو',color:'#ffd400',
  tagline:'قطعات، تجهیزات و عملکرد',signature:'قدرت · سرعت · کنترل',fonts:{display:'changa',body:'vazirmatn',accent:'bebas'},search:true,promo:true,
  recipe:['hero','stats','products','features','faq','contact'],
  copy:{hero:'قطعه و تجهیزاتی که عملکرد را بالا می‌برند. انتخاب دقیق، تحویل سریع.',button:'شروع کن',productsTitle:'پرفروش‌ها',productsText:'محصولات موردنیاز شما.',featuresTitle:'چرا ما؟',featuresItems:['اصالت کالا','نصب و مشاوره','ارسال فوری']}},
 {id:'mehr',name:'مینیمال مهر',description:'مینیمال و تحریریه‌ای؛ شبکهٔ سوئیسی، اعداد بزرگ، خط‌های نازک و تایپوگرافی مجله‌ای',color:'#e4572e',
  tagline:'مد، معماری و جزئیات',signature:'کمتر · دقیق‌تر · ماندگارتر',fonts:{display:'playfair',body:'vazirmatn',accent:'syne'},search:true,
  recipe:['hero','products','text','features','contact'],
  copy:{hero:'کمتر، اما بهتر. مجموعه‌ای از پوشاک و اکسسوری با خط‌های تمیز و جزئیات دقیق.',button:'مشاهدهٔ مجموعه',productsTitle:'مجموعهٔ فصل',productsText:'قطعه‌های ضروری این فصل.',featuresTitle:'اصول ما',featuresItems:['جنس باکیفیت','برش دقیق','تولید مسئولانه'],storyTitle:'نگاه ما',storyText:'دیدگاه طراحی و فلسفهٔ برندتان را بنویسید.'}},
 {id:'retro',name:'رترو هفتاد',description:'نوستالژیک و گرم؛ ریسه‌های غروبی، فونت ضخیم، رنگ‌های خردلی و حس دهه‌ی هفتاد',color:'#e08a1e',
  tagline:'قهوه، موسیقی و یادگاری‌ها',signature:'گرم · قدیمی · دوست‌داشتنی',fonts:{display:'rakkas',body:'vazirmatn',accent:'abril'},
  recipe:['hero','products','text','steps','hours','contact'],
  copy:{hero:'طعم و صدای قدیمی‌ها، با حال خوب امروز. کافه، موسیقی و یادگاری‌هایی از آن سال‌ها.',button:'بزن بریم',productsTitle:'پیشنهاد امروز',productsText:'چیزهایی که دوستشان داریم.',storyTitle:'قصهٔ ما',storyText:'از خاطره‌ها و شروع این مجموعه بنویسید.'}}
];
export const legacyTemplates=[
 {id:'studio',name:'قالب آوان',description:'جسور و تحریریه‌ای؛ تیترهای درشت، بنفش و لیمویی، چیدمان نامتقارن برای برندهای خلاق',color:'#7c3aed'},
 {id:'catalog',name:'قالب ویترین',description:'فروشگاه گرم و محصول‌محور؛ ویترین دو ستونه، کارت‌های منظم و رنگ آجری',color:'#e85130'},
 {id:'consultant',name:'قالب سپهر',description:'خدمات و مشاوره؛ طراحی آبی، معرفی فرایند همکاری و دعوت روشن به ارتباط',color:'#2563eb'},
 {id:'atelier',name:'قالب آرا',description:'بوتیک و مد؛ قاب‌های بلند، فضای تحریریه‌ای و جزئیات ظریف',color:'#a33c57'},
 {id:'tech',name:'قالب مدار',description:'کالای دیجیتال؛ پنل‌های فنی، چیدمان فشرده و آبی الکتریکی',color:'#1769e0'},
 {id:'botanical',name:'قالب برگ',description:'محصولات طبیعی؛ قاب‌های نرم، سبز زیتونی و حس آرام',color:'#53763c'},
 {id:'jewel',name:'قالب زرین',description:'زیورآلات و اکسسوری؛ ترکیب طلایی، قاب‌های ظریف و ویترین مرکزی',color:'#9b7435'},
 {id:'home',name:'قالب خانه',description:'دکور و لوازم خانه؛ ترکیب گرم، قاب‌های معماری و ویترین باز',color:'#b96943'},
 {id:'sport',name:'قالب نبض',description:'ورزشی؛ تیترهای جسور، برش‌های مورب و رنگ پرانرژی',color:'#de432b'},
 {id:'editorial',name:'قالب تحریریه',description:'نشریه‌وار؛ تایپوگرافی قوی، چیدمان نامتقارن، کتاب هفته و نویسندهٔ ویژه',color:'#9a3b2e'},
 {id:'commerce',name:'قالب فروشگاهی',description:'ویترین پویا؛ جست‌وجو، فیلتر کنار صفحه و خرید سریع',color:'#0f766e'},
 {id:'cinematic',name:'قالب سینمایی',description:'عمق بصری؛ جلد شناور، زمینهٔ تیره و انیمیشن‌های ظریف',color:'#f5b942'}
];
export const allTemplates=[...templates,...legacyTemplates];
const byId=new Map(allTemplates.map(t=>[t.id,t]));
export const templateById=id=>byId.get(id)||null;
export const isKnownTemplate=id=>byId.has(id);
// v2 templates are styled by components/templates-v2/*.css and render the shared decoration layer.
export const isV2=id=>templates.some(t=>t.id===id);
export const DEFAULT_TEMPLATE='mehr';

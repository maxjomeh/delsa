// Industry Registry of the site builder: one central, extensible description of every industry
// (suggested templates, product fields, recommended blocks, storefront filters, starter copy).
//
// Rules:
//  - The industry is stored on the site document (doc.industry), independent of doc.template, so a
//    site can change template without losing industry data, and legacy sites resolve to "general".
//  - Industry product fields live in builder_products.attributes under their stable `key`
//    (no schema change). Keys that are not registered stay free-form "name: value" attributes.
//  - Adding an industry = adding one entry here. No per-industry copy of the builder engine.

export const GENERAL_INDUSTRY='general';
const FIELD_KEY=/^[a-z][a-z0-9_]{1,31}$/;

// Field: {key,label,type:'text'|'number'|'select',options?,placeholder?,dir?,max?,
//         search?:include in storefront search, filter?:storefront filter, card?:show on product card}
export const industries=[
 {id:'general',name:'فروشگاه عمومی',description:'برای هر نوع کالا؛ بدون فیلدهای اختصاصی',
  templates:['catalog','home','studio'],
  fields:[],
  blocks:['products','features','faq','testimonials','contact'],
  copy:{},extraBlocks:[]},
 {id:'books',name:'کتاب‌فروشی',description:'کتاب، نویسنده، مترجم و ناشر؛ جست‌وجو و فیلتر مخصوص کتاب',
  templates:['studio','catalog','home'],
  fields:[
   {key:'author',label:'نویسنده',type:'text',max:120,search:true,filter:true,card:true,placeholder:'مثلاً صادق هدایت'},
   {key:'translator',label:'مترجم',type:'text',max:120,search:true,placeholder:'اگر ترجمه است'},
   {key:'publisher',label:'ناشر',type:'text',max:120,search:true,filter:true,card:true},
   {key:'isbn',label:'شابک (ISBN)',type:'text',max:17,dir:'ltr',search:true,pattern:'^[0-9Xx\\-]{10,17}$',placeholder:'978-600-000-000-0'},
   {key:'pages',label:'تعداد صفحه',type:'number',max:100000},
   {key:'publish_year',label:'سال انتشار',type:'number',max:3000,placeholder:'مثلاً ۱۴۰۳'},
   {key:'edition',label:'نوبت چاپ',type:'text',max:60,placeholder:'مثلاً چاپ سوم'},
   {key:'language',label:'زبان',type:'select',options:['فارسی','انگلیسی','عربی','فرانسوی','آلمانی','سایر'],filter:true},
   {key:'cover',label:'نوع جلد',type:'select',options:['شومیز','گالینگور','جلد سخت','نسخه الکترونیکی'],filter:true}
  ],
  blocks:['products','quote','gallery','faq','testimonials','alert'],
  copy:{featuresTitle:'چرا از ما کتاب بخرید؟',featuresItems:['شابک و مشخصات دقیق هر نسخه','انتخاب بر اساس نویسنده، مترجم و ناشر','پیگیری سفارش تا تحویل'],productsTitle:'کتاب‌های منتخب'},
  extraBlocks:[
   {type:'faq',title:'پیش از خرید کتاب',text:'پاسخ پرسش‌های رایج درباره نسخه، چاپ و ارسال.',items:['کتاب چاپ چندم است؟ | نوبت چاپ در صفحهٔ هر کتاب نوشته شده است.','اگر کتاب ناموجود باشد چه می‌شود؟ | با ما تماس بگیرید تا درباره تأمین هماهنگ کنیم.']}
  ]},
 {id:'apparel',name:'پوشاک',description:'پوشاک و اکسسوری؛ جنسیت، جنس پارچه و فصل',
  templates:['atelier','sport','catalog'],
  fields:[
   {key:'gender',label:'مناسب برای',type:'select',options:['زنانه','مردانه','بچگانه','یونیسکس'],filter:true,card:true},
   {key:'material',label:'جنس',type:'text',max:120,search:true,placeholder:'مثلاً پنبه ۱۰۰٪'},
   {key:'season',label:'فصل',type:'select',options:['بهار و تابستان','پاییز و زمستان','چهار فصل'],filter:true},
   {key:'fit',label:'فرم و برش',type:'text',max:80,placeholder:'مثلاً راسته'},
   {key:'care',label:'نحوهٔ نگهداری',type:'text',max:200,placeholder:'مثلاً شست‌وشو با آب سرد'}
  ],
  blocks:['products','gallery','table','faq','testimonials','alert'],
  copy:{featuresTitle:'خرید پوشاک با خیال راحت',featuresItems:['راهنمای سایز و جنس برای هر کالا','رنگ و اندازه به‌صورت مدل جداگانه','مرجوعی و تعویض طبق شرایط فروشگاه'],productsTitle:'تازه‌های پوشاک'},
  extraBlocks:[
   {type:'faq',title:'راهنمای انتخاب سایز',text:'پیش از خرید سایز و برش را بررسی کنید.',items:['اگر سایزم مناسب نبود؟ | شرایط تعویض را در این بخش بنویسید.','جنس پارچه چگونه است؟ | جنس هر محصول در صفحهٔ آن نوشته شده است.']}
  ]},
 {id:'digital',name:'کالای دیجیتال',description:'موبایل، لپ‌تاپ و لوازم جانبی؛ مدل، وضعیت و گارانتی',
  templates:['tech','catalog','consultant'],
  fields:[
   {key:'model',label:'مدل',type:'text',max:120,search:true,card:true,placeholder:'مثلاً A54'},
   {key:'condition',label:'وضعیت کالا',type:'select',options:['نو','آکبند','استوک'],filter:true,card:true},
   {key:'warranty',label:'گارانتی',type:'text',max:120,filter:true,placeholder:'مثلاً ۱۸ ماه شرکتی'},
   {key:'specs',label:'مشخصات کلیدی',type:'text',max:300,search:true,placeholder:'مثلاً ۸ گیگ رم، ۲۵۶ گیگ حافظه'}
  ],
  blocks:['products','table','stats','faq','checklist','video'],
  copy:{featuresTitle:'خرید دیجیتال مطمئن',featuresItems:['مشخصات فنی دقیق','وضعیت و گارانتی هر کالا شفاف است','مقایسهٔ مدل‌ها پیش از خرید'],productsTitle:'کالاهای دیجیتال'},
  extraBlocks:[
   {type:'checklist',title:'گارانتی و پشتیبانی',text:'',items:['گارانتی معتبر','اصالت کالا','پشتیبانی پس از فروش']}
  ]},
 {id:'auto',name:'قطعات خودرو',description:'لوازم یدکی؛ برند و مدل خودرو، سال ساخت و کد فنی',
  templates:['tech','sport','catalog'],
  fields:[
   {key:'vehicle_brand',label:'برند خودرو',type:'text',max:80,search:true,filter:true,card:true,placeholder:'مثلاً پژو'},
   {key:'vehicle_model',label:'مدل خودرو',type:'text',max:80,search:true,filter:true,placeholder:'مثلاً ۲۰۶ تیپ ۵'},
   {key:'year_range',label:'سال ساخت',type:'text',max:40,placeholder:'مثلاً ۱۳۹۰ تا ۱۴۰۲'},
   {key:'part_number',label:'کد فنی / OEM',type:'text',max:60,dir:'ltr',search:true,card:true},
   {key:'part_origin',label:'اصالت قطعه',type:'select',options:['اصلی (OEM)','های‌کپی','دست‌دوم'],filter:true},
   {key:'warranty',label:'گارانتی',type:'text',max:120,placeholder:'مثلاً ۶ ماه'}
  ],
  blocks:['products','table','faq','checklist','alert','links'],
  copy:{featuresTitle:'قطعهٔ درست، برای خودروی شما',featuresItems:['سازگاری با برند و مدل خودرو','کد فنی و اصالت هر قطعه','مشاورهٔ انتخاب پیش از خرید'],productsTitle:'قطعات پرفروش'},
  extraBlocks:[
   {type:'faq',title:'سازگاری قطعه',text:'پیش از خرید، سازگاری را بررسی کنید.',items:['از کجا بفهمم قطعه برای خودروی من است؟ | برند، مدل و سال ساخت در صفحهٔ هر قطعه نوشته شده است.','کد فنی را از کجا ببینم؟ | روی خود قطعه یا دفترچهٔ خودرو.']}
  ]}
];

const byId=new Map(industries.map(i=>[i.id,i]));
export const isIndustry=id=>byId.has(id);
export const normalizeIndustry=id=>byId.has(id)?id:GENERAL_INDUSTRY;
export const industryById=id=>byId.get(normalizeIndustry(id));

const toLatinDigits=s=>String(s).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));

// Validates one field value against its definition. Returns a clean string, or '' to drop it.
export function cleanFieldValue(field,raw){
 const v=String(raw??'').trim();
 if(!v)return '';
 if(field.type==='select')return (field.options||[]).includes(v)?v:'';
 if(field.type==='number'){const n=toLatinDigits(v).replace(/[,٬\s]/g,'');return /^\d{1,9}$/.test(n)&&Number(n)<=(field.max??1e9)?String(Number(n)):''}
 const t=v.slice(0,field.max??200);
 if(field.pattern&&!new RegExp(field.pattern).test(t))return '';
 return t;
}

// Splits product attributes into the registered industry values and the remaining free-form ones.
export function splitAttributes(industry,attributes){
 const fields=industryById(industry?.id||industry).fields,keys=new Set(fields.map(f=>f.key)),values={},rest={};
 for(const [k,v] of Object.entries(attributes||{}))(keys.has(k)?values:rest)[k]=v;
 return {values,rest};
}

// Inverse of splitAttributes. Invalid or empty industry values are dropped; unrelated keys survive,
// so data of another industry is never lost when a site changes industry.
export function mergeAttributes(industry,values,rest){
 const fields=industryById(industry?.id||industry).fields,out={...(rest||{})};
 for(const f of fields){const clean=cleanFieldValue(f,values?.[f.key]);if(clean)out[f.key]=clean;else delete out[f.key]}
 return out;
}

// Human label for an attribute key on the storefront (unregistered keys are shown as written).
export function attributeLabel(industry,key){
 return industryById(industry?.id||industry).fields.find(f=>f.key===key)?.label||key;
}

// Text of the searchable industry fields, appended to the storefront search haystack.
export function searchText(industry,attributes){
 return industryById(industry?.id||industry).fields.filter(f=>f.search).map(f=>attributes?.[f.key]||'').join(' ');
}

// One-line summary under the product title on a card (e.g. "author · publisher").
export function cardLine(industry,attributes){
 return industryById(industry?.id||industry).fields.filter(f=>f.card).map(f=>attributes?.[f.key]).filter(Boolean).join(' · ');
}

// Filters offered on the storefront: only fields flagged `filter` that have 2+ distinct values.
export function filterOptions(industry,products){
 const out=[];
 for(const f of industryById(industry?.id||industry).fields.filter(f=>f.filter)){
  const present=[...new Set(products.map(p=>p.attributes?.[f.key]).filter(Boolean))];
  const options=f.type==='select'?f.options.filter(o=>present.includes(o)):present.sort((a,b)=>a.localeCompare(b,'fa'));
  if(options.length>1&&options.length<=40)out.push({key:f.key,label:f.label,options});
 }
 return out;
}

// Registry self-check used by tests: unique ids and keys, valid fields, existing blocks/templates.
export function validateRegistry(templateIds,blockTypes){
 const errors=[],ids=new Set();
 for(const i of industries){
  if(ids.has(i.id))errors.push('duplicate industry '+i.id);ids.add(i.id);
  if(!i.name||!i.description)errors.push(i.id+': name/description');
  if(!i.templates.length||i.templates.some(t=>!templateIds.includes(t)))errors.push(i.id+': unknown template');
  if(i.blocks.some(b=>!blockTypes.includes(b)))errors.push(i.id+': unknown block');
  if(i.extraBlocks.some(b=>!blockTypes.includes(b.type)))errors.push(i.id+': unknown extra block');
  const keys=new Set();
  for(const f of i.fields){
   if(!FIELD_KEY.test(f.key))errors.push(i.id+': bad key '+f.key);
   if(keys.has(f.key))errors.push(i.id+': duplicate key '+f.key);keys.add(f.key);
   if(!['text','number','select'].includes(f.type)||!f.label)errors.push(i.id+': bad field '+f.key);
   if(f.type==='select'&&!(f.options||[]).length)errors.push(i.id+': select without options '+f.key);
   if(f.type==='select'&&f.options.some(o=>String(o).length>60))errors.push(i.id+': long option '+f.key);
  }
 }
 if(!ids.has(GENERAL_INDUSTRY))errors.push('missing general industry');
 return errors;
}

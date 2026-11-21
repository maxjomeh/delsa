const tx=s=>s; // marks UI text that components translate when they show it (see lib/i18n/config.js)
// Font registry of the site builder. Only ids from this list ever reach CSS (doc.fonts is validated against it),
// and every family is self-hosted through @fontsource (components/builder-fonts.css) - no third-party font requests.
// `script:'fa'` fonts carry Persian letters; `script:'latin'` fonts are for Latin brand names and fall back to
// Vazirmatn for Persian text, so any choice stays readable in Persian.
const FALLBACK_FA='"Vazirmatn",system-ui,sans-serif',FALLBACK_SERIF_FA='"Vazirmatn","Noto Naskh Arabic",serif';
export const fontTones={luxury:tx('لوکس'),classic:tx('کلاسیک'),calligraphy:tx('خوشنویسی'),fantasy:tx('فانتزی'),display:tx('تیتری'),modern:tx('مدرن')};
export const fonts=[
 // Persian / Arabic script
 {id:'vazirmatn',label:tx('وزیرمتن'),sample:tx('مدرن و خوانا'),family:'Vazirmatn',tone:'modern',script:'fa',fallback:'system-ui,sans-serif'},
 {id:'amiri',label:tx('امیری'),sample:tx('کلاسیک و باشکوه'),family:'Amiri',tone:'luxury',script:'fa',fallback:FALLBACK_SERIF_FA},
 {id:'aref-ruqaa',label:tx('عارف رقعه'),sample:tx('خوشنویسی رقعه'),family:'Aref Ruqaa',tone:'calligraphy',script:'fa',fallback:FALLBACK_SERIF_FA},
 {id:'katibeh',label:tx('کاتبه'),sample:tx('خط باریک و ظریف'),family:'Katibeh',tone:'calligraphy',script:'fa',fallback:FALLBACK_SERIF_FA},
 {id:'nastaliq',label:tx('نستعلیق'),sample:tx('نستعلیق اصیل'),family:'Noto Nastaliq Urdu',tone:'calligraphy',script:'fa',fallback:FALLBACK_SERIF_FA},
 {id:'markazi',label:tx('مرکزی'),sample:tx('سریف ظریف و ادبی'),family:'Markazi Text',tone:'classic',script:'fa',fallback:FALLBACK_SERIF_FA},
 {id:'scheherazade',label:tx('شهرزاد'),sample:tx('نسخ سنتی'),family:'Scheherazade New',tone:'classic',script:'fa',fallback:FALLBACK_SERIF_FA},
 {id:'mirza',label:tx('میرزا'),sample:tx('تزئینی و گرم'),family:'Mirza',tone:'luxury',script:'fa',fallback:FALLBACK_SERIF_FA},
 {id:'el-messiri',label:tx('المسیری'),sample:tx('آرت‌دکو و شیک'),family:'El Messiri',tone:'luxury',script:'fa',fallback:FALLBACK_FA},
 {id:'reem-kufi',label:tx('ریم کوفی'),sample:tx('هندسی و آینده‌نگر'),family:'Reem Kufi',tone:'modern',script:'fa',fallback:FALLBACK_FA},
 {id:'kufam',label:tx('کوفام'),sample:tx('کوفی جسور'),family:'Kufam',tone:'display',script:'fa',fallback:FALLBACK_FA},
 {id:'lalezar',label:tx('لاله‌زار'),sample:tx('فانتزی و ضخیم'),family:'Lalezar',tone:'fantasy',script:'fa',fallback:FALLBACK_FA},
 {id:'rakkas',label:tx('رکّاس'),sample:tx('پرشور و پرحجم'),family:'Rakkas',tone:'fantasy',script:'fa',fallback:FALLBACK_FA},
 {id:'lemonada',label:tx('لیمونادا'),sample:tx('بازیگوش و دوست‌داشتنی'),family:'Lemonada',tone:'fantasy',script:'fa',fallback:FALLBACK_FA},
 {id:'harmattan',label:tx('هارماتان'),sample:tx('نرم و آرام'),family:'Harmattan',tone:'modern',script:'fa',fallback:FALLBACK_FA},
 {id:'jomhuria',label:tx('جمهوریه'),sample:tx('فشرده و تیتری'),family:'Jomhuria',tone:'display',script:'fa',fallback:FALLBACK_FA},
 {id:'blaka',label:tx('بلاکا'),sample:tx('تزئینی و متفاوت'),family:'Blaka',tone:'fantasy',script:'fa',fallback:FALLBACK_FA},
 {id:'changa',label:tx('چنگا'),sample:tx('قوی و ورزشی'),family:'Changa',tone:'display',script:'fa',fallback:FALLBACK_FA},
 // Latin display faces (Persian text falls back to Vazirmatn)
 {id:'playfair',label:'Playfair Display',sample:'Elegant Serif',family:'Playfair Display',tone:'luxury',script:'latin',fallback:FALLBACK_SERIF_FA},
 {id:'cormorant',label:'Cormorant Garamond',sample:'Refined Classic',family:'Cormorant Garamond',tone:'luxury',script:'latin',fallback:FALLBACK_SERIF_FA},
 {id:'cinzel',label:'Cinzel',sample:'ROMAN CAPITALS',family:'Cinzel',tone:'luxury',script:'latin',fallback:FALLBACK_SERIF_FA},
 {id:'bodoni',label:'Bodoni Moda',sample:'High Fashion',family:'Bodoni Moda',tone:'luxury',script:'latin',fallback:FALLBACK_SERIF_FA},
 {id:'italiana',label:'Italiana',sample:'Delicate Thin',family:'Italiana',tone:'luxury',script:'latin',fallback:FALLBACK_SERIF_FA},
 {id:'marcellus',label:'Marcellus',sample:'Calm Inscription',family:'Marcellus',tone:'classic',script:'latin',fallback:FALLBACK_SERIF_FA},
 {id:'fraunces',label:'Fraunces',sample:'Soft Old-Style',family:'Fraunces',tone:'classic',script:'latin',fallback:FALLBACK_SERIF_FA},
 {id:'abril',label:'Abril Fatface',sample:'Bold Poster',family:'Abril Fatface',tone:'display',script:'latin',fallback:FALLBACK_SERIF_FA},
 {id:'syne',label:'Syne',sample:'Wide & Artistic',family:'Syne',tone:'modern',script:'latin',fallback:FALLBACK_FA},
 {id:'unbounded',label:'Unbounded',sample:'Futuristic Round',family:'Unbounded',tone:'modern',script:'latin',fallback:FALLBACK_FA},
 {id:'bebas',label:'Bebas Neue',sample:'TALL & LOUD',family:'Bebas Neue',tone:'display',script:'latin',fallback:FALLBACK_FA},
 {id:'great-vibes',label:'Great Vibes',sample:'Handwritten Script',family:'Great Vibes',tone:'fantasy',script:'latin',fallback:FALLBACK_SERIF_FA},
 {id:'pinyon',label:'Pinyon Script',sample:'Wedding Script',family:'Pinyon Script',tone:'fantasy',script:'latin',fallback:FALLBACK_SERIF_FA},
 {id:'limelight',label:'Limelight',sample:'Art Deco Marquee',family:'Limelight',tone:'fantasy',script:'latin',fallback:FALLBACK_SERIF_FA},
 {id:'monoton',label:'Monoton',sample:'Neon Lines',family:'Monoton',tone:'fantasy',script:'latin',fallback:FALLBACK_FA}
];
const byId=new Map(fonts.map(f=>[f.id,f]));
export const fontById=id=>byId.get(id)||null;
// '' means "use the template's own font".
export const normalizeFontId=id=>byId.has(id)?id:'';
export const normalizeFonts=v=>{const o=v&&typeof v==='object'?v:{};return {display:normalizeFontId(o.display),body:normalizeFontId(o.body)}};
export const fontStack=id=>{const f=byId.get(id);return f?`"${f.family}",${f.fallback}`:''};
// Inline custom properties for a document; only overridden fonts are emitted.
export function fontVars(fontsValue){
 const f=normalizeFonts(fontsValue),out={};
 if(f.display)out['--ff-display']=fontStack(f.display);
 if(f.body)out['--ff-body']=fontStack(f.body);
 return out;
}

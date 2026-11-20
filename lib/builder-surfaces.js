// Surface styles: a second, template-independent axis of the look. '' keeps the template's own surfaces; the other four
// re-skin cards, header, buttons and fields of ANY current template (components/templates-v2/_surfaces.css).
export const surfaces=[
 {id:'',name:'پیش‌فرض قالب',description:'سطوح همان‌طور که طراح قالب ساخته است'},
 {id:'glass',name:'شیشه‌ای (Glassmorphism)',description:'پنل‌های مات و شفاف با تاری پس‌زمینه و لبهٔ نورانی'},
 {id:'clay',name:'خمیری (Claymorphism)',description:'سطوح بادکرده، نرم و رنگی مثل خمیر بازی'},
 {id:'skeuo',name:'واقع‌گرایانه (Skeuomorphism)',description:'برجستگی، سایه و جلای مواد واقعی مثل فلز و چرم'},
 {id:'neu',name:'نئومورفیسم (Neumorphism)',description:'برجسته و فرورفتهٔ ملایم، هم‌رنگ با زمینه'}
];
export const normalizeSurface=id=>surfaces.some(s=>s.id&&s.id===id)?id:'';

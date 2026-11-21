const tx=s=>s; // marks UI text that components translate when they show it (see lib/i18n/config.js)
// Surface styles: a second, template-independent axis of the look. '' keeps the template's own surfaces; the other four
// re-skin cards, header, buttons and fields of ANY current template (components/templates-v2/_surfaces.css).
export const surfaces=[
 {id:'',name:tx('پیش‌فرض قالب'),description:tx('سطوح همان‌طور که طراح قالب ساخته است')},
 {id:'glass',name:tx('شیشه‌ای (Glassmorphism)'),description:tx('پنل‌های مات و شفاف با تاری پس‌زمینه و لبهٔ نورانی')},
 {id:'clay',name:tx('خمیری (Claymorphism)'),description:tx('سطوح بادکرده، نرم و رنگی مثل خمیر بازی')},
 {id:'skeuo',name:tx('واقع‌گرایانه (Skeuomorphism)'),description:tx('برجستگی، سایه و جلای مواد واقعی مثل فلز و چرم')},
 {id:'neu',name:tx('نئومورفیسم (Neumorphism)'),description:tx('برجسته و فرورفتهٔ ملایم، هم‌رنگ با زمینه')}
];
export const normalizeSurface=id=>surfaces.some(s=>s.id&&s.id===id)?id:'';

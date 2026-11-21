const tx=s=>s; // marks UI text translated when shown (see lib/i18n/config.js)
export const fieldTypes={text:tx('متن'),number:tx('عدد'),date:tx('تاریخ میلادی'),birthday:tx('روز و ماه تولد / شمسی'),select:tx('تک‌انتخابی'),multiselect:tx('چندانتخابی')};
export const conditions={always:tx('در فرصت مناسب'),after_purchase:tx('پس از خرید'),active_lead:tx('هنگام بررسی نیاز خرید')};
export const informationStatuses={asked:tx('پرسیده شده'),deferred:tx('برای بعد'),declined:tx('مایل به پاسخ نیست'),confirmed:tx('ثبت شده'),review:tx('نیازمند بررسی')};
export const commonFields=[
 {key:'birthday',label:tx('روز و ماه تولد'),type:'birthday',priority:30,question:tx('اگر دوست دارید روز تولدتان برایتان پیام تبریک بفرستیم، روز و ماه تولدتان را می‌گویید؟'),condition:'after_purchase'},
 {key:'contact_time',label:tx('زمان ترجیحی تماس'),type:'text',priority:60,question:tx('چه ساعتی برای ارتباط با شما مناسب‌تر است؟'),condition:'always'},
 {key:'occupation',label:tx('شغل یا نوع مشتری'),type:'select',options:[tx('مصرف‌کننده'),tx('همکار'),tx('صاحب کسب‌وکار')],priority:70,question:tx('برای مصرف خودتان تهیه می‌کنید یا برای کسب‌وکارتان؟'),condition:'active_lead'},
 {key:'secondary_phone',label:tx('شماره تماس دوم'),type:'text',priority:20,question:tx('اگر مایلید، شماره تماس دیگری برای هماهنگی ثبت کنیم؟'),condition:'after_purchase'},
 {key:'province',label:tx('استان'),type:'text',priority:50,question:tx('برای بررسی ارسال، در کدام استان هستید؟'),condition:'active_lead'},
 {key:'address',label:tx('آدرس ارسال'),type:'text',priority:80,question:tx('برای ارسال سفارش، آدرس تحویل را می‌فرمایید؟'),condition:'after_purchase'},
 {key:'email',label:tx('ایمیل'),type:'text',priority:20,question:tx('اگر مایلید، ایمیلی برای دریافت اطلاعات ثبت کنیم؟'),condition:'after_purchase'},
 {key:'account_code',label:tx('کد حسابداری'),type:'text',priority:10,question:'',condition:'always',ask_enabled:false},
 {key:'acquisition_source',label:tx('روش آشنایی با کسب‌وکار'),type:'text',priority:40,question:tx('از چه طریقی با ما آشنا شدید؟'),condition:'always'},
];
export function present(v){return Array.isArray(v)?v.length>0:v!==null&&v!==undefined&&String(v).trim()!=='';}
export function profileValue(customer,field){return customer.custom_fields?.[field.key]??customer.custom_fields?.[field.label]??'';}
export function nextInformation(customer,fields,states,context={},now=Date.now()){
 if(customer.do_not_contact||customer.status==='closed'||context.urgent)return null;
 const eligible=fields.filter(f=>{
  if(!f.enabled||!f.ask_enabled||!f.question?.trim()||present(profileValue(customer,f)))return false;
  if(f.condition==='after_purchase'&&!context.hasPurchase||f.condition==='active_lead'&&!context.hasLead)return false;
  const state=states.find(s=>s.customer_id===customer.id&&s.field_id===f.id);
  if(['declined','review'].includes(state?.status))return false;
  if(state?.next_ask_at&&new Date(state.next_ask_at).getTime()>now)return false;
  return true;
 });
 // One question for the entire conversation, never a separate question per missing field.
 if(states.some(s=>s.customer_id===customer.id&&s.last_asked_at&&now-new Date(s.last_asked_at).getTime()<86400000))return null;
 return eligible.sort((a,b)=>b.priority-a.priority||a.label.localeCompare(b.label,'fa'))[0]||null;
}
export function normalizedBirthday(value){
 const s=String(value||'').replace(/[۰-۹]/g,d=>tx('۰۱۲۳۴۵۶۷۸۹').indexOf(d)).replace(/[٠-٩]/g,d=>tx('٠١٢٣٤٥٦٧٨٩').indexOf(d));
 const m=s.match(/^(\d{1,2})\/(\d{1,2})$/);if(!m)return null;
 const month=Number(m[1]),day=Number(m[2]);if(month<1||month>12||day<1||day>(month<=6?31:30))return null;
 return `${String(month).padStart(2,'0')}/${String(day).padStart(2,'0')}`;
}

export const fieldTypes={text:'متن',number:'عدد',date:'تاریخ میلادی',birthday:'روز و ماه تولد / شمسی',select:'تک‌انتخابی',multiselect:'چندانتخابی'};
export const conditions={always:'در فرصت مناسب',after_purchase:'پس از خرید',active_lead:'هنگام بررسی نیاز خرید'};
export const informationStatuses={asked:'پرسیده شده',deferred:'برای بعد',declined:'مایل به پاسخ نیست',confirmed:'ثبت شده',review:'نیازمند بررسی'};
export const commonFields=[
 {key:'birthday',label:'روز و ماه تولد',type:'birthday',priority:30,question:'اگر دوست دارید روز تولدتان برایتان پیام تبریک بفرستیم، روز و ماه تولدتان را می‌گویید؟',condition:'after_purchase'},
 {key:'contact_time',label:'زمان ترجیحی تماس',type:'text',priority:60,question:'چه ساعتی برای ارتباط با شما مناسب‌تر است؟',condition:'always'},
 {key:'occupation',label:'شغل یا نوع مشتری',type:'select',options:['مصرف‌کننده','همکار','صاحب کسب‌وکار'],priority:70,question:'برای مصرف خودتان تهیه می‌کنید یا برای کسب‌وکارتان؟',condition:'active_lead'},
 {key:'secondary_phone',label:'شماره تماس دوم',type:'text',priority:20,question:'اگر مایلید، شماره تماس دیگری برای هماهنگی ثبت کنیم؟',condition:'after_purchase'},
 {key:'province',label:'استان',type:'text',priority:50,question:'برای بررسی ارسال، در کدام استان هستید؟',condition:'active_lead'},
 {key:'address',label:'آدرس ارسال',type:'text',priority:80,question:'برای ارسال سفارش، آدرس تحویل را می‌فرمایید؟',condition:'after_purchase'},
 {key:'email',label:'ایمیل',type:'text',priority:20,question:'اگر مایلید، ایمیلی برای دریافت اطلاعات ثبت کنیم؟',condition:'after_purchase'},
 {key:'account_code',label:'کد حسابداری',type:'text',priority:10,question:'',condition:'always',ask_enabled:false},
 {key:'acquisition_source',label:'روش آشنایی با کسب‌وکار',type:'text',priority:40,question:'از چه طریقی با ما آشنا شدید؟',condition:'always'},
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
 const s=String(value||'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
 const m=s.match(/^(\d{1,2})\/(\d{1,2})$/);if(!m)return null;
 const month=Number(m[1]),day=Number(m[2]);if(month<1||month>12||day<1||day>(month<=6?31:30))return null;
 return `${String(month).padStart(2,'0')}/${String(day).padStart(2,'0')}`;
}

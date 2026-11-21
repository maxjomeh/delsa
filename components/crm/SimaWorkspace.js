'use client';
import {useI18n} from '../i18n/I18nProvider';
import {tx} from '../../lib/i18n/config';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {createClient} from '../../lib/supabase/client';
import {industries,statusNames,normalizePhone} from './industry';
import styles from './SimaWorkspace.module.css';
import InformationWorkspace,{ProfileField} from './InformationWorkspace';
import {profileValue} from './information';
import {uniqueDisplayMessages} from '../../lib/crm/dedupe-display.mjs';
import ZernioConnection from './ZernioConnection';
import SimaInbox from './SimaInbox';
import HumanReviewWorkspace from './HumanReviewWorkspace';
import KnowledgeWorkspace from './KnowledgeWorkspace';
import CustomerIntelligence from './CustomerIntelligence';
const sections={overview:tx('نمای کلی'),inbox:tx('صندوق مکالمات'),reviews:tx('نیازمند پاسخ شما'),knowledge:tx('دانش کسب‌وکار'),customers:tx('مشتریان'),interactions:tx('گفت‌وگو و تعاملات'),leads:tx('فرصت‌های فروش'),orders:tx('سفارش‌ها'),tasks:tx('پیگیری‌ها'),information:tx('اطلاعات جدید'),connections:tx('اتصال‌ها'),settings:tx('صنف و قوانین'),reports:tx('تاریخچه و گزارش')};
const primarySections=['overview','reviews','inbox','customers','information','knowledge','connections'];
const secondarySections=['interactions','leads','orders','tasks','reports','settings'];
const tables={customers:'crm_customers',interactions:'crm_interactions',leads:'crm_leads',orders:'crm_orders',tasks:'crm_tasks',reports:'crm_events'};
const channels=['manual','instagram','whatsapp','telegram','bale','eitaa','rubika','soroush','website','phone'];
const channelNames={manual:tx('ثبت دستی'),instagram:tx('اینستاگرام'),whatsapp:tx('واتساپ'),telegram:tx('تلگرام'),bale:tx('بله'),eitaa:tx('ایتا'),rubika:tx('روبیکا'),soroush:tx('سروش'),website:tx('وب‌سایت'),phone:tx('تماس')};
const initialSettings={industry:'retail',business_name:'',followup_hours:24,max_attempts:2,automation_enabled:true};
export default function SimaWorkspace({userId}){
 const {t,intl}=useI18n();
 const date=v=>new Date(v).toLocaleString(intl,{timeZone:'Asia/Tehran'}),num=v=>Number(v||0).toLocaleString(intl);
const db=useMemo(()=>createClient(),[]),[section,setSection]=useState('overview'),[data,setData]=useState({customers:[],interactions:[],leads:[],orders:[],tasks:[],reports:[]}),[settings,setSettings]=useState(initialSettings),[draftSettings,setDraftSettings]=useState(initialSettings),[search,setSearch]=useState(''),[filter,setFilter]=useState(''),[form,setForm]=useState(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[fields,setFields]=useState([]),[informationStates,setInformationStates]=useState([]),[informationQueue,setInformationQueue]=useState([]),[informationEditing,setInformationEditing]=useState(false);
const [health,setHealth]=useState(null);
useEffect(()=>{let active=true;fetch('/api/crm/health',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(x=>{if(active)setHealth(x)}).catch(()=>{});return()=>{active=false;};},[]);
useEffect(()=>{const params=new URLSearchParams(window.location.search);if(params.get('sima_section')==='connections')setSection('connections');else if(params.has('sima_customer'))setSection('customers');},[]);
const loadSeq=useRef(0);
const load=useCallback(async()=>{
 const request=++loadSeq.current;
 try{
 const keys=Object.keys(tables),results=await Promise.all(keys.map(async k=>{
 if(k==='interactions'){
  const all=[];
  // On overview, reports and settings, a short activity sample is enough.
  // Full histories are loaded only when a conversation/customer view requires them.
  const maxPages=['inbox','customers','interactions'].includes(section)?8:1;
  for(let page=0;page<maxPages;page++){
   const res=await db.from(tables[k]).select('*').eq('tenant_id',userId)
    .order('created_at',{ascending:false}).range(page*500,page*500+499);
   if(res.error)return res;
   all.push(...(res.data||[]));if((res.data||[]).length<500)break;
  }
  return {data:uniqueDisplayMessages(all),error:null};
 }
 if(k!=='customers')return db.from(tables[k]).select(k==='reports'?'id,entity,entity_id,kind,created_at':'*').eq('tenant_id',userId).order('created_at',{ascending:false}).limit(500);
 const all=[];
 for(let p=0;p<20;p++){
  const page=await db.from('crm_customers').select('*').eq('tenant_id',userId).order('created_at',{ascending:false}).range(p*1000,p*1000+999);
  if(page.error)return page;
  all.push(...(page.data||[]));if((page.data||[]).length<1000)break;
 }
 return {data:all,error:null};
}));if(request!==loadSeq.current)return;
 const cfg=await db.from('crm_settings').select('*').eq('tenant_id',userId).maybeSingle();
 if(request!==loadSeq.current)return;
 const failed=keys.filter((k,i)=>!!results[i].error);
 if(failed.length||cfg.error)setError(t('بعضی از بخش‌های سیما موقتاً در دسترس نیستند؛ اطلاعات سالم همچنان نمایش داده می‌شوند.'));
 else setError('');
 setData(prev=>Object.fromEntries(keys.map((k,i)=>[k,results[i].error?prev[k]||[]:results[i].data||[]])));if(cfg.data){setSettings(cfg.data);setDraftSettings(v=>form?v:cfg.data);}const extras=await Promise.all([db.from('crm_field_definitions').select('*').eq('tenant_id',userId).order('priority',{ascending:false}).limit(200),db.from('crm_information_states').select('*').eq('tenant_id',userId).order('updated_at',{ascending:false}).limit(5000),db.rpc('crm_information_queue',{p_limit:500}) ]);
 if(request!==loadSeq.current)return;
 if(extras.some(r=>r.error))setError(t('برخی داده‌های اطلاعات مشتریان بارگذاری نشدند؛ بخش‌های سالم قابل استفاده‌اند.'));
 if(!extras[0].error)setFields(extras[0].data||[]);
 if(!extras[1].error)setInformationStates(extras[1].data||[]);
 if(!extras[2].error)setInformationQueue(extras[2].data||[]);setLoading(false);
 }catch(e){if(request===loadSeq.current){setError(t('دریافت اطلاعات سیما با خطا مواجه شد. دوباره تلاش کنید.'));setLoading(false);}}
},[db,userId,form,section]);
useEffect(()=>{let alive=true;const refresh=()=>{if(alive&&document.visibilityState==='visible'&&!form&&!informationEditing&&section!=='settings')load();};refresh();const timer=setInterval(refresh,90000);window.addEventListener('focus',refresh);return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',refresh);};},[load,form,section,informationEditing]);
useEffect(()=>{if(section==='customers'&&form){document.getElementById('sima-customer-editor')?.scrollIntoView({behavior:'smooth',block:'start'});}},[section,Boolean(form)]);
function navigate(k){setSection(k);setInformationEditing(false);if(k==='settings')setDraftSettings(settings);setForm(null);setSearch('');setFilter('');setError('');setNotice('');}
const customer=id=>data.customers.find(c=>c.id===id)?.name||t('مشتری'),industry=industries[settings.industry]||industries.retail;
function open(record=null){setError('');setNotice('');setForm(record||{customer_id:data.customers[0]?.id||'',status:section==='customers'?'new':section==='orders'?'pending':'scheduled',stage:'new',channel:'manual',direction:'inbound',kind:'message',custom_fields:{},items:[]});}
async function save(e){e.preventDefault();setBusy(true);setError('');try{let value;
if(section==='settings'){value={industry:draftSettings.industry,business_name:draftSettings.business_name,followup_hours:Number(draftSettings.followup_hours),max_attempts:Number(draftSettings.max_attempts),automation_enabled:draftSettings.automation_enabled,tenant_id:userId,updated_at:new Date().toISOString()};const r=await db.from('crm_settings').upsert(value);if(r.error)throw r.error;setSettings(value);}
else{const f=form;if(section==='customers')value={name:f.name?.trim(),phone:normalizePhone(f.phone),instagram:(f.instagram||'').trim().replace(/^@/,''),city:f.city||'',status:f.status,tags:f.tags||'',notes:f.notes||'',do_not_contact:!!f.do_not_contact,custom_fields:f.custom_fields||{},updated_at:new Date().toISOString()};
if(section==='interactions')value={customer_id:f.customer_id,channel:f.channel,direction:f.direction,kind:f.kind,body:f.body};
if(section==='leads')value={customer_id:f.customer_id,title:f.title,stage:f.stage,amount:f.amount===''||f.amount==null?null:Number(f.amount),notes:f.notes||''};
if(section==='orders')value={customer_id:f.customer_id,reference:f.reference,amount:Number(f.amount),status:f.status,items:f.items||[]};
if(section==='tasks')value={customer_id:f.customer_id,title:f.title,due_at:new Date(f.due_at).toISOString(),status:f.status,result:f.result||''};
const q=f.id?db.from(tables[section]).update(value).eq('id',f.id).eq('tenant_id',userId):db.from(tables[section]).insert({...value,tenant_id:userId});const r=await q.select('id').single();if(r.error)throw r.error;}
setForm(null);setNotice(t('ذخیره شد.'));await load();}catch(e){setError(e.message?.includes('crm_field_invalid_birthday')?t('روز و ماه تولد را به‌شکل ماه/روز شمسی وارد کنید؛ مثل ۰۳/۱۵.'):e.message?.includes('crm_field_invalid')?t('مقدار یکی از فیلدهای دلخواه با نوع آن سازگار نیست.'):e.code==='23505'?t('شماره، شناسه یا مرجع تکراری است؛ پروندهٔ قبلی را ویرایش کنید.'):e.code==='42501'?t('اشتراک فعال سیما برای ثبت تغییرات لازم است.'):section==='orders'&&e instanceof SyntaxError?t('ساختار اقلام سفارش معتبر نیست.'):t('ذخیره انجام نشد؛ فیلدها و اتصال را بررسی کنید.'));}finally{setBusy(false);}}
const rows=(data[section]||[]).filter(r=>(!filter||r.customer_id===filter||r.id===filter)&&[r.name,r.title,r.body,r.reference,r.phone,r.instagram,r.tags,r.notes,customer(r.customer_id)].join(' ').toLowerCase().includes(search.toLowerCase()));
const input=(key,label,type='text',required=false)=> <label>{label}<input type={type} required={required} value={form?.[key]??''} maxLength={type==='text'?200:undefined} min={type==='number'?0:undefined} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>;
const select=(key,label,options)=><label>{label}<select value={form?.[key]||''} onChange={e=>setForm({...form,[key]:e.target.value})}>{Object.entries(options).map(([k,v])=><option key={k} value={k}>{t(v)}</option>)}</select></label>;
return <section className={styles.workspace}><header className={styles.header}><div><span>DELSA · SIMA CRM</span><h2>{t('سیما؛ همراه ارتباط با مشتری')}</h2><p>{settings.business_name||t('فضای کاری شما')} · {t(industry.name)}</p></div><span className={styles.badge}>{t('داده‌های واقعی کسب‌وکار')}</span></header><div className={styles.connection}><strong>{t('اتصال پیام‌رسان‌ها و پرونده‌های هوشمند')}</strong><span>{t('پیام‌های متصل به Zernio در سیما دریافت می‌شوند؛ ارسال از «نیازمند پاسخ شما» فقط با تأیید انسان انجام می‌شود. پیشنهادهای استخراج اطلاعات نیز پیش از ثبت قطعی به بررسی نیاز دارند.')}</span></div><nav className={styles.nav} aria-label={t('بخش‌های سیما')}>
 {primarySections.map(k=><button key={k} className={section===k?styles.active:''} onClick={()=>navigate(k)}>{t(sections[k])}</button>)}
 <select aria-label={t('سایر بخش‌های سیما')} value={secondarySections.includes(section)?section:''} onChange={e=>e.target.value&&navigate(e.target.value)}>
  <option value="">{t('سایر ابزارها و گزارش‌ها')}</option>
  {secondarySections.map(k=><option key={k} value={k}>{t(sections[k])}</option>)}
 </select>
</nav>{error&&<p role="alert" className={styles.error}>{error}</p>}{notice&&<p role="status">{notice}</p>}{loading?<p role="status">{t('در حال بارگذاری سیما…')}</p>:<>
{health?.status==='degraded'&&<div className={styles.connection} role="alert"><strong>{t('اتصال سیما نیازمند بررسی است')}</strong><span>{t('تنظیمات Zernio یا Webhook در این نسخهٔ منتشرشده کامل نیست. احتمالاً نسخهٔ Preview مستقیماً Promote شده است. برای اتصال پایدار، Deployment با محیط Production بسازید؛ تغییر کلید یا ارسال آزمایشی لازم نیست.')}</span></div>}
{section==='overview'&&<><div className={styles.stats}>{[[t('پروندهٔ مشتری'),data.customers.length],[t('فرصت باز'),data.leads.filter(x=>!['won','lost'].includes(x.stage)).length],[t('پیگیری در انتظار'),data.tasks.filter(x=>x.status==='scheduled').length],[t('فروش ثبت‌شده / تومان'),data.orders.filter(x=>x.status==='paid').reduce((n,x)=>n+Number(x.amount),0)]].map(([k,v])=><article key={k}><span>{k}</span><strong>{num(v)}</strong></article>)}</div><div className={styles.panel}><h3>{t('پیگیری‌های سررسیدشده')}</h3>{data.tasks.filter(x=>x.status==='scheduled'&&new Date(x.due_at)<=new Date()).map(x=><article key={x.id}><strong>{customer(x.customer_id)}</strong><p>{x.title} · {date(x.due_at)}</p></article>)}{!data.tasks.some(x=>x.status==='scheduled'&&new Date(x.due_at)<=new Date())&&<p>{t('پیگیری سررسیدشده‌ای وجود ندارد.')}</p>}<button onClick={()=>setSection('tasks')}>{t('مدیریت پیگیری‌ها')}</button></div><div className={styles.panel}><h3>{t('اطلاعات جدید')}</h3><p>{num(informationQueue.length)} {t('مشتری آمادهٔ یک سؤال تکمیلی مناسب هستند. اولویت‌ها و زمان پرسیدن را خودتان تنظیم کنید.')}</p><button onClick={()=>setSection('information')}>{t('دیدن سؤال بعدی مشتریان')}</button></div><div className={styles.panel}><h3>{t('شروع کار')}</h3><p>{t('صنف را انتخاب کنید، مشتری را ثبت کنید و یک تعامل از نوع «پیشنهاد ارسالی» بسازید. سیما پیگیری را طبق قانون زمان‌بندی می‌کند؛ پاسخ جدید یا خرید، پیگیری قبلی را متوقف می‌کند.')}</p><button onClick={()=>setSection('settings')}>{t('تنظیم صنف و قوانین')}</button></div></>}
{section==='inbox'&&<SimaInbox db={db} userId={userId} customers={data.customers} interactions={data.interactions} informationQueue={informationQueue} onRefresh={load}/>}
{section==='reviews'&&<HumanReviewWorkspace/>}
{section==='knowledge'&&<KnowledgeWorkspace/>}
{section==='connections'&&<ZernioConnection/>}
{section==='information'&&<InformationWorkspace db={db} userId={userId} fields={fields} states={informationStates} queue={informationQueue} customers={data.customers} interactions={data.interactions} onRefresh={load} onEditingChange={setInformationEditing} onEditCustomer={id=>{const c=data.customers.find(x=>x.id===id);if(c){setSection('customers');setForm(c);setInformationEditing(false);}}}/>}
{section==='settings'&&<form onSubmit={save} className={styles.form}><h3>{t('صنف و قانون پیگیری')}</h3><label>{t('نام کسب‌وکار')}<input value={draftSettings.business_name} maxLength={120} onChange={e=>setDraftSettings({...draftSettings,business_name:e.target.value})}/></label><label>{t('بستهٔ صنفی')}<select value={draftSettings.industry} onChange={e=>setDraftSettings({...draftSettings,industry:e.target.value})}>{Object.entries(industries).map(([k,v])=><option key={k} value={k}>{t(v.name)}</option>)}</select></label><p>{t('فیلدهای اختصاصی:')} {(industries[draftSettings.industry]?.fields||[]).map(x=>t(x)).join(' · ')}</p><label>{t('پیگیری پیشنهاد پس از چند ساعت؟')}<input type="number" min="1" max="720" required value={draftSettings.followup_hours} onChange={e=>setDraftSettings({...draftSettings,followup_hours:e.target.value})}/></label><label>{t('سقف تلاش برای اتصال آینده')}<input type="number" min="1" max="5" required value={draftSettings.max_attempts} onChange={e=>setDraftSettings({...draftSettings,max_attempts:e.target.value})}/></label><label><input type="checkbox" checked={draftSettings.automation_enabled} onChange={e=>setDraftSettings({...draftSettings,automation_enabled:e.target.checked})}/>{t('ساخت خودکار پیگیری برای پیشنهادهای جدید')}</label><p>{t('تغییر صنف اطلاعات قبلی را پاک نمی‌کند. زمان‌ها با ساعت دستگاه وارد و با زمان ایران نمایش داده می‌شوند.')}</p><button disabled={busy}>{t('ذخیرهٔ تنظیمات')}</button></form>}
{tables[section]&&<>{section!=='customers'&&<div className={styles.toolbar}><input aria-label={t('جست‌وجو در سیما')} placeholder={t('جست‌وجوی نام، شماره یا متن…')} value={search} onChange={e=>setSearch(e.target.value)}/>{!['customers','reports'].includes(section)&&<select aria-label={t('فیلتر مشتری')} value={filter} onChange={e=>setFilter(e.target.value)}><option value="">{t('همهٔ مشتریان')}</option>{data.customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>}{section!=='reports'&&<button disabled={busy||(!['customers'].includes(section)&&!data.customers.length)} onClick={()=>open()}>{t('افزودن')} {t(sections[section])}</button>}</div>}{section!=='customers'&&<small>{t('حداکثر ۵۰۰ رکورد اخیر هر بخش نمایش داده می‌شود.')}</small>}
{form&&<form id={section==='customers'?'sima-customer-editor':undefined} className={styles.form} onSubmit={save}><h3>{form.id?t('ویرایش'):t('ثبت')} {t(sections[section])}</h3>{section!=='customers'&&select('customer_id',t('مشتری'),Object.fromEntries(data.customers.map(c=>[c.id,c.name])))}
{section==='customers'&&<>{input('name',t('نام مشتری'),'text',true)}{input('phone',t('شماره تماس'))}{input('instagram',t('شناسهٔ اینستاگرام'))}{input('city',t('شهر'))}{input('tags',t('برچسب‌ها؛ مثل مشتری وفادار، همکار'))}{select('status',t('وضعیت'),Object.fromEntries(['new','active','dormant','closed'].map(k=>[k,statusNames[k]])))}{industry.fields.filter(label=>!fields.some(f=>f.enabled&&f.label===label)).map(field=><label key={field}>{t(field)}<input maxLength={200} value={form.custom_fields?.[field]||''} onChange={e=>setForm({...form,custom_fields:{...form.custom_fields,[field]:e.target.value}})}/></label>)}{fields.filter(f=>f.enabled).map(field=><ProfileField key={field.id} field={field} value={profileValue(form,field)} onChange={value=>setForm({...form,custom_fields:{...form.custom_fields,[field.key]:value}})}/>)}<label><input type="checkbox" checked={!!form.do_not_contact} onChange={e=>setForm({...form,do_not_contact:e.target.checked})}/>{t('توقف پیگیری خودکار این مشتری')}</label></>}
{section==='interactions'&&<>{informationQueue.find(q=>q.customer_id===form.customer_id)&&!/(شکایت|ناراضی|خراب|فوری|عجله)/.test(form.body||'')&&<div className={styles.connection}><strong>{t('اطلاعات جدید برای تعامل بعدی')}</strong><span>{informationQueue.find(q=>q.customer_id===form.customer_id).question}</span><small>{t('اول درخواست اصلی مشتری را پاسخ بدهید؛ پرسیدن این سؤال اختیاری است.')}</small></div>}{select('channel',t('کانال'),channelNames)}{select('direction',t('جهت'), {inbound:t('دریافتی'),outbound:t('ارسالی')})}{select('kind',t('نوع تعامل'),{message:t('پیام'),offer:t('پیشنهاد ارسالی'),call:t('تماس'),note:t('یادداشت')})}<label>{t('متن تعامل')}<textarea required maxLength={8000} value={form.body||''} onChange={e=>setForm({...form,body:e.target.value})}/></label></>}
{section==='leads'&&<>{input('title',t('نیاز یا فرصت'),'text',true)}{input('amount',t('مبلغ تقریبی / تومان'),'number')}{select('stage',t('مرحله'),Object.fromEntries(['new','qualified','offered','won','lost'].map(k=>[k,statusNames[k]])))}</>}
{section==='orders'&&<>{input('reference',t('شماره یا مرجع سفارش'),'text',true)}{input('amount',t('مبلغ نهایی / تومان'),'number',true)}{select('status',t('وضعیت'),Object.fromEntries(['pending','paid','cancelled'].map(k=>[k,statusNames[k]])))}<div>{(form.items||[]).map((item,i)=><div key={i}><label>{t('نام محصول')}<input required value={item.name||''} maxLength={200} onChange={e=>setForm({...form,items:form.items.map((x,j)=>j===i?{...x,name:e.target.value}:x)})}/></label><label>{t('تعداد')}<input type="number" min="1" required value={item.quantity||1} onChange={e=>setForm({...form,items:form.items.map((x,j)=>j===i?{...x,quantity:Number(e.target.value)}:x)})}/></label><label>{t('قیمت واحد / تومان')}<input type="number" min="0" required value={item.unit_price??0} onChange={e=>setForm({...form,items:form.items.map((x,j)=>j===i?{...x,unit_price:Number(e.target.value)}:x)})}/></label><button type="button" onClick={()=>setForm({...form,items:form.items.filter((_,j)=>j!==i)})}>{t('برداشتن ردیف')}</button></div>)}<button type="button" disabled={(form.items||[]).length>=30} onClick={()=>setForm({...form,items:[...(form.items||[]),{name:'',quantity:1,unit_price:0}]})}>{t('افزودن قلم سفارش')}</button></div></>}
{section==='tasks'&&<>{input('title',t('عنوان پیگیری'),'text',true)}{input('due_at',t('زمان اجرا / ساعت دستگاه'),'datetime-local',true)}{select('status',t('وضعیت'),Object.fromEntries(['scheduled','completed','cancelled'].map(k=>[k,statusNames[k]])))}{input('result',t('نتیجهٔ اقدام'))}</>}
{['customers','leads'].includes(section)&&<label>{t('یادداشت')}<textarea maxLength={4000} value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})}/></label>}<div><button disabled={busy}>{busy?t('در حال ذخیره…'):t('ذخیره')}</button><button type="button" disabled={busy} onClick={()=>setForm(null)}>{t('انصراف')}</button></div></form>}
{section==='customers'?<CustomerIntelligence db={db} userId={userId} customers={data.customers} interactions={data.interactions} orders={data.orders} leads={data.leads} tasks={data.tasks} informationQueue={informationQueue} fields={fields} onAdd={()=>open()} onEdit={record=>open(record)} onRefresh={load}/>:<><div className={styles.records}>{rows.map(r=><article key={r.id}><div><strong>{r.name||r.title||r.reference||(section==='reports'?({'crm_customers':t('پروندهٔ مشتری'),'crm_interactions':t('تعامل'),'crm_tasks':t('پیگیری'),'crm_orders':t('سفارش'),'crm_settings':t('تنظیمات'),'crm_leads':t('فرصت فروش')}[r.entity]||r.entity):customer(r.customer_id))}</strong>{r.customer_id&&<small>{customer(r.customer_id)}</small>}<p>{r.body||r.notes||r.phone||r.result||''}</p>{r.instagram&&<small dir="ltr">@{r.instagram}</small>}{r.tags&&<p>{r.tags}</p>}{r.amount!=null&&<p>{num(r.amount)} {t('تومان')}</p>}<small>{t(statusNames[r.status||r.stage])|| (r.kind==='insert'?t('ثبت جدید'):r.kind==='update'?t('ویرایش'):t(channelNames[r.channel]))}</small>{r.due_at&&<p>{date(r.due_at)}</p>}<small>{date(r.created_at)}</small></div>{!['reports','interactions'].includes(section)&&<button onClick={()=>open({...r,due_at:r.due_at?new Date(new Date(r.due_at).getTime()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16):undefined})}>{t('ویرایش')}</button>}</article>)}</div>{!rows.length&&<div className={styles.empty}>{t('هنوز رکوردی در این بخش ثبت نشده است.')}</div>}</>}
</>}
</>}</section>;
}

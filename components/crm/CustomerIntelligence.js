'use client';

import {useI18n} from '../i18n/I18nProvider';
import {tx} from '../../lib/i18n/config';
import {useEffect,useMemo,useState} from 'react';
import {
 Search,Plus,MessageSquare,ShoppingBag,CalendarClock,TrendingUp,
 Sparkles,Pencil,Phone,Instagram,MapPin,StickyNote,CheckCircle2,
 ArrowRight,ChevronLeft,Clock3,ShieldAlert,Send,UserRound
} from 'lucide-react';
import {customerIntelligence,rankCustomers} from '../../lib/crm/customer-intelligence.mjs';
import styles from './CustomerIntelligence.module.css';
import HistorySyncPanel from './HistorySyncPanel';
import {socialProfile} from '../../lib/crm/social-profile.mjs';

const statusNames={new:tx('جدید'),active:tx('فعال'),dormant:tx('راکد'),closed:tx('بایگانی')};
const stageNames={new:tx('جدید'),qualified:tx('بررسی نیاز'),offered:tx('پیشنهاد'),won:tx('موفق'),lost:tx('ناموفق')};
const filters=[['all',tx('همه')],['needs_reply',tx('منتظر پاسخ')],['followups',tx('پیگیری')],['buyers',tx('خریداران')],['opportunities',tx('فرصت‌ها')],['quiet',tx('بدون داده')]];
const tabs=[['summary',tx('نمای کلی')],['activity',tx('تاریخچه')]];

function CustomerAvatar({customer,large=false}){
 const {t,intl}=useI18n();
 const initials=name=>String(name||t('م')).trim().split(/\s+/u).slice(0,2).map(w=>w.slice(0,1)).join('').toUpperCase();
 const [failed,setFailed]=useState(false);
 const url=socialProfile(customer).avatar;
 const valid=!!url;
 return <span className={large?styles.largeAvatar:styles.avatar}>
  {valid&&!failed?<img src={url} alt={t('تصویر پروفایل {name}',{name:customer.name})} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:initials(customer.name)}
 </span>;
}
export default function CustomerIntelligence({db,userId,customers,interactions,orders,leads,tasks,informationQueue,fields,onAdd,onEdit,onRefresh}){
 const {t,intl}=useI18n();
 const readable=n=>Number(n||0).toLocaleString(intl),
  stamp=v=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString(intl,{timeZone:'Asia/Tehran',dateStyle:'medium',timeStyle:'short'}):t('ثبت نشده'),
  money=n=>readable(n)+' '+t('تومان');
 const [query,setQuery]=useState('');
 const [filter,setFilter]=useState('all');
 const [selectedId,setSelectedId]=useState('');
 const [mobileDetail,setMobileDetail]=useState(false);
 const [tab,setTab]=useState('summary');
 const [activityFilter,setActivityFilter]=useState('all');
 const [note,setNote]=useState('');
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const [busyTask,setBusyTask]=useState('');
 const [busyLead,setBusyLead]=useState('');
 const profiles=useMemo(()=>customerIntelligence(customers,interactions,orders,leads,tasks,informationQueue,Date.now(),t),[customers,interactions,orders,leads,tasks,informationQueue,t]);
 const visible=useMemo(()=>rankCustomers(profiles,filter,query),[profiles,filter,query]);
 const selected=visible.find(p=>p.customer.id===selectedId)||visible[0]||null;

 useEffect(()=>{
  const id=new URLSearchParams(window.location.search).get('sima_customer');
  if(id)setSelectedId(id);
 },[]);
 function choose(id){
  setSelectedId(id);setMobileDetail(true);setTab('summary');setActivityFilter('all');setNote('');setError('');setSuccess('');
  const url=new URL(window.location.href);
  url.searchParams.set('sima_customer',id);
  window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);
 }
 async function saveNote(e){
  e.preventDefault();
  const message=note.trim(),customerId=selected?.customer.id;
  if(!message||!customerId||saving)return;
  setSaving(true);setError('');setSuccess('');
  const {error:dbError}=await db.from('crm_interactions').insert({tenant_id:userId,customer_id:customerId,channel:'manual',direction:'outbound',kind:'note',body:message});
  if(dbError)setError(t('یادداشت ذخیره نشد؛ اتصال و دسترسی سیما را بررسی کنید.'));
  else{setNote('');setSuccess(t('یادداشت به تاریخچهٔ همین مشتری اضافه شد.'));onRefresh?.();}
  setSaving(false);
 }
 async function completeTask(taskId){
  if(!selected||busyTask)return;
  setBusyTask(taskId);setError('');setSuccess('');
  const {error:dbError}=await db.from('crm_tasks').update({status:'completed',result:t('تکمیل‌شده از پروفایل مشتری')}).eq('id',taskId).eq('tenant_id',userId).eq('customer_id',selected.customer.id).eq('status','scheduled');
  if(dbError)setError(t('تغییر وضعیت پیگیری ذخیره نشد.'));
  else{setSuccess(t('وضعیت پیگیری ثبت شد.'));onRefresh?.();}
  setBusyTask('');
 }
 async function advanceLead(lead){
  const stages=['new','qualified','offered','won'];
  const index=stages.indexOf(lead.stage);
  if(!selected||busyLead||index<0||index>=stages.length-1)return;
  setBusyLead(lead.id);setError('');setSuccess('');
  const {data:updated,error:dbError}=await db.from('crm_leads')
   .update({stage:stages[index+1]})
   .eq('id',lead.id).eq('tenant_id',userId).eq('customer_id',selected.customer.id).eq('stage',lead.stage)
   .select('id').maybeSingle();
  if(dbError||!updated)setError(t('مرحلهٔ فرصت تغییر نکرد؛ دسترسی و وضعیت فعلی را بررسی کنید.'));
  else{setSuccess(t('مرحلهٔ فرصت فروش ثبت شد.'));await onRefresh?.();}
  setBusyLead('');
 }
 const counts={
  needs_reply:profiles.filter(p=>p.needsReply).length,
  followups:profiles.filter(p=>p.overdue||p.scheduled.length>0).length,
  buyers:profiles.filter(p=>p.orderCount>0).length,
  opportunities:profiles.filter(p=>p.opportunities.length>0).length,
  quiet:profiles.filter(p=>p.score===null).length
 };
 const timeline=selected?.timeline.filter(tp=>activityFilter==='all'||tp.type===activityFilter)||[];
 const customer=selected?.customer;
 const customFields=Object.entries(customer?.custom_fields||{}).filter(([k,v])=>v!==''&&v!=null&&(typeof v==='string'||typeof v==='number'||Array.isArray(v))&&!k.startsWith('__')&&!['social_avatar_url','social_username','social_platform'].includes(k)).slice(0,40);
 const labels=new Map((fields||[]).map(f=>[f.key,f.label]));
 return <div className={styles.shell} dir="rtl" aria-label={t('پرونده هوشمند مشتریان سیما')}>
  <div className={styles.topline}>
   <div><div className={styles.eyebrow}><Sparkles size={14}/> DELSA / SIMA CUSTOMER INTELLIGENCE</div><h3>{t('پروفایل هوشمند مشتریان')}</h3><p>{t('داده‌های واقعی، تاریخچهٔ ارتباطات و اقدام بعدی در یک نمای واحد')}</p></div>
   <button type="button" className={styles.primary} onClick={onAdd}><Plus size={16}/> {t('مشتری جدید')}</button>
  </div>
  <HistorySyncPanel onRefresh={onRefresh}/>
  <div className={styles.columns}>
   <aside className={styles.queue+(mobileDetail?' '+styles.hideMobile:'')} aria-label={t('فهرست مشتریان')}>
    <div className={styles.sideHeader}><div><span className={styles.eyebrow}>MY CUSTOMERS</span><h4>{t('مشتریان')} <span className={styles.count}>{readable(customers.length)}</span></h4></div><UserRound size={19}/></div>
    <label className={styles.search}><Search size={16}/><input aria-label={t('جست‌وجوی مشتری')} value={query} onChange={e=>{setQuery(e.target.value);setMobileDetail(false);}} placeholder={t('نام، شماره، اینستاگرام، برچسب…')}/></label>
    <div className={styles.filters} role="group" aria-label={t('فیلتر مشتریان')}>{filters.map(([k,v])=><button key={k} type="button" aria-pressed={filter===k} className={filter===k?styles.chosen:''} onClick={()=>{setFilter(k);setMobileDetail(false);}}>{t(v)}{counts[k]>0&&<small>{readable(counts[k])}</small>}</button>)}</div>
    <div className={styles.queueItems}>{visible.map((p,i)=><button key={p.customer.id} type="button" aria-current={selected?.customer.id===p.customer.id?'true':undefined} className={styles.queueItem+(selected?.customer.id===p.customer.id?' '+styles.queueActive:'')} style={{'--i':Math.min(i,10)}} onClick={()=>choose(p.customer.id)}>
     <CustomerAvatar customer={p.customer}/>
     <span className={styles.queueName}><strong>{p.customer.name}</strong><small>{p.needsReply?t('پیام منتظر پاسخ'):p.overdue?t('پیگیری سررسید شده'):(p.customer.instagram||p.customer.custom_fields?.social_username)?'@'+(p.customer.instagram||p.customer.custom_fields?.social_username):(t(statusNames[p.customer.status])||t('پرونده مشتری'))}</small></span>
     <span className={styles.queueScore}>{p.score==null?'—':readable(p.score)}</span>
    </button>)}</div>
    {!visible.length&&<div className={styles.emptyList}><Search size={21}/><p>{customers.length?t('مشتری‌ای با این فیلتر پیدا نشد.'):t('هنوز مشتری ثبت نشده است.')}</p></div>}
    <div className={styles.queueFooter}><span>{t('اولویت‌ها با قواعد شفاف و بر اساس سوابق ثبت‌شده مرتب شده‌اند.')}</span></div>
   </aside>
   <section className={styles.main+(mobileDetail?' '+styles.showMobile:'')} aria-label={t('پرونده انتخاب‌شده')}>
    {!selected?<div className={styles.blank}><UserRound size={36}/><h4>{t('مشتری انتخاب نشده است')}</h4><p>{t('برای دیدن پرونده یک مشتری از فهرست انتخاب کنید.')}</p></div>:<>
     <button type="button" className={styles.back} onClick={()=>setMobileDetail(false)}><ArrowRight size={16}/> {t('بازگشت به فهرست')}</button>
     <header className={styles.profileHead}><CustomerAvatar customer={customer} large/><div className={styles.profileTitle}><div className={styles.eyebrow}>CUSTOMER 360° PROFILE</div><h3>{customer.name}</h3><div className={styles.profileBadges}><span>{t(statusNames[customer.status])||t('مشتری')}</span>{(customer.instagram||customer.custom_fields?.social_username)&&<span dir="ltr">@{customer.instagram||customer.custom_fields?.social_username}</span>}{customer.do_not_contact&&<span className={styles.warn}>{t('عدم تماس')}</span>}</div></div><button type="button" className={styles.edit} onClick={()=>onEdit(customer)}><Pencil size={15}/> {t('ویرایش پرونده')}</button></header>
     <div className={styles.miniStats}><div><span><MessageSquare size={14}/> {t('تعاملات ثبت‌شده')}</span><strong>{readable(selected.interactionCount)}</strong></div><div><span><ShoppingBag size={14}/> {t('خریدهای ثبت‌شده')}</span><strong>{readable(selected.orderCount)}</strong></div><div><span><TrendingUp size={14}/> {t('مجموع خرید ثبت‌شده')}</span><strong>{money(selected.spend)}</strong></div></div>
     <div className={styles.tabs} role="tablist" aria-label={t('بخش پرونده')}>{tabs.map(([k,v])=><button role="tab" aria-selected={tab===k} type="button" className={tab===k?styles.tabActive:''} key={k} onClick={()=>setTab(k)}>{t(v)}</button>)}</div>
     {tab==='summary'?<div className={styles.content}>
      <div className={styles.groupTitle}><h4>{t('راه‌های ارتباط و اطلاعات')}</h4><small>{t('فقط اطلاعات ثبت‌شده')}</small></div>
      <div className={styles.contactGrid}><div><Phone size={16}/><span><small>{t('شماره تماس')}</small><strong dir="ltr">{customer.phone||t('ثبت نشده')}</strong></span></div><div><Instagram size={16}/><span><small>{t('اینستاگرام')}</small>{(() => {
 const handle=customer.instagram||customer.custom_fields?.social_username||'';
 const valid=/^[A-Za-z0-9._]{1,30}$/.test(handle);
 return valid?<a href={'https://www.instagram.com/'+encodeURIComponent(handle)+'/'} target="_blank" rel="noopener noreferrer" dir="ltr">@{handle} ↗</a>
  :<strong dir="ltr">{handle?'@'+handle:t('شناسهٔ معتبر موجود نیست')}</strong>;
})()}</span></div><div><MapPin size={16}/><span><small>{t('شهر')}</small><strong>{customer.city||t('ثبت نشده')}</strong></span></div><div><Clock3 size={16}/><span><small>{t('آخرین تعامل ثبت‌شده')}</small><strong>{stamp(selected.lastContact)}</strong></span></div></div>
      {!!customer.tags?.trim()&&<div className={styles.tags}>{customer.tags.split(/[,،]/).map(tp=>tp.trim()).filter(Boolean).slice(0,16).map(tp=><span key={tp}>{tp}</span>)}</div>}
      {!!customer.notes?.trim()&&<div className={styles.noteBox}><StickyNote size={16}/><div><strong>{t('یادداشت پرونده')}</strong><p>{customer.notes}</p></div></div>}
      {!!customFields.length&&<><div className={styles.groupTitle}><h4>{t('اطلاعات اختصاصی')}</h4><small>{readable(customFields.length)} {t('فیلد')}</small></div><div className={styles.dynamicFields}>{customFields.map(([k,v])=><div key={k}><small>{labels.get(k)||k}</small><strong>{Array.isArray(v)?v.join(t('، ')):String(v)}</strong></div>)}</div></>}
      <div className={styles.groupTitle}><h4><Sparkles size={15}/> {t('نیازهای مطرح‌شده در پیام‌ها')}</h4><small>{t('قواعد متنی قابل‌ردیابی')}</small></div>
      {selected.needs?.length?<div className={styles.needGrid}>{selected.needs.map(need=><article key={need.key} className={styles.needItem}><strong>{t(need.label)}</strong><p>«{need.evidence}»</p><small>{stamp(need.at)} {t('· پیام دریافتی')}</small></article>)}</div>:<p className={styles.emptyText}>{t('هنوز نشانهٔ قابل اتکایی از نیاز مشتری در پیام‌های ثبت‌شده پیدا نشده است.')}</p>}
      <div className={styles.groupTitle}><h4>{t('فرصت‌های فروش')}</h4><small>{readable(selected.opportunities.length)} {t('فرصت باز')}</small></div>
      {selected.opportunities.length?<div className={styles.leadItems}>{selected.opportunities.slice(0,5).map(l=><div key={l.id} className={styles.leadCard}><div className={styles.leadTop}><strong>{l.title}</strong><span>{t(stageNames[l.stage])||t('در جریان')}</span>{l.amount!=null&&<small>{money(l.amount)}</small>}</div><div className={styles.stageTrack} role="group" aria-label={t('مراحل فرصت فروش')}>{['new','qualified','offered','won'].map((stage,i)=><span key={stage} className={['new','qualified','offered','won'].indexOf(l.stage)>=i?styles.stageDone:''}>{t(stageNames[stage])}</span>)}</div><button type="button" disabled={!!busyLead} onClick={()=>advanceLead(l)}>{busyLead===l.id?t('در حال ثبت…'):t('بردن به مرحله بعد ←')}</button></div>)}</div>:<p className={styles.emptyText}>{t('فرصت فروش فعالی برای این مشتری ثبت نشده است.')}</p>}
      <div className={styles.groupTitle}><h4>{t('آخرین فعالیت‌ها')}</h4><button type="button" onClick={()=>setTab('activity')}>{t('دیدن همه')} <ChevronLeft size={14}/></button></div>
      <History items={selected.timeline.slice(0,5)}/>
     </div>:<div className={styles.content}>
      <div className={styles.groupTitle}><h4>{t('تاریخچهٔ فعالیت‌های ثبت‌شده')}</h4><small>{t('حداکثر ۹۰ رویداد اخیر از داده‌های بارگذاری‌شده')}</small></div>
      <form className={styles.addNote} onSubmit={saveNote}><label htmlFor="sima-customer-note">{t('افزودن یادداشت داخلی')}</label><textarea id="sima-customer-note" value={note} maxLength={8000} onChange={e=>setNote(e.target.value)} placeholder={t('مثلاً نیاز جدید مشتری، ترجیح خرید، نتیجهٔ گفت‌وگو…')}/><button type="submit" disabled={saving||!note.trim()}><Send size={14}/> {saving?t('در حال ثبت…'):t('ثبت یادداشت')}</button></form>
      <div className={styles.activityFilters}>{[['all',t('همه')],['interaction',t('تعامل')],['order',t('سفارش')],['lead',t('فرصت')],['task',t('پیگیری')]].map(([k,v])=><button type="button" key={k} className={activityFilter===k?styles.chosen:''} onClick={()=>setActivityFilter(k)}>{v}</button>)}</div>
      <CustomerFullHistory key={customer.id} db={db} tenantId={userId} customerId={customer.id} fallback={timeline} filter={activityFilter}/>
     </div>}
    </>}
   </section>
   <aside className={styles.insight+(mobileDetail?' '+styles.showMobile:'')} aria-label={t('تحلیل و پیگیری مشتری')}>
    {selected&&<>
     <div className={styles.scorePanel}><span className={styles.eyebrow}><Sparkles size={14}/> CUSTOMER SIGNALS</span><h4>{t('اولویت ارتباط')}</h4><div className={styles.scoreRing} style={{'--score':selected.score??0}}><div><strong>{selected.score==null?'—':readable(selected.score)}</strong><small>{selected.score==null?t('داده ناکافی'):selected.score>=75?t('اولویت بالا'):selected.score>=50?t('اولویت متوسط'):t('اولویت معمول')}</small></div></div><p>{t('امتیاز قواعدی بر اساس فعالیت ثبت‌شده است؛ نه پیش‌بینی قطعی خرید یا قضاوت دربارهٔ مشتری.')}</p>
      <div className={styles.reasons}>{selected.reasons.length?selected.reasons.slice(0,6).map((r,i)=><span key={i} className={r.positive?styles.positive:styles.negative}><span>{r.positive?'↗':'↘'}</span>{r.text}</span>):<span>{t('برای محاسبهٔ امتیاز، سابقهٔ تعامل، خرید یا پیگیری لازم است.')}</span>}</div></div>
     <div className={styles.nextPanel}><div className={styles.groupTitle}><h4><CalendarClock size={16}/> {t('قدم بعدی')}</h4></div><div className={styles.nextCard}><strong>{selected.next.title}</strong><p>{selected.next.description}</p>{selected.next.kind==='blocked'&&<ShieldAlert size={17} aria-label={t('عدم تماس')}/>}</div>
      {selected.scheduled.slice(0,3).map(tp=><div className={styles.taskRow} key={tp.id}><div><strong>{tp.title}</strong><small>{t('سررسید:')} {stamp(tp.due_at)}</small></div><button type="button" disabled={!!busyTask} onClick={()=>completeTask(tp.id)} title={t('ثبت تکمیل پیگیری')}><CheckCircle2 size={17}/></button></div>)}
      {!selected.scheduled.length&&<p className={styles.emptyText}>{t('پیگیری زمان‌بندی‌شده‌ای وجود ندارد.')}</p>}
     </div>
     {(error||success)&&<p role={error?'alert':'status'} className={error?styles.error:styles.success}>{error||success}</p>}
    </>}
   </aside>
  </div>
  <div className={styles.dynamicTable}>
    <div className={styles.dynamicHeading}><div><h4>{t('جدول اطلاعات مشتریان')}</h4><p>{t('فیلدهای صنفی و ستون‌هایی که سیما از سؤال‌های پرتکرار یاد می‌گیرد')}</p></div><span>{readable(fields.filter(f=>f.enabled).length)} {t('ستون اختصاصی')}</span></div>
    <div className={styles.dynamicScroll}><table><thead><tr><th>{t('مشتری')}</th><th>{t('شماره تماس')}</th><th>{t('اینستاگرام')}</th>{fields.filter(f=>f.enabled).slice(0,30).map(f=><th key={f.id}>{t(f.label)}</th>)}</tr></thead><tbody>{customers.map(c=><tr key={c.id}><td><button type="button" onClick={()=>choose(c.id)}>{c.name}</button></td><td dir="ltr">{c.phone||'—'}</td><td dir="ltr">{c.instagram||c.custom_fields?.social_username||'—'}</td>{fields.filter(f=>f.enabled).slice(0,30).map(f=>{const value=c.custom_fields?.[f.key];return <td key={f.id}>{Array.isArray(value)?value.join(t('، ')):value!=null&&value!==''?String(value):'—'}</td>;})}</tr>)}</tbody></table></div>
  </div>
  <div className={styles.footnote}>{t('خلاصهٔ نیازها بر اساس واژه‌های موجود در پیام‌های دریافتی و بدون ارسال متن به سرویس هوش مصنوعی خارجی ساخته می‌شود؛ این دسته‌بندی ممکن است نیاز به اصلاح انسانی داشته باشد. هر بخش بر اساس حداکثر ۵۰۰ رکورد اخیرِ بارگذاری‌شدهٔ سیما محاسبه می‌شود.')}</div>
 </div>;
}

function CustomerFullHistory({db,tenantId,customerId,fallback,filter}){
 const {t,intl}=useI18n();
 const [rows,setRows]=useState([]);
 const [page,setPage]=useState(0);
 const [hasMore,setHasMore]=useState(true);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{
  let cancelled=false;
  (async()=>{
   setLoading(true);setError('');
   try{
    const {data,error}=await db.from('crm_interactions')
      .select('id,customer_id,kind,channel,direction,body,occurred_at,created_at')
      .eq('tenant_id',tenantId).eq('customer_id',customerId)
      .order('occurred_at',{ascending:false}).range(page*100,page*100+99);
    if(error)throw error;
    if(!cancelled){
     setRows(old=>{const map=new Map((page===0?[]:old).map(r=>[r.id,r]));for(const r of data)map.set(r.id,r);return [...map.values()];});
     setHasMore(data.length===100);
    }
   }catch{if(!cancelled)setError(t('دریافت پیام‌های قدیمی‌تر انجام نشد.'));}
   finally{if(!cancelled)setLoading(false);}
  })();
  return()=>{cancelled=true;};
 },[db,tenantId,customerId,page]);
 const messageRows=rows.map(r=>({id:'i:'+r.id,type:'interaction',label:r.kind==='note'?t('یادداشت'):r.kind==='call'?t('تماس'):r.kind==='offer'?t('پیشنهاد'):t('پیام'),kind:r.kind,direction:r.direction,channel:r.channel,text:r.body,at:r.occurred_at||r.created_at}));
 const all=new Map(fallback.map(r=>[r.id,r]));for(const item of messageRows)all.set(item.id,item);
 const items=[...all.values()].filter(r=>filter==='all'||r.type===filter).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
 return <div>
  <History items={items}/>
  {error&&<p role="alert" className={styles.emptyText}>{error}</p>}
  {hasMore&&<button type="button" disabled={loading} className={styles.loadHistory} onClick={()=>setPage(x=>x+1)}>{loading?t('در حال دریافت پیام‌ها…'):t('بارگذاری ۱۰۰ پیام قدیمی‌تر')}</button>}
  {!hasMore&&<small className={styles.historyEnd}>{t('انتهای تاریخچهٔ ثبت‌شده در سیما')}</small>}
 </div>;
}
function History({items}){
 const {t,intl}=useI18n();
 const stamp=v=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString(intl,{timeZone:'Asia/Tehran',dateStyle:'medium',timeStyle:'short'}):t('ثبت نشده');
 if(!items.length)return <div className={styles.emptyHistory}>{t('هنوز فعالیتی در تاریخچهٔ این مشتری ثبت نشده است.')}</div>;
 return <div className={styles.history}>{items.map((item,i)=><article key={item.id||i} className={styles.event}><span className={styles.eventDot}>{item.type==='order'?<ShoppingBag size={14}/>:item.type==='task'?<CalendarClock size={14}/>:item.type==='lead'?<TrendingUp size={14}/>:<MessageSquare size={14}/>}</span><div><div className={styles.eventHeading}><strong>{item.label}</strong><small>{stamp(item.at)}</small></div><p>{item.text}</p>{item.channel&&<small>{item.channel} · {item.kind==='note'?t('یادداشت داخلی'):item.direction==='inbound'?t('دریافتی'):t('ارسالی/ثبت‌شده')}</small>}</div></article>)}</div>;
}

'use client';

import {useEffect,useMemo,useState} from 'react';
import {
 Search,Plus,MessageSquare,ShoppingBag,CalendarClock,TrendingUp,
 Sparkles,Pencil,Phone,Instagram,MapPin,StickyNote,CheckCircle2,
 ArrowRight,ChevronLeft,Clock3,ShieldAlert,Send,UserRound
} from 'lucide-react';
import {customerIntelligence,rankCustomers} from '../../lib/crm/customer-intelligence.mjs';
import styles from './CustomerIntelligence.module.css';
import HistorySyncPanel from './HistorySyncPanel';

const readable=n=>Number(n||0).toLocaleString('fa-IR');
const stamp=v=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('fa-IR',{timeZone:'Asia/Tehran',dateStyle:'medium',timeStyle:'short'}):'ثبت نشده';
const statusNames={new:'جدید',active:'فعال',dormant:'راکد',closed:'بایگانی'};
const stageNames={new:'جدید',qualified:'بررسی نیاز',offered:'پیشنهاد',won:'موفق',lost:'ناموفق'};
const filters=[['all','همه'],['needs_reply','منتظر پاسخ'],['followups','پیگیری'],['buyers','خریداران'],['opportunities','فرصت‌ها'],['quiet','بدون داده']];
const tabs=[['summary','نمای کلی'],['activity','تاریخچه']];
const initials=name=>String(name||'م').trim().split(/\s+/u).slice(0,2).map(w=>w.slice(0,1)).join('').toUpperCase();
const money=n=>readable(n)+' تومان';

function CustomerAvatar({customer,large=false}){
 const [failed,setFailed]=useState(false);
 const url=customer?.custom_fields?.social_avatar_url;
 const valid=typeof url==='string'&&/^https:\/\/[^\\s]+$/i.test(url)&&url.length<=2048;
 return <span className={large?styles.largeAvatar:styles.avatar}>
  {valid&&!failed?<img src={url} alt={`تصویر پروفایل ${customer.name}`} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:initials(customer.name)}
 </span>;
}
export default function CustomerIntelligence({db,userId,customers,interactions,orders,leads,tasks,informationQueue,fields,onAdd,onEdit,onRefresh}){
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
 const profiles=useMemo(()=>customerIntelligence(customers,interactions,orders,leads,tasks,informationQueue),[customers,interactions,orders,leads,tasks,informationQueue]);
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
  if(dbError)setError('یادداشت ذخیره نشد؛ اتصال و دسترسی سیما را بررسی کنید.');
  else{setNote('');setSuccess('یادداشت به تاریخچهٔ همین مشتری اضافه شد.');onRefresh?.();}
  setSaving(false);
 }
 async function completeTask(taskId){
  if(!selected||busyTask)return;
  setBusyTask(taskId);setError('');setSuccess('');
  const {error:dbError}=await db.from('crm_tasks').update({status:'completed',result:'تکمیل‌شده از پروفایل مشتری'}).eq('id',taskId).eq('tenant_id',userId).eq('customer_id',selected.customer.id).eq('status','scheduled');
  if(dbError)setError('تغییر وضعیت پیگیری ذخیره نشد.');
  else{setSuccess('وضعیت پیگیری ثبت شد.');onRefresh?.();}
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
  if(dbError||!updated)setError('مرحلهٔ فرصت تغییر نکرد؛ دسترسی و وضعیت فعلی را بررسی کنید.');
  else{setSuccess('مرحلهٔ فرصت فروش ثبت شد.');await onRefresh?.();}
  setBusyLead('');
 }
 const counts={
  needs_reply:profiles.filter(p=>p.needsReply).length,
  followups:profiles.filter(p=>p.overdue||p.scheduled.length>0).length,
  buyers:profiles.filter(p=>p.orderCount>0).length,
  opportunities:profiles.filter(p=>p.opportunities.length>0).length,
  quiet:profiles.filter(p=>p.score===null).length
 };
 const timeline=selected?.timeline.filter(t=>activityFilter==='all'||t.type===activityFilter)||[];
 const customer=selected?.customer;
 const customFields=Object.entries(customer?.custom_fields||{}).filter(([k,v])=>v!==''&&v!=null&&(typeof v==='string'||typeof v==='number'||Array.isArray(v))&&!k.startsWith('__')&&!['social_avatar_url','social_username','social_platform'].includes(k)).slice(0,40);
 const labels=new Map((fields||[]).map(f=>[f.key,f.label]));
 return <div className={styles.shell} dir="rtl" aria-label="پرونده هوشمند مشتریان سیما">
  <div className={styles.topline}>
   <div><div className={styles.eyebrow}><Sparkles size={14}/> DELSA / SIMA CUSTOMER INTELLIGENCE</div><h3>پروفایل هوشمند مشتریان</h3><p>داده‌های واقعی، تاریخچهٔ ارتباطات و اقدام بعدی در یک نمای واحد</p></div>
   <button type="button" className={styles.primary} onClick={onAdd}><Plus size={16}/> مشتری جدید</button>
  </div>
  <HistorySyncPanel onRefresh={onRefresh}/>
  <div className={styles.columns}>
   <aside className={styles.queue+(mobileDetail?' '+styles.hideMobile:'')} aria-label="فهرست مشتریان">
    <div className={styles.sideHeader}><div><span className={styles.eyebrow}>MY CUSTOMERS</span><h4>مشتریان <span className={styles.count}>{readable(customers.length)}</span></h4></div><UserRound size={19}/></div>
    <label className={styles.search}><Search size={16}/><input aria-label="جست‌وجوی مشتری" value={query} onChange={e=>{setQuery(e.target.value);setMobileDetail(false);}} placeholder="نام، شماره، اینستاگرام، برچسب…"/></label>
    <div className={styles.filters} role="group" aria-label="فیلتر مشتریان">{filters.map(([k,v])=><button key={k} type="button" aria-pressed={filter===k} className={filter===k?styles.chosen:''} onClick={()=>{setFilter(k);setMobileDetail(false);}}>{v}{counts[k]>0&&<small>{readable(counts[k])}</small>}</button>)}</div>
    <div className={styles.queueItems}>{visible.map((p,i)=><button key={p.customer.id} type="button" aria-current={selected?.customer.id===p.customer.id?'true':undefined} className={styles.queueItem+(selected?.customer.id===p.customer.id?' '+styles.queueActive:'')} style={{'--i':Math.min(i,10)}} onClick={()=>choose(p.customer.id)}>
     <CustomerAvatar customer={p.customer}/>
     <span className={styles.queueName}><strong>{p.customer.name}</strong><small>{p.needsReply?'پیام منتظر پاسخ':p.overdue?'پیگیری سررسید شده':(p.customer.instagram||p.customer.custom_fields?.social_username)?'@'+(p.customer.instagram||p.customer.custom_fields?.social_username):(statusNames[p.customer.status]||'پرونده مشتری')}</small></span>
     <span className={styles.queueScore}>{p.score==null?'—':readable(p.score)}</span>
    </button>)}</div>
    {!visible.length&&<div className={styles.emptyList}><Search size={21}/><p>{customers.length?'مشتری‌ای با این فیلتر پیدا نشد.':'هنوز مشتری ثبت نشده است.'}</p></div>}
    <div className={styles.queueFooter}><span>اولویت‌ها با قواعد شفاف و بر اساس سوابق ثبت‌شده مرتب شده‌اند.</span></div>
   </aside>
   <section className={styles.main+(mobileDetail?' '+styles.showMobile:'')} aria-label="پرونده انتخاب‌شده">
    {!selected?<div className={styles.blank}><UserRound size={36}/><h4>مشتری انتخاب نشده است</h4><p>برای دیدن پرونده یک مشتری از فهرست انتخاب کنید.</p></div>:<>
     <button type="button" className={styles.back} onClick={()=>setMobileDetail(false)}><ArrowRight size={16}/> بازگشت به فهرست</button>
     <header className={styles.profileHead}><CustomerAvatar customer={customer} large/><div className={styles.profileTitle}><div className={styles.eyebrow}>CUSTOMER 360° PROFILE</div><h3>{customer.name}</h3><div className={styles.profileBadges}><span>{statusNames[customer.status]||'مشتری'}</span>{(customer.instagram||customer.custom_fields?.social_username)&&<span dir="ltr">@{customer.instagram||customer.custom_fields?.social_username}</span>}{customer.do_not_contact&&<span className={styles.warn}>عدم تماس</span>}</div></div><button type="button" className={styles.edit} onClick={()=>onEdit(customer)}><Pencil size={15}/> ویرایش پرونده</button></header>
     <div className={styles.miniStats}><div><span><MessageSquare size={14}/> تعاملات ثبت‌شده</span><strong>{readable(selected.interactionCount)}</strong></div><div><span><ShoppingBag size={14}/> خریدهای ثبت‌شده</span><strong>{readable(selected.orderCount)}</strong></div><div><span><TrendingUp size={14}/> مجموع خرید ثبت‌شده</span><strong>{money(selected.spend)}</strong></div></div>
     <div className={styles.tabs} role="tablist" aria-label="بخش پرونده">{tabs.map(([k,v])=><button role="tab" aria-selected={tab===k} type="button" className={tab===k?styles.tabActive:''} key={k} onClick={()=>setTab(k)}>{v}</button>)}</div>
     {tab==='summary'?<div className={styles.content}>
      <div className={styles.groupTitle}><h4>راه‌های ارتباط و اطلاعات</h4><small>فقط اطلاعات ثبت‌شده</small></div>
      <div className={styles.contactGrid}><div><Phone size={16}/><span><small>شماره تماس</small><strong dir="ltr">{customer.phone||'ثبت نشده'}</strong></span></div><div><Instagram size={16}/><span><small>اینستاگرام</small>{(() => {
 const handle=customer.instagram||customer.custom_fields?.social_username||'';
 const valid=/^[A-Za-z0-9._]{1,30}$/.test(handle);
 return valid?<a href={'https://www.instagram.com/'+encodeURIComponent(handle)+'/'} target="_blank" rel="noopener noreferrer" dir="ltr">@{handle} ↗</a>
  :<strong dir="ltr">{handle?'@'+handle:'شناسهٔ معتبر موجود نیست'}</strong>;
})()}</span></div><div><MapPin size={16}/><span><small>شهر</small><strong>{customer.city||'ثبت نشده'}</strong></span></div><div><Clock3 size={16}/><span><small>آخرین تعامل ثبت‌شده</small><strong>{stamp(selected.lastContact)}</strong></span></div></div>
      {!!customer.tags?.trim()&&<div className={styles.tags}>{customer.tags.split(/[,،]/).map(t=>t.trim()).filter(Boolean).slice(0,16).map(t=><span key={t}>{t}</span>)}</div>}
      {!!customer.notes?.trim()&&<div className={styles.noteBox}><StickyNote size={16}/><div><strong>یادداشت پرونده</strong><p>{customer.notes}</p></div></div>}
      {!!customFields.length&&<><div className={styles.groupTitle}><h4>اطلاعات اختصاصی</h4><small>{readable(customFields.length)} فیلد</small></div><div className={styles.dynamicFields}>{customFields.map(([k,v])=><div key={k}><small>{labels.get(k)||k}</small><strong>{Array.isArray(v)?v.join('، '):String(v)}</strong></div>)}</div></>}
      <div className={styles.groupTitle}><h4><Sparkles size={15}/> نیازهای مطرح‌شده در پیام‌ها</h4><small>قواعد متنی قابل‌ردیابی</small></div>
      {selected.needs?.length?<div className={styles.needGrid}>{selected.needs.map(need=><article key={need.key} className={styles.needItem}><strong>{need.label}</strong><p>«{need.evidence}»</p><small>{stamp(need.at)} · پیام دریافتی</small></article>)}</div>:<p className={styles.emptyText}>هنوز نشانهٔ قابل اتکایی از نیاز مشتری در پیام‌های ثبت‌شده پیدا نشده است.</p>}
      <div className={styles.groupTitle}><h4>فرصت‌های فروش</h4><small>{readable(selected.opportunities.length)} فرصت باز</small></div>
      {selected.opportunities.length?<div className={styles.leadItems}>{selected.opportunities.slice(0,5).map(l=><div key={l.id} className={styles.leadCard}><div className={styles.leadTop}><strong>{l.title}</strong><span>{stageNames[l.stage]||'در جریان'}</span>{l.amount!=null&&<small>{money(l.amount)}</small>}</div><div className={styles.stageTrack} role="group" aria-label="مراحل فرصت فروش">{['new','qualified','offered','won'].map((stage,i)=><span key={stage} className={['new','qualified','offered','won'].indexOf(l.stage)>=i?styles.stageDone:''}>{stageNames[stage]}</span>)}</div><button type="button" disabled={!!busyLead} onClick={()=>advanceLead(l)}>{busyLead===l.id?'در حال ثبت…':'بردن به مرحله بعد ←'}</button></div>)}</div>:<p className={styles.emptyText}>فرصت فروش فعالی برای این مشتری ثبت نشده است.</p>}
      <div className={styles.groupTitle}><h4>آخرین فعالیت‌ها</h4><button type="button" onClick={()=>setTab('activity')}>دیدن همه <ChevronLeft size={14}/></button></div>
      <History items={selected.timeline.slice(0,5)}/>
     </div>:<div className={styles.content}>
      <div className={styles.groupTitle}><h4>تاریخچهٔ فعالیت‌های ثبت‌شده</h4><small>حداکثر ۹۰ رویداد اخیر از داده‌های بارگذاری‌شده</small></div>
      <form className={styles.addNote} onSubmit={saveNote}><label htmlFor="sima-customer-note">افزودن یادداشت داخلی</label><textarea id="sima-customer-note" value={note} maxLength={8000} onChange={e=>setNote(e.target.value)} placeholder="مثلاً نیاز جدید مشتری، ترجیح خرید، نتیجهٔ گفت‌وگو…"/><button type="submit" disabled={saving||!note.trim()}><Send size={14}/> {saving?'در حال ثبت…':'ثبت یادداشت'}</button></form>
      <div className={styles.activityFilters}>{[['all','همه'],['interaction','تعامل'],['order','سفارش'],['lead','فرصت'],['task','پیگیری']].map(([k,v])=><button type="button" key={k} className={activityFilter===k?styles.chosen:''} onClick={()=>setActivityFilter(k)}>{v}</button>)}</div>
      <CustomerFullHistory key={customer.id} db={db} tenantId={userId} customerId={customer.id} fallback={timeline} filter={activityFilter}/>
     </div>}
    </>}
   </section>
   <aside className={styles.insight+(mobileDetail?' '+styles.showMobile:'')} aria-label="تحلیل و پیگیری مشتری">
    {selected&&<>
     <div className={styles.scorePanel}><span className={styles.eyebrow}><Sparkles size={14}/> CUSTOMER SIGNALS</span><h4>اولویت ارتباط</h4><div className={styles.scoreRing} style={{'--score':selected.score??0}}><div><strong>{selected.score==null?'—':readable(selected.score)}</strong><small>{selected.score==null?'داده ناکافی':selected.score>=75?'اولویت بالا':selected.score>=50?'اولویت متوسط':'اولویت معمول'}</small></div></div><p>امتیاز قواعدی بر اساس فعالیت ثبت‌شده است؛ نه پیش‌بینی قطعی خرید یا قضاوت دربارهٔ مشتری.</p>
      <div className={styles.reasons}>{selected.reasons.length?selected.reasons.slice(0,6).map((r,i)=><span key={i} className={r.positive?styles.positive:styles.negative}><span>{r.positive?'↗':'↘'}</span>{r.text}</span>):<span>برای محاسبهٔ امتیاز، سابقهٔ تعامل، خرید یا پیگیری لازم است.</span>}</div></div>
     <div className={styles.nextPanel}><div className={styles.groupTitle}><h4><CalendarClock size={16}/> قدم بعدی</h4></div><div className={styles.nextCard}><strong>{selected.next.title}</strong><p>{selected.next.description}</p>{selected.next.kind==='blocked'&&<ShieldAlert size={17} aria-label="عدم تماس"/>}</div>
      {selected.scheduled.slice(0,3).map(t=><div className={styles.taskRow} key={t.id}><div><strong>{t.title}</strong><small>سررسید: {stamp(t.due_at)}</small></div><button type="button" disabled={!!busyTask} onClick={()=>completeTask(t.id)} title="ثبت تکمیل پیگیری"><CheckCircle2 size={17}/></button></div>)}
      {!selected.scheduled.length&&<p className={styles.emptyText}>پیگیری زمان‌بندی‌شده‌ای وجود ندارد.</p>}
     </div>
     {(error||success)&&<p role={error?'alert':'status'} className={error?styles.error:styles.success}>{error||success}</p>}
    </>}
   </aside>
  </div>
  <div className={styles.dynamicTable}>
    <div className={styles.dynamicHeading}><div><h4>جدول اطلاعات مشتریان</h4><p>فیلدهای صنفی و ستون‌هایی که سیما از سؤال‌های پرتکرار یاد می‌گیرد</p></div><span>{readable(fields.filter(f=>f.enabled).length)} ستون اختصاصی</span></div>
    <div className={styles.dynamicScroll}><table><thead><tr><th>مشتری</th><th>شماره تماس</th><th>اینستاگرام</th>{fields.filter(f=>f.enabled).slice(0,30).map(f=><th key={f.id}>{f.label}</th>)}</tr></thead><tbody>{customers.map(c=><tr key={c.id}><td><button type="button" onClick={()=>choose(c.id)}>{c.name}</button></td><td dir="ltr">{c.phone||'—'}</td><td dir="ltr">{c.instagram||c.custom_fields?.social_username||'—'}</td>{fields.filter(f=>f.enabled).slice(0,30).map(f=>{const value=c.custom_fields?.[f.key];return <td key={f.id}>{Array.isArray(value)?value.join('، '):value!=null&&value!==''?String(value):'—'}</td>;})}</tr>)}</tbody></table></div>
  </div>
  <div className={styles.footnote}>خلاصهٔ نیازها بر اساس واژه‌های موجود در پیام‌های دریافتی و بدون ارسال متن به سرویس هوش مصنوعی خارجی ساخته می‌شود؛ این دسته‌بندی ممکن است نیاز به اصلاح انسانی داشته باشد. هر بخش بر اساس حداکثر ۵۰۰ رکورد اخیرِ بارگذاری‌شدهٔ سیما محاسبه می‌شود.</div>
 </div>;
}

function CustomerFullHistory({db,tenantId,customerId,fallback,filter}){
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
   }catch{if(!cancelled)setError('دریافت پیام‌های قدیمی‌تر انجام نشد.');}
   finally{if(!cancelled)setLoading(false);}
  })();
  return()=>{cancelled=true;};
 },[db,tenantId,customerId,page]);
 const messageRows=rows.map(r=>({id:'i:'+r.id,type:'interaction',label:r.kind==='note'?'یادداشت':r.kind==='call'?'تماس':r.kind==='offer'?'پیشنهاد':'پیام',kind:r.kind,direction:r.direction,channel:r.channel,text:r.body,at:r.occurred_at||r.created_at}));
 const all=new Map(fallback.map(r=>[r.id,r]));for(const item of messageRows)all.set(item.id,item);
 const items=[...all.values()].filter(r=>filter==='all'||r.type===filter).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
 return <div>
  <History items={items}/>
  {error&&<p role="alert" className={styles.emptyText}>{error}</p>}
  {hasMore&&<button type="button" disabled={loading} className={styles.loadHistory} onClick={()=>setPage(x=>x+1)}>{loading?'در حال دریافت پیام‌ها…':'بارگذاری ۱۰۰ پیام قدیمی‌تر'}</button>}
  {!hasMore&&<small className={styles.historyEnd}>انتهای تاریخچهٔ ثبت‌شده در سیما</small>}
 </div>;
}
function History({items}){
 if(!items.length)return <div className={styles.emptyHistory}>هنوز فعالیتی در تاریخچهٔ این مشتری ثبت نشده است.</div>;
 return <div className={styles.history}>{items.map((item,i)=><article key={item.id||i} className={styles.event}><span className={styles.eventDot}>{item.type==='order'?<ShoppingBag size={14}/>:item.type==='task'?<CalendarClock size={14}/>:item.type==='lead'?<TrendingUp size={14}/>:<MessageSquare size={14}/>}</span><div><div className={styles.eventHeading}><strong>{item.label}</strong><small>{stamp(item.at)}</small></div><p>{item.text}</p>{item.channel&&<small>{item.channel} · {item.kind==='note'?'یادداشت داخلی':item.direction==='inbound'?'دریافتی':'ارسالی/ثبت‌شده'}</small>}</div></article>)}</div>;
}

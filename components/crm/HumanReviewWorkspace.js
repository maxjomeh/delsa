'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {AlertCircle,CheckCircle2,Clock3,FileText,MessagesSquare,RefreshCcw,Save,ShieldAlert,UserRound} from 'lucide-react';
import styles from './HumanReviewWorkspace.module.css';

const pretty=n=>Number(n||0).toLocaleString('fa-IR');
const stamp=value=>value?new Date(value).toLocaleString('fa-IR',{timeZone:'Asia/Tehran'}):'زمان نامشخص';
const reasons={MODEL_NOT_VALIDATED:'مدل پاسخ‌گویی هنوز روی داده‌های مستقل ارزیابی و تأیید نشده است',OWNER_REVIEW_REQUIRED:'این گفتگو طبق سیاست کسب‌وکار نیازمند بررسی صاحب کسب‌وکار است'};
const channels={instagram:'اینستاگرام',whatsapp:'واتساپ',telegram:'تلگرام',bale:'بله',eitaa:'ایتا',rubika:'روبیکا',soroush:'سروش'};
function Avatar({customer}){
 const url=customer?.custom_fields?.social_avatar_url;
 const valid=typeof url==='string'&&url.startsWith('https://')&&url.length<2048;
 return <span className={styles.avatar}>{valid?<img loading="lazy" src={url} alt="" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.display='none';}}/>:customer?.name?.slice(0,1)||'م'}</span>;
}
export default function HumanReviewWorkspace(){
 const [cases,setCases]=useState([]),[state,setState]=useState('all'),[query,setQuery]=useState(''),[offset,setOffset]=useState(0);
 const [hasMore,setHasMore]=useState(false),[selectedId,setSelectedId]=useState('');
 const [messages,setMessages]=useState([]),[selectedVersion,setSelectedVersion]=useState(null);
 const [draft,setDraft]=useState(''),[dirty,setDirty]=useState(false);
 const [loading,setLoading]=useState(true),[historyLoading,setHistoryLoading]=useState(false),[saving,setSaving]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{
  const params=new URLSearchParams({state,offset:String(offset)});
  try{
   const response=await fetch('/api/crm/reviews?'+params,{cache:'no-store'});
   const body=await response.json();
   if(!response.ok)throw Error(body.error||'دریافت صف ناموفق بود');
   setCases(body.cases||[]);setHasMore(!!body.hasMore);setError('');
  }catch(e){setError('دریافت صف بررسی انجام نشد. '+e.message);}
  finally{setLoading(false);}
 },[state,offset]);
 useEffect(()=>{setLoading(true);load();const timer=setInterval(load,20000);return()=>clearInterval(timer);},[load]);
 const visible=useMemo(()=>cases.filter(x=>[x.customer?.name,x.customer?.instagram,x.customer?.phone,x.lastMessage?.body].join(' ').toLocaleLowerCase('fa-IR').includes(query.toLocaleLowerCase('fa-IR'))),[cases,query]);
 const selected=visible.find(x=>x.id===selectedId)||visible[0]||null;
 const stale=!!selected&&selectedVersion!==null&&selected.conversation_version!==selectedVersion;
 useEffect(()=>{
  if(!selected)return;
  let active=true;
  setHistoryLoading(true);setMessages([]);
  fetch('/api/crm/reviews?'+new URLSearchParams({caseId:selected.id,customerId:selected.customer_id}),{cache:'no-store'})
   .then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error);return j;})
   .then(j=>{if(!active)return;setMessages(j.messages||[]);setSelectedVersion(j.review.conversation_version);
     setDraft(selected.draft_text||'');setDirty(false);})
   .catch(()=>{if(active)setError('بارگذاری مکالمهٔ انتخاب‌شده انجام نشد.');})
   .finally(()=>{if(active)setHistoryLoading(false);});
  return()=>{active=false;};
 },[selected?.id]);
 async function saveDraft(){
  if(!selected||saving||stale)return;
  setSaving(true);setError('');setNotice('');
  try{
   const response=await fetch('/api/crm/reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save_draft',id:selected.id,version:selectedVersion,text:draft})});
   const j=await response.json();
   if(!response.ok)throw Error(j.error==='stale_conversation_refresh_required'?'مشتری پیام جدیدی فرستاده است؛ متن پیشنویس را نگه دار و تاریخچه را بازبینی کن.':j.error||'ثبت انجام نشد.');
   setDirty(false);setNotice('پیش‌نویس ذخیره شد. هیچ پیامی به مشتری ارسال نشده است.');
   await load();
  }catch(e){setError(e.message||'ثبت پیش‌نویس انجام نشد.');}
  finally{setSaving(false);}
 }
 return <section className={styles.shell} aria-label="صف نظارت انسانی سیما">
  <header className={styles.head}>
   <div><span className={styles.eyebrow}><ShieldAlert size={15}/> CIMA HUMAN-IN-THE-LOOP</span><h3>نیازمند پاسخ شما</h3><p>پیام‌های واقعی با پاسخ نامطمئن، برای بررسی و پاسخ‌نویسی انسانی. سیما هنوز هیچ پیام خودکاری ارسال نمی‌کند.</p></div>
   <button type="button" className={styles.refresh} onClick={()=>{setLoading(true);load();}}><RefreshCcw size={16}/> تازه‌سازی</button>
  </header>
  <div className={styles.noticeBar}><AlertCircle size={17}/><span>این بخش در فاز Copilot و فقط برای نظارت و ذخیرهٔ پیش‌نویس فعال است. <strong>ارسال واقعی به اینستاگرام هنوز فعال نشده</strong> و پاسخ‌های قدیمی صرفاً برای بررسی صف‌بندی شده‌اند.</span></div>
  <div className={styles.toolbar}>
    <div className={styles.metric}><strong>{pretty(cases.length)}</strong><small>پرونده در صفحهٔ فعلی</small></div>
    <label>جست‌وجو در صفحه<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="نام، شماره، پیام…"/></label>
    <label>وضعیت<select value={state} onChange={e=>{setState(e.target.value);setOffset(0);setSelectedId('');}}>
     <option value="all">همه</option><option value="awaiting_human">در انتظار بررسی</option><option value="drafting">پیش‌نویس ذخیره‌شده</option><option value="resolved">رسیدگی‌شده</option>
    </select></label>
  </div>
  {error&&<p role="alert" className={styles.error}>{error}</p>}
  {notice&&<p role="status" className={styles.success}>{notice}</p>}
  <div className={styles.layout}>
    <aside className={styles.list} aria-label="فهرست درخواست‌های بررسی">
      {visible.map(row=><button type="button" key={row.id} onClick={()=>{setSelectedId(row.id);setNotice('');setError('');}} className={styles.entry+(selected?.id===row.id?' '+styles.current:'')} aria-current={selected?.id===row.id?'true':undefined}>
        <Avatar customer={row.customer}/>
        <span className={styles.entryText}><strong>{row.customer?.name||'مخاطب ناشناس'}</strong><small>{channels[row.channel]||row.channel} · {stamp(row.last_occurred_at)}</small><span>{row.lastMessage?.body||'متن پیام در دسترس نیست'}</span><em>{row.state==='drafting'?'پیش‌نویس ذخیره‌شده':'نیازمند بررسی'}</em></span>
      </button>)}
      {!loading&&!visible.length&&<p className={styles.empty}>موردی با این فیلتر ثبت نشده است.</p>}
      {loading&&<p className={styles.empty}>در حال دریافت…</p>}
      <div className={styles.paging}><button disabled={loading||offset===0} onClick={()=>setOffset(v=>Math.max(0,v-40))}>قبلی</button><span>{pretty(Math.floor(offset/40)+1)}</span><button disabled={loading||!hasMore} onClick={()=>setOffset(v=>v+40)}>بعدی</button></div>
    </aside>
    <section className={styles.center} aria-label="مکالمه و پیش‌نویس">
     {!selected?<p className={styles.empty}>یک مکالمه را از فهرست انتخاب کنید.</p>:<>
      <div className={styles.customerTitle}><MessagesSquare size={18}/><div><strong>{selected.customer?.name||'مخاطب'}</strong><small>{channels[selected.channel]||selected.channel} · نسخهٔ مکالمه {pretty(selected.conversation_version)}</small></div></div>
      <div className={styles.history} role="log" aria-label="تاریخچهٔ آخرین پیام‌ها">
       {historyLoading?<p className={styles.empty}>در حال بارگذاری تاریخچه…</p>:messages.map(m=><article key={m.id} className={styles.message+(m.direction==='outbound'?' '+styles.sent:'')}><small>{m.direction==='outbound'?'ارسالی ثبت‌شده':'پیام دریافتی'} · {stamp(m.occurred_at)}</small><p>{m.body}</p></article>)}
       {!historyLoading&&!messages.length&&<p className={styles.empty}>پیام ثبت‌شده‌ای برای نمایش پیدا نشد.</p>}
      </div>
      <div className={styles.composer}><label htmlFor="cima-human-draft">پیش‌نویس پاسخ انسانی</label>
       {stale&&<p className={styles.error}><AlertCircle size={15}/> مکالمه در حین نوشتن به‌روز شده است؛ پیش از ذخیره متن را بررسی و صفحه را تازه‌سازی کن.</p>}
       <textarea id="cima-human-draft" value={draft} onChange={e=>{setDraft(e.target.value);setDirty(true);}} maxLength={8000} rows={5} placeholder="پاسخ پیشنهادی خودت را بنویس؛ ذخیرهٔ آن به معنای ارسال نیست…"/>
       <div className={styles.actionRow}><small>{dirty?'تغییرات هنوز ذخیره نشده‌اند.':'پیش‌نویس فقط در سیما نگهداری می‌شود.'}</small><button type="button" onClick={saveDraft} disabled={saving||stale||selectedVersion===null}><Save size={16}/>{saving?'در حال ذخیره…':'ذخیره پیش‌نویس'}</button></div>
      </div>
     </>}
    </section>
    <aside className={styles.insights} aria-label="دلایل ارجاع و شواهد">
     <div className={styles.panelHeading}><ShieldAlert size={18}/><strong>دلیل ارجاع</strong></div>
     {selected?<><div className={styles.risk}><AlertCircle size={18}/><div><strong>نیازمند تأیید انسان</strong><p>{reasons[selected.reason_code]||'اطلاعات لازم برای ارسال مطمئن کامل نیست.'}</p></div></div>
      <div className={styles.fact}><UserRound size={17}/><div><span>شناسهٔ مشتری</span><strong>{selected.customer?.instagram?'@'+selected.customer.instagram:selected.customer?.name||'نامشخص'}</strong></div></div>
      <div className={styles.fact}><Clock3 size={17}/><div><span>آخرین پیام ثبت‌شده</span><strong>{stamp(selected.last_occurred_at)}</strong></div></div>
      <div className={styles.fact}><FileText size={17}/><div><span>ارزیابی هوش مصنوعی</span><strong>هنوز کالیبره نشده</strong></div></div>
      <p className={styles.explain}><CheckCircle2 size={16}/> متن و زمان پیام‌ها از رکوردهای CRM خوانده شده‌اند. هیچ امتیاز یا پاسخِ ساختگی به‌عنوان تحلیل AI نمایش داده نمی‌شود.</p>
     </>:<p className={styles.empty}>برای دیدن اطلاعات بررسی، یک پرونده را انتخاب کن.</p>}
    </aside>
  </div>
 </section>;
}

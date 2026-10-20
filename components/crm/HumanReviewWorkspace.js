'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {AlertCircle,CheckCircle2,Clock3,FileText,MessagesSquare,RefreshCcw,Save,Send,ShieldAlert,UserRound,BrainCircuit,BookOpen} from 'lucide-react';
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
 const [sending,setSending]=useState(false),[lastSend,setLastSend]=useState(null);
 const [candidate,setCandidate]=useState(null),[suggestBusy,setSuggestBusy]=useState(false),[modelEnabled,setModelEnabled]=useState(false);
 const [memory,setMemory]=useState(null);
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
 const withinWindow=!!selected&&Number.isFinite(Date.parse(selected.last_occurred_at||''))&&Date.now()-Date.parse(selected.last_occurred_at)>0&&Date.now()-Date.parse(selected.last_occurred_at)<23*60*60*1000;
 const alreadyAttempted=!!lastSend&&lastSend.conversation_version===selectedVersion;
 const canSend=!!selected&&selected.channel==='instagram'&&!selected.customer?.do_not_contact&&withinWindow&&!stale&&!alreadyAttempted&&!saving&&!sending&&selectedVersion!==null&&draft.trim().length>0&&draft.length<=4000;
 useEffect(()=>{
  if(!selected)return;
  let active=true;
  setSelectedVersion(null);setLastSend(null);setCandidate(null);setMemory(null);setHistoryLoading(true);setMessages([]);
  fetch('/api/crm/memory?'+new URLSearchParams({caseId:selected.id,customerId:selected.customer_id}),{cache:'no-store'})
   .then(r=>r.ok?r.json():null).then(j=>{if(active&&j)setMemory(j);}).catch(()=>{});
  fetch('/api/crm/copilot?caseId='+encodeURIComponent(selected.id),{cache:'no-store'})
   .then(r=>r.ok?r.json():null).then(j=>{if(active&&j){setCandidate(j.candidate||null);setModelEnabled(j.modelEnabled===true);}}).catch(()=>{});
  fetch('/api/crm/reviews/send?caseId='+encodeURIComponent(selected.id),{cache:'no-store'})
   .then(r=>r.ok?r.json():null).then(j=>{if(active&&j)setLastSend(j.sends?.[0]||null);}).catch(()=>{});
  fetch('/api/crm/reviews?'+new URLSearchParams({caseId:selected.id,customerId:selected.customer_id}),{cache:'no-store'})
   .then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error);return j;})
   .then(j=>{if(!active)return;setMessages(j.messages||[]);setSelectedVersion(j.review.conversation_version);
     setDraft(selected.draft_text||'');setDirty(false);})
   .catch(()=>{if(active)setError('بارگذاری مکالمهٔ انتخاب‌شده انجام نشد.');})
   .finally(()=>{if(active)setHistoryLoading(false);});
  return()=>{active=false;};
 },[selected?.id]);
 async function suggestReply(){
  if(!selected||suggestBusy||stale||selectedVersion===null)return;
  setSuggestBusy(true);setNotice('');setError('');
  try{
   const r=await fetch('/api/crm/copilot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'suggest',caseId:selected.id,version:selectedVersion})});
   const j=await r.json();if(!r.ok)throw Error(j.error==='conversation_changed_refresh'?'مکالمه تغییر کرده است؛ صفحه را تازه‌سازی کن.':j.error||'تحلیل انجام نشد.');
   setCandidate(j.candidate||null);
   setNotice(j.message||'تحلیل ثبت شد؛ ارسال پیام همچنان نیازمند اقدام شماست.');
  }catch(e){setError(e.message||'تحلیل انجام نشد.');}finally{setSuggestBusy(false);}
 }
 async function sendReply(){
  if(!canSend||!selected)return;
  if(!window.confirm('این پیام همین الان واقعاً از حساب اینستاگرام متصل برای مشتری ارسال می‌شود. تأیید می‌کنید؟'))return;
  setSending(true);setError('');setNotice('');
  try{
   const res=await fetch('/api/crm/reviews/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'send',id:selected.id,version:selectedVersion,text:draft})});
   const json=await res.json();
   if(json.outboxId)setLastSend({id:json.outboxId,conversation_version:selectedVersion,status:json.status||'unknown'});
   if(json.status==='accepted'){setDirty(false);setNotice('Zernio ارسال را پذیرفت. تحویل و خوانده‌شدن هنوز تأیید نشده است.');await load();}
   else if(json.status==='unknown'||res.status===202){setError('نتیجهٔ ارسال نامشخص است. دوباره ارسال نکنید؛ ابتدا وضعیت گفتگو را در اینستاگرام بررسی کنید.');}
   else if(json.status==='rejected'){setError('سرویس ارسال را رد کرد. برای جلوگیری از تکرار، ارسال این نوبت قفل شد.');}
   else{const explanations={reply_window_closed:'از آخرین پیام مشتری بیش از ۲۳ ساعت گذشته است.',contact_opted_out:'ارتباط با این مشتری ممنوع است.',conversation_stale:'مکالمه تغییر کرده؛ تاریخچه را تازه‌سازی کنید.',duplicate_send_blocked:'برای همین نوبت قبلاً تلاش ارسال ثبت شده است.',business_already_replied:'پاسخ جدیدتری قبلاً ثبت شده است.',conversation_unverified:'شناسهٔ اصلی گفتگو قابل تأیید نیست.',instagram_sender_not_connected:'اتصال اینستاگرام نیازمند بررسی است.'};setError(explanations[json.error]||'ارسال انجام نشد. وضعیت اتصال یا مکالمه را بررسی کنید.');}
  }catch{setError('وضعیت درخواست نامشخص است. قبل از تلاش جدید، تاریخچه و وضعیت ارسال را بررسی کنید.');}
  finally{setSending(false);}
 }
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
   <div><span className={styles.eyebrow}><ShieldAlert size={15}/> CIMA HUMAN-IN-THE-LOOP</span><h3>نیازمند پاسخ شما</h3><p>پیام‌های واقعی با پاسخ نامطمئن، برای بررسی و پاسخ‌نویسی انسانی. سیما هیچ پاسخ خودکاری ارسال نمی‌کند؛ ارسال انسانی فقط با تأیید شما انجام می‌شود.</p></div>
   <button type="button" className={styles.refresh} onClick={()=>{setLoading(true);load();}}><RefreshCcw size={16}/> تازه‌سازی</button>
  </header>
  <div className={styles.noticeBar}><AlertCircle size={17}/><span>این بخش در حالت نظارت انسانی است. <strong>ارسال واقعی اینستاگرام</strong> صرفاً پس از تأیید شما، از حساب معتبر و در بازهٔ ۲۳ساعتهٔ پاسخ فعال است. هیچ پاسخ خودکار AI ارسال نمی‌شود.</span></div>
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
       <textarea id="cima-human-draft" value={draft} onChange={e=>{setDraft(e.target.value);setDirty(true);}} maxLength={4000} rows={5} placeholder="پاسخ را بنویسید. ذخیرهٔ پیش‌نویس ارسال نمی‌کند؛ ارسال واقعی دکمهٔ جدا دارد…"/>
       {!withinWindow&&<small className={styles.sendWarning}>مهلت پاسخ عادی به این پیام تمام شده؛ برای ارسال جدید باید مشتری دوباره پیام بدهد.</small>}
       {selected.customer?.do_not_contact&&<small className={styles.sendWarning}>این مشتری اجازهٔ تماس ندارد؛ ارسال مسدود است.</small>}
       {lastSend&&<div className={styles.sendReceipt}>وضعیت آخرین تلاش: <strong>{({accepted:'پذیرفته‌شده توسط Zernio؛ تحویل نامشخص',unknown:'نتیجه نامشخص — ارسال مجدد ممنوع',rejected:'ردشده توسط ارائه‌دهنده',sending:'در حال ارسال',pending:'در صف'})[lastSend.status]||lastSend.status}</strong></div>}
       <div className={styles.actionRow}><small>{dirty?'تغییرات هنوز ذخیره نشده‌اند.':'ذخیرهٔ پیش‌نویس جدا از ارسال واقعی است.'}</small><div className={styles.sendActions}><button type="button" onClick={saveDraft} disabled={saving||sending||stale||selectedVersion===null}><Save size={16}/>{saving?'در حال ذخیره…':'ذخیره پیش‌نویس'}</button><button type="button" className={styles.sendButton} onClick={sendReply} disabled={!canSend}><Send size={16}/>{sending?'در حال ارسال…':'ارسال واقعی به اینستاگرام'}</button></div></div>
      </div>
     </>}
    </section>
    <aside className={styles.insights} aria-label="دلایل ارجاع و شواهد">
     <div className={styles.panelHeading}><ShieldAlert size={18}/><strong>دلیل ارجاع</strong></div>
     {selected?<><div className={styles.copilot}>
       <div className={styles.copilotTop}><BrainCircuit size={18}/><strong>پیشنهاد پاسخ مستند سیما</strong></div>
       <p>مدل زبانی: {modelEnabled?'آماده برای پیش‌نویسِ تحت نظارت':'فعلاً متصل نیست'} · امتیاز اطمینان: هنوز کالیبره نشده</p>
       <button type="button" onClick={suggestReply} disabled={suggestBusy||stale||selectedVersion===null}>{suggestBusy?'در حال بررسی…':'بررسی ریسک و تولید پیشنهاد'}</button>
       {candidate&&candidate.conversation_version===selectedVersion&&<div className={styles.candidate}>
        <small>ریسک: {candidate.risk_level==='high'?'بالا':candidate.risk_level==='medium'?'متوسط':'کم'} · {candidate.kind==='llm_grounded'?'پیشنهاد مدل — نیازمند راستی‌آزمایی':candidate.kind==='approved_faq'?'متن از منبع تأییدشده':candidate.kind==='blocked'?'ممنوعیت پاسخ قطعی':'کمبود دانش معتبر'}</small>
        {candidate.suggestion?<><p>{candidate.suggestion}</p><button type="button" onClick={()=>{setDraft(candidate.suggestion);setDirty(true);setNotice('پیشنهاد وارد پیش‌نویس شد؛ قبل از ارسال بررسی و ویرایش کن.');}}>استفاده در پیش‌نویس، بدون ارسال</button></>:<p>پاسخ مطمئن قابل پیشنهاد نیست؛ خودت پاسخ را بنویس و منابع را بررسی کن.</p>}
        {Array.isArray(candidate.cited_entries)&&candidate.cited_entries.length>0&&<div className={styles.citations}><BookOpen size={14}/>{candidate.cited_entries.map(e=><span key={e.id}>{e.title} · نسخهٔ {e.revision}</span>)}</div>}
        {Array.isArray(candidate.reason_codes)&&candidate.reason_codes.length>0&&<small>دلایل: {candidate.reason_codes.join(' · ')}</small>}
       </div>}
      </div>{memory&&<div className={styles.memory}><strong>حافظهٔ مستند مشتری</strong>
       <small>شمارهٔ پروفایل: {memory.customer?.phone||'ثبت‌نشده'} · اعتبارسنجی: {memory.customer?.phoneVerification==='unknown'?'تأیید نشده':'تأییدشده'}</small>
       {(memory.verifiedFacts||[]).slice(0,12).map((fact,i)=><div key={fact.key+'-'+i}><span>{fact.label}</span><b>{typeof fact.value==='string'?fact.value:JSON.stringify(fact.value)}</b>{fact.sourceQuote&&<small>شاهد: «{fact.sourceQuote}»</small>}</div>)}
       {!memory.verifiedFacts?.length&&<p>هنوز دادهٔ تأییدشدهٔ مستند برای این مشتری وجود ندارد.</p>}
       <small>{memory.note}</small>
      </div>}<div className={styles.risk}><AlertCircle size={18}/><div><strong>نیازمند تأیید انسان</strong><p>{reasons[selected.reason_code]||'اطلاعات لازم برای ارسال مطمئن کامل نیست.'}</p></div></div>
      <div className={styles.fact}><UserRound size={17}/><div><span>شناسهٔ مشتری</span><strong>{selected.customer?.instagram?'@'+selected.customer.instagram:selected.customer?.name||'نامشخص'}</strong></div></div>
      <div className={styles.fact}><Clock3 size={17}/><div><span>آخرین پیام ثبت‌شده</span><strong>{stamp(selected.last_occurred_at)}</strong></div></div>
      <div className={styles.fact}><FileText size={17}/><div><span>ارزیابی هوش مصنوعی</span><strong>هنوز کالیبره نشده</strong></div></div>
      <p className={styles.explain}><CheckCircle2 size={16}/> متن و زمان پیام‌ها از رکوردهای CRM خوانده شده‌اند. هیچ امتیاز یا پاسخِ ساختگی به‌عنوان تحلیل AI نمایش داده نمی‌شود.</p>
     </>:<p className={styles.empty}>برای دیدن اطلاعات بررسی، یک پرونده را انتخاب کن.</p>}
    </aside>
  </div>
 </section>;
}

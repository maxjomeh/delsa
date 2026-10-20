'use client';
import {useEffect,useMemo,useState} from 'react';
import {BookOpen,Plus,CheckCircle2,RotateCcw,Save,ShieldCheck} from 'lucide-react';
import styles from './KnowledgeWorkspace.module.css';
const categories={faq:'پرسش پرتکرار',policy:'قوانین کسب‌وکار',product:'اطلاعات محصول',procedure:'روش انجام کار'};
const blank={title:'',question:'',answer:'',category:'faq'};
export default function KnowledgeWorkspace(){
 const [items,setItems]=useState([]),[selected,setSelected]=useState(''),[form,setForm]=useState(blank);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[filter,setFilter]=useState('all');
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 async function load(){
  try{const r=await fetch('/api/crm/knowledge',{cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error);setItems(j.entries||[]);setError('');}
  catch{setError('فهرست دانش در دسترس نیست.');}finally{setLoading(false);}
 }
 useEffect(()=>{load();},[]);
 const selectedItem=useMemo(()=>items.find(x=>x.id===selected)||null,[selected,items]);
 const visible=useMemo(()=>items.filter(x=>filter==='all'||x.status===filter),[items,filter]);
 function choose(item){
  setSelected(item?.id||'');setForm(item?{title:item.title,question:item.question,answer:item.answer,category:item.category}:blank);
  setError('');setNotice('');
 }
 async function act(action){
  if(busy)return;
  setBusy(true);setError('');setNotice('');
  try{
   const response=await fetch('/api/crm/knowledge',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({...form,action,id:selected||undefined})});
   const j=await response.json();if(!response.ok)throw Error(j.error||'ثبت دانش ناموفق بود');
   await load();
   if(j.entry?.id){const res=await fetch('/api/crm/knowledge',{cache:'no-store'});const next=await res.json();if(res.ok){setItems(next.entries||[]);const chosen=next.entries?.find(x=>x.id===j.entry.id);choose(chosen||null);}}
   setNotice(action==='approve'?'منبع تأیید شد؛ در جست‌وجوی پاسخ‌های مستند قابل استفاده است.':action==='revoke'?'منبع لغو شد و برای پیشنهادهای جدید استفاده نمی‌شود.':'نسخهٔ جدید به‌صورت پیش‌نویس ذخیره شد. برای استفاده باید تأیید شود.');
  }catch(e){setError(e.message||'عملیات انجام نشد.');}finally{setBusy(false);}
 }
 return <section className={styles.root} aria-label="دانش کسب‌وکار سیما">
  <header className={styles.head}><div><span className={styles.eyebrow}><BookOpen size={16}/> CIMA KNOWLEDGE</span><h3>دانش کسب‌وکار</h3>
   <p>سؤال و پاسخ، قوانین و اطلاعات را ثبت کن. فقط محتوای تأییدشده به سیما اجازهٔ پیشنهاد پاسخ مستند می‌دهد.</p></div>
   <button onClick={()=>choose(null)} type="button"><Plus size={16}/> دانش جدید</button>
  </header>
  <div className={styles.notice}><ShieldCheck size={17}/> ذخیره‌کردن، تأییدکردن و ارسال‌کردن سه عمل مستقل‌اند. این صفحه هیچ پیامی برای مشتری ارسال نمی‌کند.</div>
  {error&&<p role="alert" className={styles.error}>{error}</p>}
  {notice&&<p role="status" className={styles.success}>{notice}</p>}
  <div className={styles.layout}>
   <aside className={styles.sidebar}><div className={styles.filters}><select aria-label="فیلتر وضعیت دانش" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">همه</option><option value="draft">پیش‌نویس</option><option value="approved">تأییدشده</option><option value="revoked">لغوشده</option></select><span>{items.length.toLocaleString('fa-IR')} منبع</span></div>
    {visible.map(item=><button key={item.id} type="button" className={styles.item+(selected===item.id?' '+styles.active:'')} onClick={()=>choose(item)}>
     <strong>{item.title}</strong><small>{categories[item.category]} · نسخهٔ {item.revision.toLocaleString('fa-IR')}</small>
     <em>{item.status==='approved'?'تأییدشده':item.status==='draft'?'در انتظار تأیید':'لغوشده'}</em></button>)}
    {!loading&&!visible.length&&<p className={styles.empty}>منبعی ثبت نشده است. یک سؤال و پاسخ معتبر اضافه کن.</p>}
    {loading&&<p className={styles.empty}>در حال بارگذاری…</p>}
   </aside>
   <div className={styles.editor}>
    <div className={styles.editorHead}><div><strong>{selectedItem?'ویرایش منبع دانش':'منبع جدید'}</strong><span>{selectedItem?'نسخه '+selectedItem.revision.toLocaleString('fa-IR'):'ابتدا به‌صورت پیش‌نویس ذخیره می‌شود'}</span></div>
     {selectedItem?.status==='approved'&&<span className={styles.approved}><CheckCircle2 size={15}/> تأییدشده</span>}
    </div>
    <label>عنوان کوتاه<input required minLength={3} maxLength={180} value={form.title} onChange={e=>setForm(v=>({...v,title:e.target.value}))} placeholder="مثلاً ساعات پشتیبانی"/></label>
    <label>سؤال یا موضوعی که مشتری مطرح می‌کند<textarea required rows={3} maxLength={2000} value={form.question} onChange={e=>setForm(v=>({...v,question:e.target.value}))} placeholder="پشتیبانی شما چه ساعتی پاسخ می‌دهد؟"/></label>
    <label>پاسخ دقیق و تأییدشدهٔ کسب‌وکار<textarea required rows={7} maxLength={6000} value={form.answer} onChange={e=>setForm(v=>({...v,answer:e.target.value}))} placeholder="تنها اطلاعاتی را وارد کن که برای مشتری قابل استناد است."/></label>
    <label>دسته‌بندی<select value={form.category} onChange={e=>setForm(v=>({...v,category:e.target.value}))}>{Object.entries(categories).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>
    <p className={styles.hint}>قیمت روز، موجودی لحظه‌ای، تطابق فنی قطعات یا وعدهٔ مالی هنوز به تأیید انسانی نیاز دارند؛ صرفاً ثبت آن‌ها در این قسمت اجازهٔ پاسخ قطعی نمی‌دهد.</p>
    <div className={styles.actions}><button disabled={busy||!form.title.trim()||!form.question.trim()||!form.answer.trim()} onClick={()=>act(selected?'update':'create')}><Save size={16}/>{busy?'در حال ثبت…':'ذخیره پیش‌نویس'}</button>
     {selectedItem&&<><button disabled={busy||selectedItem.status==='approved'} onClick={()=>act('approve')}><CheckCircle2 size={16}/> تأیید این نسخه</button>
     <button disabled={busy||selectedItem.status==='revoked'} onClick={()=>act('revoke')}><RotateCcw size={16}/> لغو اعتبار</button></>}
    </div>
   </div>
  </div>
 </section>;
}

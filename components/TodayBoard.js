'use client';
// "Today": the first screen for customers with the CRM. It answers one question —
// "what is waiting for me right now?" — and sends the user straight to the place where
// that work is done. It only READS CRM data, except for one explicit user action:
// marking a follow-up as done. It never sends a message; replying stays in
// «نیازمند پاسخ شما» where send eligibility, receipts and the outbox are enforced.
import {useCallback,useEffect,useRef,useState} from 'react';
import {CalendarCheck,Check,ChevronLeft,MessageCircle,Target,Wallet} from 'lucide-react';
import {summarizeToday,tehranDay} from '../lib/crm/today.mjs';
import styles from './TodayBoard.module.css';

const num=v=>Number(v||0).toLocaleString('fa-IR');
const clock=v=>new Date(v).toLocaleTimeString('fa-IR',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit'});
function ago(value){
  const ms=Date.parse(value||'');if(!Number.isFinite(ms))return '';
  const minutes=Math.max(0,Math.round((Date.now()-ms)/60000));
  if(minutes<1)return 'همین حالا';
  if(minutes<60)return `${num(minutes)} دقیقه پیش`;
  const hours=Math.round(minutes/60);
  if(hours<24)return `${num(hours)} ساعت پیش`;
  return `${num(Math.round(hours/24))} روز پیش`;
}
const label=c=>c?.name?.trim()||(c?.instagram?`@${c.instagram}`:c?.phone)||'مشتری';
const rows=p=>p.then(r=>({ok:!r.error,data:r.data||[]})).catch(()=>({ok:false,data:[]}));

async function fetchBoard(db,userId){
  const [customers,interactions,leads,orders,tasks]=await Promise.all([
    rows(db.from('crm_customers').select('id,name,phone,instagram,city,status,tags').eq('tenant_id',userId).order('created_at',{ascending:false}).range(0,2999)),
    rows(db.from('crm_interactions').select('*').eq('tenant_id',userId).order('created_at',{ascending:false}).range(0,499)),
    rows(db.from('crm_leads').select('id,customer_id,title,stage,amount,created_at').eq('tenant_id',userId).order('created_at',{ascending:false}).limit(200)),
    rows(db.from('crm_orders').select('id,customer_id,reference,amount,status,created_at').eq('tenant_id',userId).order('created_at',{ascending:false}).limit(200)),
    rows(db.from('crm_tasks').select('id,customer_id,title,due_at,status').eq('tenant_id',userId).eq('status','scheduled').order('due_at',{ascending:true}).limit(200)),
  ]);
  return {customers,interactions,leads,orders,tasks,failed:[customers,interactions,leads,orders,tasks].some(x=>!x.ok)};
}

export default function TodayBoard({db,userId,name,onOpen}){
  const [board,setBoard]=useState(null),[busyTask,setBusyTask]=useState(''),[notice,setNotice]=useState('');
  const [today,setToday]=useState('');
  const seq=useRef(0);
  const load=useCallback(async()=>{
    const run=++seq.current;
    const next=await fetchBoard(db,userId);
    if(run===seq.current)setBoard(next);
  },[db,userId]);
  useEffect(()=>{
    setToday(new Date().toLocaleDateString('fa-IR',{timeZone:'Asia/Tehran',weekday:'long',day:'numeric',month:'long'}));
    const refresh=()=>{if(document.visibilityState==='visible')load();};
    refresh();
    const timer=setInterval(refresh,60000);
    window.addEventListener('focus',refresh);
    return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);};
  },[load]);

  async function complete(task){
    setBusyTask(task.id);setNotice('');
    const result=await db.from('crm_tasks').update({status:'completed',result:'انجام شد (از صفحه‌ی امروز)'}).eq('id',task.id).eq('tenant_id',userId);
    if(result.error)setNotice('ثبت انجام‌شدن ممکن نشد. دوباره تلاش کنید.');
    else setBoard(b=>b&&{...b,tasks:{...b.tasks,data:b.tasks.data.filter(t=>t.id!==task.id)}});
    setBusyTask('');
  }

  if(!board)return <section className={styles.board} aria-busy="true"><p className={styles.loading} role="status">در حال آماده‌کردن کارهای امروز…</p></section>;

  const {today:todayKey,byId,waiting,due,overdue,openLeads,paidSum,pending}=summarizeToday({
    customers:board.customers.data,interactions:board.interactions.data,leads:board.leads.data,orders:board.orders.data,tasks:board.tasks.data});
  const first=name?.trim()?.split(' ')[0];

  return <section className={styles.board}>
    <header className={styles.head}><div><h1>{first?`سلام ${first}`:'سلام'}</h1><p>{today}</p></div></header>
    {board.failed&&<p className={styles.warn} role="status">بخشی از اطلاعات بارگذاری نشد؛ موارد دیگر درست نمایش داده می‌شوند.</p>}
    {notice&&<p className={styles.warn} role="alert">{notice}</p>}

    <div className={styles.counters}>
      <button type="button" className={waiting.length?styles.hot:''} onClick={()=>onOpen('reviews')}><MessageCircle size={22} aria-hidden="true"/><strong>{num(waiting.length)}</strong><span>پیام بی‌پاسخ</span></button>
      <button type="button" className={overdue.length?styles.hot:''} onClick={()=>onOpen('tasks')}><CalendarCheck size={22} aria-hidden="true"/><strong>{num(due.length)}</strong><span>پیگیری امروز{overdue.length?` · ${num(overdue.length)} عقب‌افتاده`:''}</span></button>
      <button type="button" onClick={()=>onOpen('leads')}><Target size={22} aria-hidden="true"/><strong>{num(openLeads.length)}</strong><span>فرصت فروش باز</span></button>
      <button type="button" onClick={()=>onOpen('orders')}><Wallet size={22} aria-hidden="true"/><strong>{num(paidSum)}</strong><span>فروش امروز · تومان</span></button>
    </div>

    <div className={styles.columns}>
      <section className={styles.card} aria-labelledby="today-waiting">
        <div className={styles.cardHead}><h2 id="today-waiting">منتظر پاسخ شماست</h2>{waiting.length>0&&<button type="button" onClick={()=>onOpen('reviews')}>همه <ChevronLeft size={16} aria-hidden="true"/></button>}</div>
        {waiting.length===0?<p className={styles.empty}>همه‌ی پیام‌ها پاسخ داده شده‌اند. 👌</p>:<ul className={styles.list}>{waiting.slice(0,6).map(c=><li key={c.id}>
          <button type="button" className={styles.row} onClick={()=>onOpen('reviews')}>
            <span className={styles.avatar} aria-hidden="true">{label(c.customer).trim()[0]}</span>
            <span className={styles.body}><strong>{label(c.customer)}</strong><small>{c.last.body||'پیام بدون متن'}</small></span>
            <span className={styles.meta}>{ago(c.last.occurred_at||c.last.created_at)}</span>
          </button></li>)}</ul>}
        {waiting.length>6&&<p className={styles.more}>و {num(waiting.length-6)} گفت‌وگوی دیگر</p>}
      </section>

      <div className={styles.side}>
        <section className={styles.card} aria-labelledby="today-tasks">
          <div className={styles.cardHead}><h2 id="today-tasks">پیگیری‌های امروز</h2>{due.length>0&&<button type="button" onClick={()=>onOpen('tasks')}>همه <ChevronLeft size={16} aria-hidden="true"/></button>}</div>
          {due.length===0?<p className={styles.empty}>پیگیری سررسیدشده‌ای نیست.</p>:<ul className={styles.list}>{due.slice(0,5).map(t=><li key={t.id} className={styles.task}>
            <span className={styles.body}><strong>{t.title}</strong><small>{label(byId.get(t.customer_id))} · {tehranDay(t.due_at)<todayKey?'عقب‌افتاده':clock(t.due_at)}</small></span>
            <button type="button" className={styles.done} disabled={busyTask===t.id} onClick={()=>complete(t)} aria-label={`انجام شد: ${t.title}`}><Check size={18} aria-hidden="true"/>انجام شد</button>
          </li>)}</ul>}
        </section>

        <section className={styles.card} aria-labelledby="today-sales">
          <div className={styles.cardHead}><h2 id="today-sales">سفارش‌های در انتظار پرداخت</h2>{pending.length>0&&<button type="button" onClick={()=>onOpen('orders')}>همه <ChevronLeft size={16} aria-hidden="true"/></button>}</div>
          {pending.length===0?<p className={styles.empty}>سفارش در انتظاری نیست.</p>:<ul className={styles.list}>{pending.slice(0,4).map(o=><li key={o.id}><button type="button" className={styles.row} onClick={()=>onOpen('orders')}>
            <span className={styles.body}><strong>{o.reference}</strong><small>{label(byId.get(o.customer_id))}</small></span>
            <span className={styles.meta}>{num(o.amount)} تومان</span></button></li>)}</ul>}
        </section>
      </div>
    </div>
  </section>;
}

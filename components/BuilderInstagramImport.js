'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Check,Instagram,Loader2,RefreshCw,Unplug} from 'lucide-react';
import BuilderDialog from './BuilderDialog';
import {kinds} from '../lib/builder-instagram';
import ui from './BuilderInstagramImport.module.css';

const num=n=>new Intl.NumberFormat('fa-IR').format(n);
const when=iso=>{try{return iso?new Intl.DateTimeFormat('fa-IR',{dateStyle:'medium'}).format(new Date(iso)):''}catch{return ''}};
const RESULT={
 connected:['ok','حساب اینستاگرام وصل شد.'],cancelled:['error','اتصال لغو شد.'],limit:['error','حداکثر ۵ حساب اینستاگرام قابل اتصال است.'],
 access_required:['error','برای اتصال، دسترسی سایت‌ساز لازم است.'],unconfigured:['error','اتصال رسمی اینستاگرام هنوز توسط دلسا تنظیم نشده است.'],
 invalid_state:['error','درخواست اتصال معتبر نبود؛ دوباره تلاش کنید.'],login_required:['error','ابتدا وارد حساب شوید.'],failed:['error','اتصال انجام نشد؛ دوباره تلاش کنید.']
};
export const instagramResult=code=>RESULT[code]||null;

async function call(url,options){
 const res=await fetch(url,{headers:{Accept:'application/json','Content-Type':'application/json'},...options});
 let body={};try{body=await res.json()}catch{}
 if(!res.ok)throw Object.assign(new Error(body.error||'unavailable'),{status:res.status,body});
 return body;
}
// Step 1 of "posts to products": connect an Instagram account and browse its posts, reels and stories.
// `onImport(items)` is wired in the next step; without it the selection is shown but nothing is created.
export default function BuilderInstagramImport({onClose,initialResult='',onImport}){
 const [status,setStatus]=useState(null),[account,setAccount]=useState(''),[tab,setTab]=useState('all');
 const [pages,setPages]=useState({posts:{items:[],next:null,loaded:false},stories:{items:[],next:null,loaded:false}});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(instagramResult(initialResult)),[picked,setPicked]=useState(()=>new Map());
 const gen=useRef(0);
 const load=useCallback(async()=>{
  try{const s=await call('/api/builder/instagram');setStatus(s);setAccount(a=>a&&s.accounts.some(x=>x.id===a)?a:(s.accounts.find(x=>x.status==='connected')||s.accounts[0])?.id||'')}
  catch(e){setStatus({configured:false,installed:false,accounts:[],failed:true})}
 },[]);
 useEffect(()=>{load()},[load]);
 const current=status?.accounts?.find(a=>a.id===account);
 const kind=tab==='stories'?'stories':'posts';
 const fetchPage=useCallback(async(which,after='')=>{
  const mine=++gen.current;setBusy(true);setError('');
  try{
   const q=new URLSearchParams({account,kind:which});if(after)q.set('after',after);
   const data=await call('/api/builder/instagram/media?'+q);
   if(mine!==gen.current)return;
   setPages(p=>({...p,[which]:{items:[...(after?p[which].items:[]),...data.items.filter(i=>!(after&&p[which].items.some(x=>x.id===i.id)))],next:data.next||null,loaded:true}}));
  }catch(e){if(mine!==gen.current)return;setError(e.body?.message||'دریافت محتوا از اینستاگرام انجام نشد.');
   // Mark the list as attempted so the effect below never retries on its own; the customer retries with the button.
   setPages(p=>({...p,[which]:{...p[which],loaded:true}}));if(e.status===401)load()}
  finally{if(mine===gen.current)setBusy(false)}
 },[account,load]);
 // A different account or tab starts from a clean list.
 useEffect(()=>{setPages({posts:{items:[],next:null,loaded:false},stories:{items:[],next:null,loaded:false}});setPicked(new Map())},[account]);
 useEffect(()=>{if(current?.status==='connected'&&!pages[kind].loaded&&!busy)fetchPage(kind)},[current?.status,kind,pages,busy,fetchPage]);
 const items=useMemo(()=>{const list=pages[kind].items;return tab==='reels'?list.filter(i=>i.kind==='reel'):list},[pages,kind,tab]);
 const toggle=item=>setPicked(m=>{const n=new Map(m);n.has(item.id)?n.delete(item.id):n.set(item.id,item);return n});
 async function connect(){
  setBusy(true);setError('');
  try{const r=await call('/api/builder/instagram',{method:'POST',body:JSON.stringify({action:'connect'})});window.location.assign(r.url)}
  catch(e){setError(e.body?.message||'شروع اتصال انجام نشد.');setBusy(false)}
 }
 async function disconnect(){
  if(!current||!window.confirm('اتصال این حساب قطع شود؟ محصولاتی که قبلاً ساخته‌اید حذف نمی‌شوند.'))return;
  setBusy(true);setError('');
  try{await call('/api/builder/instagram',{method:'POST',body:JSON.stringify({action:'disconnect',id:current.id})});setNotice(['ok','اتصال قطع شد.']);await load()}
  catch(e){setError('قطع اتصال انجام نشد.')}finally{setBusy(false)}
 }
 const connected=status?.accounts?.filter(a=>a.status==='connected')||[];
 return <BuilderDialog title="وارد کردن از اینستاگرام" onClose={onClose}><div className={ui.root} data-part="ig-import">
  {notice&&<p className={`${ui.notice} ${notice[0]==='error'?ui.error:''}`} role="status">{notice[1]}</p>}
  {!status&&<p className={ui.notice} role="status"><Loader2 size={16}/> در حال بررسی اتصال…</p>}
  {status&&!status.installed&&!status.failed&&<p className={ui.notice}>این قابلیت هنوز روی سرور فعال نشده است.</p>}
  {status?.failed&&<p className={`${ui.notice} ${ui.error}`}>وضعیت اتصال دریافت نشد؛ بعداً دوباره تلاش کنید.</p>}
  {status?.installed&&!status.configured&&<p className={ui.notice}>اتصال رسمی اینستاگرام هنوز توسط دلسا تنظیم نشده است.</p>}
  {status?.installed&&status.configured&&!status.accounts.length&&<div className={ui.connect}>
   <strong>حساب اینستاگرام خود را وصل کنید</strong>
   <ul><li>فقط حساب Business یا Creator پشتیبانی می‌شود.</li><li>دلسا فقط پست‌ها، ریلزها و استوری‌های شما را <b>می‌خواند</b>؛ چیزی منتشر یا حذف نمی‌کند.</li><li>می‌توانید هر زمان اتصال را قطع کنید.</li></ul>
   <button type="button" className={ui.primary} onClick={connect} disabled={busy}><Instagram size={16}/> اتصال به اینستاگرام</button>
  </div>}
  {status?.installed&&status.configured&&status.accounts.length>0&&<>
   <div className={ui.top}>
    <label>حساب <select value={account} onChange={e=>setAccount(e.target.value)} aria-label="حساب اینستاگرام">{status.accounts.map(a=><option key={a.id} value={a.id}>@{a.username||a.id}{a.status==='expired'?' (نیاز به اتصال دوباره)':''}</option>)}</select></label>
    <span className={ui.spacer}/>
    {current?.status==='expired'&&<button type="button" className={ui.primary} onClick={connect} disabled={busy}><RefreshCw size={16}/> اتصال دوباره</button>}
    {connected.length<5&&<button type="button" className={ui.ghost} onClick={connect} disabled={busy}><Instagram size={15}/> حساب دیگر</button>}
    <button type="button" className={ui.ghost} onClick={disconnect} disabled={busy||!current}><Unplug size={15}/> قطع اتصال</button>
   </div>
   {current?.status==='connected'&&<>
    <div className={ui.tabs} role="tablist" aria-label="نوع محتوا">{[['all','همهٔ پست‌ها'],['reels','ریلز'],['stories','استوری‌های فعال']].map(([id,label])=><button key={id} type="button" role="tab" aria-selected={tab===id} onClick={()=>setTab(id)}>{label}</button>)}</div>
    {tab==='stories'&&<p className={ui.notice}>استوری فقط ۲۴ ساعت می‌ماند؛ هنگام وارد کردن، یک نسخه در فضای دلسا ذخیره می‌شود.</p>}
    {error&&<p className={`${ui.notice} ${ui.error}`} role="alert">{error} <button type="button" className={ui.ghost} onClick={()=>fetchPage(kind,pages[kind].next||'')} disabled={busy}>تلاش دوباره</button></p>}
    <ul className={ui.grid} aria-busy={busy} aria-label="محتوای اینستاگرام">
     {items.map(item=><li key={item.id}><button type="button" className={ui.card} aria-pressed={picked.has(item.id)} onClick={()=>toggle(item)}>
      <span className={ui.media}>{item.thumbnail?<img src={item.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer"/>:null}<span className={ui.badge}>{kinds[item.kind]}</span><span className={ui.tick} aria-hidden="true">{picked.has(item.id)&&<Check size={14}/>}</span></span>
      <span className={ui.meta}><p>{item.caption||'بدون توضیح'}</p><time dateTime={item.timestamp}>{when(item.timestamp)}</time></span>
     </button></li>)}
     {busy&&!items.length&&Array.from({length:8},(_,i)=><li key={'s'+i}><div className={ui.skeleton}/></li>)}
    </ul>
    {!busy&&pages[kind].loaded&&!items.length&&!error&&<p className={ui.notice}>{tab==='stories'?'الان استوری فعالی ندارید.':tab==='reels'?'ریلزی در این حساب پیدا نشد.':'پستی پیدا نشد.'}</p>}
    <div className={ui.footer}>
     {pages[kind].next&&<button type="button" className={ui.ghost} onClick={()=>fetchPage(kind,pages[kind].next)} disabled={busy}>{busy?'در حال دریافت…':'بارگذاری بیشتر'}</button>}
     <span className={ui.spacer}/>
     <span aria-live="polite">{picked.size?num(picked.size)+' مورد انتخاب شد':'موردی انتخاب نشده'}</span>
     <button type="button" className={ui.primary} disabled={!onImport||!picked.size||busy} title={onImport?undefined:'ساخت محصول از موارد انتخابی در مرحلهٔ بعد فعال می‌شود'} onClick={()=>onImport?.([...picked.values()],current)}>ساخت محصول از موارد انتخابی</button>
    </div>
    {!onImport&&<p className={ui.notice}>در این مرحله فقط می‌توانید محتوا را ببینید و انتخاب کنید؛ ساخت محصول به‌زودی فعال می‌شود.</p>}
   </>}
  </>}
 </div></BuilderDialog>;
}

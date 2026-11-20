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
// "Posts to products": connect an Instagram account, browse posts/reels/stories and import the chosen ones as DRAFT products
// (files are copied into Delsa's storage on the server; the browser only sends the media ids, 3 per request).
export default function BuilderInstagramImport({onClose,initialResult='',site,onImported}){
 const [status,setStatus]=useState(null),[account,setAccount]=useState(''),[tab,setTab]=useState('all');
 const [pages,setPages]=useState({posts:{items:[],next:null,loaded:false},stories:{items:[],next:null,loaded:false}});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(instagramResult(initialResult)),[picked,setPicked]=useState(()=>new Map());
 const [phase,setPhase]=useState('pick'),[progress,setProgress]=useState({done:0,total:0,results:[]});
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
   const q=new URLSearchParams({account,kind:which});if(site)q.set('site',site);if(after)q.set('after',after);
   const data=await call('/api/builder/instagram/media?'+q);
   if(mine!==gen.current)return;
   setPages(p=>({...p,[which]:{items:[...(after?p[which].items:[]),...data.items.filter(i=>!(after&&p[which].items.some(x=>x.id===i.id)))],next:data.next||null,loaded:true}}));
  }catch(e){if(mine!==gen.current)return;setError(e.body?.message||'دریافت محتوا از اینستاگرام انجام نشد.');
   // Mark the list as attempted so the effect below never retries on its own; the customer retries with the button.
   setPages(p=>({...p,[which]:{...p[which],loaded:true}}));if(e.status===401)load()}
  finally{if(mine===gen.current)setBusy(false)}
 },[account,load,site]);
 // A different account or tab starts from a clean list.
 useEffect(()=>{setPages({posts:{items:[],next:null,loaded:false},stories:{items:[],next:null,loaded:false}});setPicked(new Map())},[account]);
 useEffect(()=>{if(current?.status==='connected'&&!pages[kind].loaded&&!busy)fetchPage(kind)},[current?.status,kind,pages,busy,fetchPage]);
 const items=useMemo(()=>{const list=pages[kind].items;return tab==='reels'?list.filter(i=>i.kind==='reel'):list},[pages,kind,tab]);
 const toggle=item=>item.imported||phase!=='pick'?null:setPicked(m=>{const n=new Map(m);n.has(item.id)?n.delete(item.id):n.set(item.id,item);return n});
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
 async function runImport(){
  const list=[...picked.values()];if(!list.length||!site||!current)return;
  setPhase('running');setError('');setProgress({done:0,total:list.length,results:[]});
  const all=[];
  for(let i=0;i<list.length;i+=3){
   const batch=list.slice(i,i+3);let results;
   try{const r=await call('/api/builder/instagram/import',{method:'POST',body:JSON.stringify({account:current.id,site,ids:batch.map(x=>x.id)})});results=r.results}
   catch(e){const message=e.body?.message||'ارتباط با سرور برقرار نشد.';results=batch.map(x=>({id:x.id,status:'failed',error:e.body?.error||'failed',message}));if(e.status===401)load();if(e.status===409||e.status===403||e.status===401){all.push(...results);setProgress({done:list.length,total:list.length,results:[...all,...list.slice(i+batch.length).map(x=>({id:x.id,status:'failed',error:'skipped',message:'متوقف شد.'}))]});break}}
   all.push(...results);setProgress({done:Math.min(list.length,i+batch.length),total:list.length,results:[...all]});
  }
  const created=new Map(all.filter(r=>r.status==='created'||r.status==='duplicate').map(r=>[r.id,r.productId]));
  setPages(p=>Object.fromEntries(Object.entries(p).map(([k,v])=>[k,{...v,items:v.items.map(i=>created.has(i.id)?{...i,imported:true,productId:created.get(i.id)}:i)}])));
  setPicked(new Map());setPhase('done');onImported?.();
 }
 const connected=status?.accounts?.filter(a=>a.status==='connected')||[];
 return <BuilderDialog title="وارد کردن از اینستاگرام" onClose={onClose}><div className={ui.root} data-part="ig-import">
  {notice&&<p className={`${ui.notice} ${notice[0]==='error'?ui.error:''}`} role="status">{notice[1]}</p>}
  {phase!=='pick'&&<div className={ui.progress} role="status" aria-live="polite"><progress value={progress.done} max={progress.total||1} aria-label="پیشرفت"/><strong>{phase==='running'?'در حال ساخت… ':'پایان. '}{num(progress.done)} از {num(progress.total)}</strong><ul>{progress.results.map(r=><li key={r.id} data-status={r.status}>{r.status==='created'?'✓ ساخته شد':r.status==='duplicate'?'• قبلاً وارد شده':'✗ '+(r.message||'ناموفق')}{r.skipped?.length>0&&<small> · بخشی از فایل‌ها ذخیره نشد</small>}</li>)}</ul>{phase==='done'&&<div className={ui.top}><button type="button" className={ui.primary} onClick={onClose}>مشاهدهٔ پیش‌نویس‌ها</button><button type="button" className={ui.ghost} onClick={()=>setPhase('pick')}>انتخاب موارد دیگر</button></div>}</div>}
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
     {items.map(item=><li key={item.id}><button type="button" className={ui.card} aria-pressed={picked.has(item.id)} aria-disabled={item.imported||undefined} data-imported={item.imported?'':undefined} onClick={()=>toggle(item)}>
      <span className={ui.media}>{item.thumbnail?<img src={item.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer"/>:null}<span className={ui.badge}>{kinds[item.kind]}</span>{item.imported&&<span className={ui.done}>وارد شده</span>}<span className={ui.tick} aria-hidden="true">{picked.has(item.id)&&<Check size={14}/>}</span></span>
      <span className={ui.meta}><p>{item.caption||'بدون توضیح'}</p><time dateTime={item.timestamp}>{when(item.timestamp)}</time></span>
     </button></li>)}
     {busy&&!items.length&&Array.from({length:8},(_,i)=><li key={'s'+i}><div className={ui.skeleton}/></li>)}
    </ul>
    {!busy&&pages[kind].loaded&&!items.length&&!error&&<p className={ui.notice}>{tab==='stories'?'الان استوری فعالی ندارید.':tab==='reels'?'ریلزی در این حساب پیدا نشد.':'پستی پیدا نشد.'}</p>}
    <div className={ui.footer}>
     {pages[kind].next&&<button type="button" className={ui.ghost} onClick={()=>fetchPage(kind,pages[kind].next)} disabled={busy}>{busy?'در حال دریافت…':'بارگذاری بیشتر'}</button>}
     <span className={ui.spacer}/>
     <span aria-live="polite">{picked.size?num(picked.size)+' مورد انتخاب شد':'موردی انتخاب نشده'}</span>
     <button type="button" className={ui.primary} disabled={!site||!picked.size||busy||phase!=='pick'} onClick={runImport}>ساخت پیش‌نویس محصول از موارد انتخابی</button>
    </div>
    {phase==='pick'&&picked.size>0&&<p className={ui.notice}>محصول‌ها به‌صورت <b>پیش‌نویس</b> ساخته می‌شوند؛ تصویر و ویدیو در فضای دلسا ذخیره می‌شود. قیمت و موجودی را بعد از ساخت در فرم محصول وارد کنید.</p>}
   </>}
  </>}
 </div></BuilderDialog>;
}

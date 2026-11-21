'use client';
import {useI18n} from './i18n/I18nProvider';
import {tx} from '../lib/i18n/config';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Check,Instagram,Loader2,RefreshCw,Unplug} from 'lucide-react';
import BuilderDialog from './BuilderDialog';
import {kinds} from '../lib/builder-instagram';
import {optionsToText,optionsFromText,toLatinDigits} from '../lib/builder-ai';
import ui from './BuilderInstagramImport.module.css';

const RESULT={
 connected:['ok',tx('حساب اینستاگرام وصل شد.')],cancelled:['error',tx('اتصال لغو شد.')],limit:['error',tx('حداکثر ۵ حساب اینستاگرام قابل اتصال است.')],
 access_required:['error',tx('برای اتصال، دسترسی سایت‌ساز لازم است.')],unconfigured:['error',tx('اتصال رسمی اینستاگرام هنوز توسط دلسا تنظیم نشده است.')],
 invalid_state:['error',tx('درخواست اتصال معتبر نبود؛ دوباره تلاش کنید.')],login_required:['error',tx('ابتدا وارد حساب شوید.')],failed:['error',tx('اتصال انجام نشد؛ دوباره تلاش کنید.')]
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
export default function BuilderInstagramImport({onClose,initialResult='',site,onImported,onFresh}){
 const {t,intl}=useI18n();
 const num=n=>new Intl.NumberFormat(intl).format(n),when=iso=>{try{return iso?new Intl.DateTimeFormat(intl,{dateStyle:'medium'}).format(new Date(iso)):''}catch{return ''}};
 const [status,setStatus]=useState(null),[account,setAccount]=useState(''),[tab,setTab]=useState('all');
 const [pages,setPages]=useState({posts:{items:[],next:null,loaded:false},stories:{items:[],next:null,loaded:false},new:{items:[],next:null,loaded:false}});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(()=>{const r=instagramResult(initialResult);return r?[r[0],t(r[1])]:null}),[picked,setPicked]=useState(()=>new Map());
 const [phase,setPhase]=useState('pick'),[progress,setProgress]=useState({done:0,total:0,results:[]});
 const [review,setReview]=useState({rows:[],meta:null});
 const gen=useRef(0),synced=useRef(new Set()),landed=useRef(false);
 const load=useCallback(async()=>{
  try{const s=await call('/api/builder/instagram');setStatus(s);setAccount(a=>a&&s.accounts.some(x=>x.id===a)?a:(s.accounts.find(x=>x.status==='connected')||s.accounts[0])?.id||'');
   if(s.sync){const total=s.accounts.filter(x=>x.status==='connected').reduce((n,x)=>n+(x.fresh||0),0);onFresh?.(total);if(total>0&&!landed.current){landed.current=true;setTab('new')}}}
  catch(e){setStatus({configured:false,installed:false,accounts:[],failed:true})}
 },[onFresh]);
 useEffect(()=>{load()},[load]);
 const current=status?.accounts?.find(a=>a.id===account);
 // Opening the dialog asks the server to look for new posts (it answers "skipped" when the last check was under 10 minutes ago).
 useEffect(()=>{
  if(!status?.sync||current?.status!=='connected'||synced.current.has(current.id))return;
  synced.current.add(current.id);
  call('/api/builder/instagram/sync',{method:'POST',body:JSON.stringify({account:current.id})}).then(r=>{if(r.suggested>0||r.changed>0||r.deleted>0)load()}).catch(()=>{});
 },[status?.sync,current?.id,current?.status,load]);
 const fresh=current?.fresh||0;
 const kind=tab==='stories'?'stories':tab==='new'?'new':'posts';
 const fetchPage=useCallback(async(which,after='')=>{
  const mine=++gen.current;setBusy(true);setError('');
  try{
   const q=new URLSearchParams({account,kind:which});if(site)q.set('site',site);if(after)q.set('after',after);
   const data=await call('/api/builder/instagram/media?'+q);
   if(mine!==gen.current)return;
   setPages(p=>({...p,[which]:{items:[...(after?p[which].items:[]),...data.items.filter(i=>!(after&&p[which].items.some(x=>x.id===i.id)))],next:data.next||null,loaded:true}}));
  }catch(e){if(mine!==gen.current)return;setError(e.body?.message?t(e.body.message):t('دریافت محتوا از اینستاگرام انجام نشد.'));
   // Mark the list as attempted so the effect below never retries on its own; the customer retries with the button.
   setPages(p=>({...p,[which]:{...p[which],loaded:true}}));if(e.status===401)load()}
  finally{if(mine===gen.current)setBusy(false)}
 },[account,load,site]);
 // A different account or tab starts from a clean list.
 useEffect(()=>{setPages({posts:{items:[],next:null,loaded:false},stories:{items:[],next:null,loaded:false},new:{items:[],next:null,loaded:false}});setPicked(new Map())},[account]);
 useEffect(()=>{if(current?.status==='connected'&&!pages[kind].loaded&&!busy)fetchPage(kind)},[current?.status,kind,pages,busy,fetchPage]);
 const items=useMemo(()=>{const list=pages[kind].items;return tab==='reels'?list.filter(i=>i.kind==='reel'):list},[pages,kind,tab]);
 async function dismissPicked(){
  const ids=[...picked.keys()];if(!ids.length||!current)return;
  setBusy(true);setError('');
  try{await call('/api/builder/instagram/sync',{method:'POST',body:JSON.stringify({action:'dismiss',account:current.id,ids})});setPages(p=>({...p,new:{...p.new,items:p.new.items.filter(i=>!ids.includes(i.id))}}));setPicked(new Map());setNotice(['ok',t('پیشنهادها کنار گذاشته شد.')]);await load()}
  catch{setError(t('کنار گذاشتن پیشنهادها انجام نشد.'))}finally{setBusy(false)}
 }
 const toggle=item=>item.imported||phase!=='pick'?null:setPicked(m=>{const n=new Map(m);n.has(item.id)?n.delete(item.id):n.set(item.id,item);return n});
 async function connect(){
  setBusy(true);setError('');
  try{const r=await call('/api/builder/instagram',{method:'POST',body:JSON.stringify({action:'connect'})});window.location.assign(r.url)}
  catch(e){setError(e.body?.message?t(e.body.message):t('شروع اتصال انجام نشد.'));setBusy(false)}
 }
 async function disconnect(){
  if(!current||!window.confirm(t('اتصال این حساب قطع شود؟ محصولاتی که قبلاً ساخته‌اید حذف نمی‌شوند.')))return;
  setBusy(true);setError('');
  try{await call('/api/builder/instagram',{method:'POST',body:JSON.stringify({action:'disconnect',id:current.id})});setNotice(['ok',t('اتصال قطع شد.')]);await load()}
  catch(e){setError(t('قطع اتصال انجام نشد.'))}finally{setBusy(false)}
 }

 async function runAnalyze(){
  const list=[...picked.values()];if(!list.length||!site||!current)return;
  setPhase('analyzing');setError('');setProgress({done:0,total:list.length,results:[]});
  const rows=[];let meta=null;
  for(let i=0;i<list.length;i+=5){
   const batch=list.slice(i,i+5);
   try{
    const r=await call('/api/builder/instagram/analyze',{method:'POST',body:JSON.stringify({account:current.id,site,ids:batch.map(x=>x.id)})});
    meta=meta?{...meta,ai:r.ai}:{ai:r.ai,fields:r.fields||[],categories:r.categories||[]};
    for(const x of r.results){const item=batch.find(b=>b.id===x.id);
     if(x.error){rows.push({id:x.id,item,error:x.message||t('تحلیل انجام نشد.'),include:false});continue}
     const sg=x.suggestion;
     rows.push({id:x.id,item,source:x.source,caption:x.caption,include:true,title:sg.title||x.fallbackTitle||'',summary:sg.summary||'',price:sg.price?String(sg.price):'',salePrice:sg.salePrice?String(sg.salePrice):'',availability:sg.availability||'unknown',optionsText:optionsToText(sg.options),category:sg.category||'',tagsText:(sg.tags||[]).join(t('، ')),attributes:{...sg.attributes}});
    }
   }catch(e){setError(e.body?.message?t(e.body.message):t('تحلیل انجام نشد؛ می‌توانید بدون تحلیل بسازید.'));if(e.status===401)load();setPhase('pick');return}
   setProgress({done:Math.min(list.length,i+batch.length),total:list.length,results:[]});
  }
  setReview({rows,meta});setPhase('review');
 }
 const patchRow=(id,patch)=>setReview(r=>({...r,rows:r.rows.map(x=>x.id===id?{...x,...patch}:x)}));
 function confirmReview(){
  const rows=review.rows.filter(r=>r.include&&!r.error);
  const overrides=Object.fromEntries(review.rows.map(r=>[r.id,r.error||!r.include?{include:false}:{include:true,title:r.title,summary:r.summary,price:r.price,sale_price:r.salePrice,availability:r.availability,options:optionsFromText(r.optionsText),category:r.category,tags:r.tagsText.split(/[،,]/).map(t=>t.trim()).filter(Boolean),attributes:r.attributes}]));
  runImport(rows.map(r=>r.item),overrides);
 }
 async function runImport(list=[...picked.values()],overrides=null){
  if(!list.length||!site||!current)return;
  setPhase('running');setError('');setProgress({done:0,total:list.length,results:[]});
  const all=[];
  for(let i=0;i<list.length;i+=3){
   const batch=list.slice(i,i+3);let results;
   try{const r=await call('/api/builder/instagram/import',{method:'POST',body:JSON.stringify({account:current.id,site,ids:batch.map(x=>x.id),...(overrides?{overrides:Object.fromEntries(batch.map(x=>[x.id,overrides[x.id]]))}:{})})});results=r.results}
   catch(e){const message=e.body?.message||t('ارتباط با سرور برقرار نشد.');results=batch.map(x=>({id:x.id,status:'failed',error:e.body?.error||'failed',message}));if(e.status===401)load();if(e.status===409||e.status===403||e.status===401){all.push(...results);setProgress({done:list.length,total:list.length,results:[...all,...list.slice(i+batch.length).map(x=>({id:x.id,status:'failed',error:'skipped',message:t('متوقف شد.')}))]});break}}
   all.push(...results);setProgress({done:Math.min(list.length,i+batch.length),total:list.length,results:[...all]});
  }
  const created=new Map(all.filter(r=>r.status==='created'||r.status==='duplicate').map(r=>[r.id,r.productId]));
  setPages(p=>Object.fromEntries(Object.entries(p).map(([k,v])=>[k,{...v,items:v.items.map(i=>created.has(i.id)?{...i,imported:true,productId:created.get(i.id)}:i)}])));
  setPicked(new Map());setPhase('done');onImported?.();load();
 }
 const connected=status?.accounts?.filter(a=>a.status==='connected')||[];
 return <BuilderDialog title={t('وارد کردن از اینستاگرام')} onClose={onClose}><div className={ui.root} data-part="ig-import">
  {notice&&<p className={`${ui.notice} ${notice[0]==='error'?ui.error:''}`} role="status">{notice[1]}</p>}
  {(phase==='running'||phase==='done')&&<div className={ui.progress} role="status" aria-live="polite"><progress value={progress.done} max={progress.total||1} aria-label={t('پیشرفت')}/><strong>{phase==='running'?t('در حال ساخت…')+' ':t('پایان.')+' '}{num(progress.done)} {t('از')} {num(progress.total)}</strong><ul>{progress.results.map(r=><li key={r.id} data-status={r.status}>{r.status==='created'?(r.productStatus==='published'?t('✓ ساخته و منتشر شد'):t('✓ ساخته شد (پیش‌نویس)'))+(r.downgraded?t(' · سقف طرح رایگان پر بود'):''):r.status==='duplicate'?t('• قبلاً وارد شده'):r.status==='skipped'?t('• ردشد'):'✗ '+(r.message?t(r.message):t('ناموفق'))}{r.skipped?.length>0&&<small> {t('· بخشی از فایل‌ها ذخیره نشد')}</small>}</li>)}</ul>{phase==='done'&&<div className={ui.top}><button type="button" className={ui.primary} onClick={onClose}>{t('مشاهدهٔ پیش‌نویس‌ها')}</button><button type="button" className={ui.ghost} onClick={()=>setPhase('pick')}>{t('انتخاب موارد دیگر')}</button></div>}</div>}
  {phase==='analyzing'&&<p className={ui.notice} role="status" aria-live="polite"><Loader2 size={16}/> {t('در حال تحلیل کپشن‌ها…')} {num(progress.done)} {t('از')} {num(progress.total)}</p>}
  {phase==='review'&&<div className={ui.review} data-part="ig-review">
   <p className={ui.notice} role="status">{review.meta?.ai?.state==='ok'?t('پیشنهادها با هوش مصنوعی ساخته شد؛ {n} تحلیل از سهمیهٔ ماهانهٔ شما باقی مانده است.',{n:num(review.meta.ai.remaining)}):review.meta?.ai?.state==='exhausted'?t('سهمیهٔ ماهانهٔ هوش مصنوعی تمام شده؛ پیشنهادها با قواعد ساده از کپشن ساخته شد.'):t('پیشنهادها با قواعد ساده از کپشن ساخته شد.')} {t('همه‌چیز را بررسی و در صورت نیاز ویرایش کنید؛ محصولی که قیمت دارد منتشر می‌شود و بقیه پیش‌نویس می‌مانند.')}</p>
   <datalist id="ig-categories">{(review.meta?.categories||[]).map(c=><option key={c} value={c}/>)}</datalist>
   {review.rows.map(r=><section key={r.id} className={ui.row} data-include={r.include?'':undefined}>
    <label className={ui.rowHead}><input type="checkbox" checked={r.include} disabled={!!r.error} onChange={e=>patchRow(r.id,{include:e.target.checked})}/><span className={ui.thumb}>{r.item?.thumbnail&&<img src={r.item.thumbnail} alt="" referrerPolicy="no-referrer"/>}</span><strong>{r.error?r.error:(r.title||t('بدون عنوان'))}</strong>{!r.error&&<em className={ui.src}>{r.source==='ai'?t('هوش مصنوعی'):t('قواعد ساده')}</em>}</label>
    {!r.error&&r.include&&<div className={ui.fields}>
     <label>{t('عنوان')}<input value={r.title} maxLength={180} onChange={e=>patchRow(r.id,{title:e.target.value})}/></label>
     <label>{t('قیمت (تومان)')}<input inputMode="numeric" value={r.price} placeholder={t('خالی = پیش‌نویس')} onChange={e=>patchRow(r.id,{price:e.target.value})}/></label>
     <label>{t('قیمت با تخفیف')}<input inputMode="numeric" value={r.salePrice} onChange={e=>patchRow(r.id,{salePrice:e.target.value})}/></label>
     <label>{t('موجودی')}<select value={r.availability} onChange={e=>patchRow(r.id,{availability:e.target.value})}><option value="unknown">{t('بدون پیگیری موجودی')}</option><option value="in_stock">{t('موجود')}</option><option value="out_of_stock">{t('ناموجود')}</option></select></label>
     <label>{t('دسته')}<input list="ig-categories" value={r.category} maxLength={60} onChange={e=>patchRow(r.id,{category:e.target.value})}/></label>
     <label>{t('برچسب‌ها (با ، جدا کنید)')}<input value={r.tagsText} onChange={e=>patchRow(r.id,{tagsText:e.target.value})}/></label>
     <label className={ui.wide}>{t('تنوع (مثلاً رنگ: قرمز، آبی | سایز: ۳۸، ۴۰)')}<input value={r.optionsText} onChange={e=>patchRow(r.id,{optionsText:e.target.value})}/></label>
     {(review.meta?.fields||[]).map(f=><label key={f.key}>{f.label}<input value={r.attributes[f.key]||''} onChange={e=>patchRow(r.id,{attributes:{...r.attributes,[f.key]:e.target.value}})}/></label>)}
     <p className={ui.state}>{Number(toLatinDigits(r.price).replace(/[^0-9]/g,''))>0?t('✓ بعد از ساخت منتشر می‌شود'):t('• پیش‌نویس می‌ماند (قیمت ندارد)')}</p>
     {r.caption&&<details className={ui.wide}><summary>{t('کپشن اصلی')}</summary><p>{r.caption}</p></details>}
    </div>}
   </section>)}
   <div className={ui.top}><button type="button" className={ui.primary} onClick={confirmReview} disabled={!review.rows.some(r=>r.include&&!r.error)}>{t('ساخت')} {num(review.rows.filter(r=>r.include&&!r.error).length)} {t('محصول')}</button><button type="button" className={ui.ghost} onClick={()=>setPhase('pick')}>{t('بازگشت به انتخاب')}</button></div>
  </div>}
  {!status&&<p className={ui.notice} role="status"><Loader2 size={16}/> {t('در حال بررسی اتصال…')}</p>}
  {status&&!status.installed&&!status.failed&&<p className={ui.notice}>{t('این قابلیت هنوز روی سرور فعال نشده است.')}</p>}
  {status?.failed&&<p className={`${ui.notice} ${ui.error}`}>{t('وضعیت اتصال دریافت نشد؛ بعداً دوباره تلاش کنید.')}</p>}
  {status?.installed&&!status.configured&&<p className={ui.notice}>{t('اتصال رسمی اینستاگرام هنوز توسط دلسا تنظیم نشده است.')}</p>}
  {status?.installed&&status.configured&&!status.accounts.length&&<div className={ui.connect}>
   <strong>{t('حساب اینستاگرام خود را وصل کنید')}</strong>
   <ul><li>{t('فقط حساب Business یا Creator پشتیبانی می‌شود.')}</li><li>{t('دلسا فقط پست‌ها، ریلزها و استوری‌های شما را می‌خواند؛ چیزی منتشر یا حذف نمی‌کند.')}</li><li>{t('می‌توانید هر زمان اتصال را قطع کنید.')}</li></ul>
   <button type="button" className={ui.primary} onClick={connect} disabled={busy}><Instagram size={16}/> {t('اتصال به اینستاگرام')}</button>
  </div>}
  {status?.installed&&status.configured&&status.accounts.length>0&&<>
   <div className={ui.top}>
    <label>{t('حساب')} <select value={account} onChange={e=>setAccount(e.target.value)} aria-label={t('حساب اینستاگرام')}>{status.accounts.map(a=><option key={a.id} value={a.id}>@{a.username||a.id}{a.status==='expired'?t(' (نیاز به اتصال دوباره)'):''}</option>)}</select></label>
    <span className={ui.spacer}/>
    {current?.status==='expired'&&<button type="button" className={ui.primary} onClick={connect} disabled={busy}><RefreshCw size={16}/> {t('اتصال دوباره')}</button>}
    {connected.length<5&&<button type="button" className={ui.ghost} onClick={connect} disabled={busy}><Instagram size={15}/> {t('حساب دیگر')}</button>}
    <button type="button" className={ui.ghost} onClick={disconnect} disabled={busy||!current}><Unplug size={15}/> {t('قطع اتصال')}</button>
   </div>
   {current?.status==='connected'&&(phase==='pick'||phase==='done'||phase==='running')&&<>
    <div className={ui.tabs} role="tablist" aria-label={t('نوع محتوا')}>{[...(status.sync&&(fresh>0||tab==='new')?[['new',t('پست‌های تازه')+(fresh>0?' ('+num(fresh)+')':'')]]:[]),['all',t('همهٔ پست‌ها')],['reels',t('ریلز')],['stories',t('استوری‌های فعال')]].map(([id,label])=><button key={id} type="button" role="tab" aria-selected={tab===id} data-tab={id} onClick={()=>setTab(id)}>{label}</button>)}</div>
    {tab==='new'&&<p className={ui.notice}>{t('پست‌هایی که بعد از اتصال حساب منتشر شده‌اند. چیزی خودکار ساخته یا منتشر نمی‌شود؛ هر پستی را که می‌خواهید انتخاب و وارد کنید، بقیه را کنار بگذارید.')}</p>}
    {tab==='stories'&&<p className={ui.notice}>{t('استوری فقط ۲۴ ساعت می‌ماند؛ هنگام وارد کردن، یک نسخه در فضای دلسا ذخیره می‌شود.')}</p>}
    {error&&<p className={`${ui.notice} ${ui.error}`} role="alert">{error} <button type="button" className={ui.ghost} onClick={()=>fetchPage(kind,pages[kind].next||'')} disabled={busy}>{t('تلاش دوباره')}</button></p>}
    <ul className={ui.grid} aria-busy={busy} aria-label={t('محتوای اینستاگرام')}>
     {items.map(item=><li key={item.id}><button type="button" className={ui.card} aria-pressed={picked.has(item.id)} aria-disabled={item.imported||undefined} data-imported={item.imported?'':undefined} onClick={()=>toggle(item)}>
      <span className={ui.media}>{item.thumbnail?<img src={item.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer"/>:null}<span className={ui.badge}>{t(kinds[item.kind])}</span>{item.imported&&<span className={ui.done}>{t('وارد شده')}</span>}<span className={ui.tick} aria-hidden="true">{picked.has(item.id)&&<Check size={14}/>}</span></span>
      <span className={ui.meta}><p>{item.caption||t('بدون توضیح')}</p><time dateTime={item.timestamp}>{when(item.timestamp)}</time></span>
     </button></li>)}
     {busy&&!items.length&&Array.from({length:8},(_,i)=><li key={'s'+i}><div className={ui.skeleton}/></li>)}
    </ul>
    {!busy&&pages[kind].loaded&&!items.length&&!error&&<p className={ui.notice}>{tab==='new'?t('پست تازه‌ای پیدا نشد.'):tab==='stories'?t('الان استوری فعالی ندارید.'):tab==='reels'?t('ریلزی در این حساب پیدا نشد.'):t('پستی پیدا نشد.')}</p>}
    <div className={ui.footer}>
     {pages[kind].next&&<button type="button" className={ui.ghost} onClick={()=>fetchPage(kind,pages[kind].next)} disabled={busy}>{busy?t('در حال دریافت…'):t('بارگذاری بیشتر')}</button>}
     <span className={ui.spacer}/>
     <span aria-live="polite">{picked.size?t('{n} مورد انتخاب شد',{n:num(picked.size)}):t('موردی انتخاب نشده')}</span>
     {tab==='new'&&<button type="button" className={ui.ghost} data-part="ig-dismiss" disabled={!picked.size||busy||phase!=='pick'} onClick={dismissPicked}>{t('کنار گذاشتن انتخاب‌شده‌ها')}</button>}
     <button type="button" className={ui.ghost} disabled={!site||!picked.size||busy||phase!=='pick'} onClick={()=>runImport()}>{t('ساخت پیش‌نویس بدون تحلیل')}</button>
     <button type="button" className={ui.primary} disabled={!site||!picked.size||busy||phase!=='pick'} onClick={runAnalyze}>{t('تحلیل با هوش مصنوعی و پیش‌نمایش')}</button>
    </div>
    {phase==='pick'&&picked.size>0&&<p className={ui.notice}>{t('«تحلیل با هوش مصنوعی» قیمت، تخفیف، موجودی، رنگ و سایز، دسته و برچسب را پیشنهاد می‌دهد و قبل از ساخت می‌توانید همه را ویرایش کنید. بدون تحلیل، محصول‌ها پیش‌نویس ساخته می‌شوند. تصویر و ویدیو در فضای دلسا ذخیره می‌شود.')}</p>}
   </>}
  </>}
 </div></BuilderDialog>;
}

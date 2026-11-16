'use client';
import {useState} from 'react';
import {Search} from 'lucide-react';
import {lookupBook,candidateFrom} from '../lib/book-catalog-client';
import styles from './SiteBuilder.module.css';
// ISBN lookup inside the product form. The result is only a proposal: nothing is filled in until the
// customer clicks "use", and every field stays editable afterwards.
const rows=[['title','عنوان'],['author','نویسنده'],['translator','مترجم'],['publisher','ناشر'],['publish_year','سال انتشار'],['pages','تعداد صفحه'],['edition','نوبت چاپ'],['language','زبان'],['cover','نوع جلد']];
export default function BuilderBookLookup({isbn,onApply,disabled}){
 const [state,setState]=useState({status:'idle'});
 async function search(){
  setState({status:'loading'});
  const r=await lookupBook(isbn);
  if(!r.ok){setState({status:'error',message:r.message});return}
  const candidate=candidateFrom(r.data);
  setState(candidate?{status:'found',candidate}:{status:'none',message:r.data?.error==='lookup_unavailable'?'منبع بیرونی در دسترس نبود؛ دوباره تلاش کنید یا اطلاعات را دستی وارد کنید.':'کتابی با این شابک پیدا نشد؛ اطلاعات را دستی وارد کنید.'});
 }
 const c=state.candidate;
 return <div data-part="book-lookup">
  <button type="button" disabled={disabled||state.status==='loading'} onClick={search}><Search size={15}/>{state.status==='loading'?'در حال جست‌وجو…':'جست‌وجوی اطلاعات کتاب با شابک'}</button>
  <div role="status" aria-live="polite">
   {(state.status==='error'||state.status==='none')&&<p className={styles.hint}>{state.message}</p>}
   {state.status==='found'&&<section className={styles.card} data-part="book-candidate">
    <h4>اطلاعات پیشنهادی از {c.label}</h4>
    <p className={styles.hint}>پیش از استفاده بررسی کنید؛ بعد از پر شدن فرم هر فیلد را می‌توانید اصلاح کنید.</p>
    <dl>{rows.filter(([k])=>c[k]).map(([k,label])=><div key={k}><dt>{label}</dt><dd>{c[k]}{k==='publish_year'&&c.year_calendar==='gregorian'?' (میلادی)':''}</dd></div>)}</dl>
    {c.otherEditions?.length>0&&<p className={styles.hint}>{c.otherEditions.length.toLocaleString('fa-IR')} نسخه‌ی دیگر از همین اثر در کاتالوگ هست.</p>}
    <div className={styles.actions}><button type="button" className={styles.primary} onClick={()=>{onApply(c);setState({status:'applied',candidate:c})}}>استفاده از این اطلاعات</button><button type="button" onClick={()=>setState({status:'idle'})}>نادیده گرفتن</button></div>
   </section>}
   {state.status==='applied'&&<p className={styles.hint}>اطلاعات در فرم قرار گرفت؛ آن را بررسی و در صورت نیاز اصلاح کنید.</p>}
  </div>
 </div>;
}

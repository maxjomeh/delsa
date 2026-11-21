'use client';
import {useI18n} from './i18n/I18nProvider';
import {tx} from '../lib/i18n/config';
import {useState} from 'react';
import {Search} from 'lucide-react';
import {lookupBook,candidateFrom} from '../lib/book-catalog-client';
import styles from './SiteBuilder.module.css';
// ISBN lookup inside the product form. The result is only a proposal: nothing is filled in until the
// customer clicks "use", and every field stays editable afterwards.
const rowsTx=[['title',tx('عنوان')],['author',tx('نویسنده')],['translator',tx('مترجم')],['publisher',tx('ناشر')],['publish_year',tx('سال انتشار')],['pages',tx('تعداد صفحه')],['edition',tx('نوبت چاپ')],['language',tx('زبان')],['cover',tx('نوع جلد')]];
export default function BuilderBookLookup({isbn,onApply,disabled}){
 const {t,intl}=useI18n();
 const [state,setState]=useState({status:'idle'});
 async function search(){
  setState({status:'loading'});
  const r=await lookupBook(isbn);
  if(!r.ok){setState({status:'error',message:t(r.message)});return}
  const candidate=candidateFrom(r.data);
  setState(candidate?{status:'found',candidate}:{status:'none',message:r.data?.error==='lookup_unavailable'?t('منبع بیرونی در دسترس نبود؛ دوباره تلاش کنید یا اطلاعات را دستی وارد کنید.'):t('کتابی با این شابک پیدا نشد؛ اطلاعات را دستی وارد کنید.')});
 }
 const c=state.candidate;
 return <div data-part="book-lookup">
  <button type="button" disabled={disabled||state.status==='loading'} onClick={search}><Search size={15}/>{state.status==='loading'?t('در حال جست‌وجو…'):t('جست‌وجوی اطلاعات کتاب با شابک')}</button>
  <div role="status" aria-live="polite">
   {(state.status==='error'||state.status==='none')&&<p className={styles.hint}>{state.message}</p>}
   {state.status==='found'&&<section className={styles.card} data-part="book-candidate">
    <h4>{t('اطلاعات پیشنهادی از')} {t(c.label)}</h4>
    <p className={styles.hint}>{t('پیش از استفاده بررسی کنید؛ بعد از پر شدن فرم هر فیلد را می‌توانید اصلاح کنید.')}</p>
    <dl>{rowsTx.filter(([k])=>c[k]).map(([k,label])=><div key={k}><dt>{t(label)}</dt><dd>{c[k]}{k==='publish_year'&&c.year_calendar==='gregorian'?t(' (میلادی)'):''}</dd></div>)}</dl>
    {c.otherEditions?.length>0&&<p className={styles.hint}>{c.otherEditions.length.toLocaleString(intl)} {t('نسخه‌ی دیگر از همین اثر در کاتالوگ هست.')}</p>}
    <div className={styles.actions}><button type="button" className={styles.primary} onClick={()=>{onApply(c);setState({status:'applied',candidate:c})}}>{t('استفاده از این اطلاعات')}</button><button type="button" onClick={()=>setState({status:'idle'})}>{t('نادیده گرفتن')}</button></div>
   </section>}
   {state.status==='applied'&&<p className={styles.hint}>{t('اطلاعات در فرم قرار گرفت؛ آن را بررسی و در صورت نیاز اصلاح کنید.')}</p>}
  </div>
 </div>;
}

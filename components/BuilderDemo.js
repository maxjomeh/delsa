'use client';
import {useEffect,useState} from 'react';
import Link from './i18n/Link';
import {useI18n} from './i18n/I18nProvider';
import HomeHeader from './home/HomeHeader';
import SiteFooter from './home/SiteFooter';
import BuilderVisualEditor from './BuilderVisualEditor';
import {starter,normalizeDocument} from '../lib/site-builder';

// Only the new (v2) templates have translated copy, so other languages start from "mehr" while Persian keeps the original sample.
// Try-it-out editor on the builder landing page. The sample site is written in the visitor's language;
// each language keeps its own draft in localStorage (Persian keeps the original key).
export default function BuilderDemo({siteMessages}){
 const {t,locale}=useI18n();
 const storageKey=locale==='fa'?'delsa-design-demo-v1':'delsa-design-demo-v1-'+locale;
 const [doc,setDoc]=useState(null),[page,setPage]=useState(null),[notice,setNotice]=useState('');
 useEffect(()=>{let d;try{const stored=localStorage.getItem(storageKey);d=stored?normalizeDocument(JSON.parse(stored)):null}catch{}if(!d?.pages.length)d=starter(locale==='fa'?'catalog':'mehr',t('فروشگاه نمونه'),'general',locale,siteMessages);setDoc(d);setPage(d.pages[0].id)},[storageKey,locale,siteMessages,t]);
 function save(){try{localStorage.setItem(storageKey,JSON.stringify(normalizeDocument(doc)));setNotice(t('نمونه روی همین دستگاه ذخیره شد. برای ساخت و انتشار سایت خودت، وارد پنل شو.'))}catch{setNotice(t('مرورگر اجازهٔ ذخیره روی دستگاه را نداد.'))}}
 return <div className="hx"><HomeHeader home={false}/><main className="hx-demo-shell"><header style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:15,flexWrap:'wrap'}}><div><Link href="/builder">DELSA · {t('سایت‌ساز')}</Link><h1 style={{fontSize:24}}>{t('ویرایشگر را امتحان کن')}</h1><p style={{fontSize:16,color:'var(--muted)'}}>{t('این یک سایت نمونه است؛ تغییرات به حساب یا سایت مشتریان متصل نیست.')}</p></div><Link className="button small" href="/dashboard?tab=builder">{t('ساخت سایت در پنل من')}</Link></header>{notice&&<p role="status">{notice}</p>}{doc?<BuilderVisualEditor site={{id:'demo',name:t('فروشگاه نمونه')}} db={null} document={doc} pageId={page} onPage={setPage} onChange={setDoc} access busy={false} allowUploads={false} onSave={save} onPublish={()=>setNotice(t('برای انتشار سایت، وارد پنل شو و سایت خودت را با اشتراک سایت‌ساز بساز.'))}/>:<p role="status">{t('در حال آماده‌سازی نمونه…')}</p>}</main><SiteFooter/></div>
}

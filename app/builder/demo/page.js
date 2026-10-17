
'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import BuilderVisualEditor from '../../../components/BuilderVisualEditor';
import {starter,normalizeDocument} from '../../../lib/site-builder';
export default function DesignerDemo(){
const [doc,setDoc]=useState(null),[page,setPage]=useState(null),[notice,setNotice]=useState('');
useEffect(()=>{let d;try{const stored=localStorage.getItem('delsa-design-demo-v1');d=stored?normalizeDocument(JSON.parse(stored)):null}catch{}if(!d?.pages.length)d=starter('catalog','فروشگاه نمونه');setDoc(d);setPage(d.pages[0].id)},[]);
function save(){try{localStorage.setItem('delsa-design-demo-v1',JSON.stringify(normalizeDocument(doc)));setNotice('نمونه روی همین دستگاه ذخیره شد. برای ساخت و انتشار سایت خودت، وارد پنل شو.')}catch{setNotice('مرورگر اجازهٔ ذخیره روی دستگاه را نداد.')}}
return <main style={{padding:'20px',maxWidth:1600,margin:'auto'}}><header style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:15,flexWrap:'wrap'}}><div><Link href="/builder">DELSA · سایت‌ساز</Link><h1 style={{fontSize:24}}>ویرایشگر را امتحان کن</h1><p style={{fontSize:12,color:'var(--muted)'}}>این یک سایت نمونه است؛ تغییرات به حساب یا سایت مشتریان متصل نیست.</p></div><Link className="button small" href="/dashboard?tab=builder">ساخت سایت در پنل من</Link></header>{notice&&<p role="status">{notice}</p>}{doc?<BuilderVisualEditor site={{id:'demo',name:'فروشگاه نمونه'}} db={null} document={doc} pageId={page} onPage={setPage} onChange={setDoc} access busy={false} allowUploads={false} onSave={save} onPublish={()=>setNotice('برای انتشار سایت، وارد پنل شو و سایت خودت را با اشتراک سایت‌ساز بساز.')}/>:<p role="status">در حال آماده‌سازی نمونه…</p>}</main>
}

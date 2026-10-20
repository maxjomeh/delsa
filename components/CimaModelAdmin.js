'use client';
import {useEffect,useState} from 'react';
import {BrainCircuit,CheckCircle2,KeyRound,LockKeyhole,RefreshCw,ShieldCheck,Eye,EyeOff,Power} from 'lucide-react';
import styles from './CimaModelAdmin.module.css';
export default function CimaModelAdmin(){
 const [settings,setSettings]=useState(null),[apiKey,setApiKey]=useState(''),[show,setShow]=useState(false);
 const [busy,setBusy]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function load(){
  try{const response=await fetch('/api/admin/cima-model',{cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.error||'دریافت تنظیمات انجام نشد.');
   setSettings(data.settings);setError('');
  }catch(e){setError(e.message||'اطلاعات اتصال دریافت نشد.');}finally{setLoading(false);}
 }
 useEffect(()=>{load();},[]);
 async function action(name){
  if(busy)return;
  if(name==='save'&&apiKey.trim().length<20){setError('کلید جدید کامل نیست.');return;}
  if(name==='test'&&!window.confirm('برای آزمایش، یک درخواست کوتاه و کم‌هزینه به GapGPT ارسال می‌شود. ادامه می‌دهید؟'))return;
  if(name==='disable'&&!window.confirm('آیا می‌خواهید تولید پیشنهاد با GapGPT را متوقف کنید؟'))return;
  setError('');setMessage('');setBusy(name);
  try{
   const response=await fetch('/api/admin/cima-model',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    action:name,...(name==='save'?{apiKey,model:'gpt-4o-mini'}:{})
   })});
   const data=await response.json();
   if(data.settings)setSettings(data.settings);
   if(!response.ok)throw Error(data.message||data.error||'عملیات انجام نشد.');
   if(name==='save'){setApiKey('');setShow(false);}
   setMessage(data.message||'تنظیمات به‌روز شد.');
  }catch(e){setError(e.message||'ارتباط با سرویس ناموفق بود.');}
  finally{setBusy('');}
 }
 const configured=!!settings?.configured,connected=settings?.lastTestStatus==='passed';
 return <section dir="rtl" className={styles.root} aria-label="تنظیمات مدل هوش مصنوعی سیما">
  <div className={styles.header}><div className={styles.mark}><BrainCircuit size={23}/></div><div><span className={styles.kicker}>CIMA AI INFRASTRUCTURE</span>
  <h2>مدیریت مدل و کلیدهای API</h2><p>کلید GapGPT را بدون تغییر کد یا انتشار مجدد جایگزین کن. این کلید فقط در سرور رمزگذاری و برای پیش‌نویس سیما استفاده می‌شود.</p></div></div>
  <div className={styles.stats}><div><span>ارائه‌دهنده</span><strong>GapGPT</strong></div><div><span>مدل اقتصادی</span><strong dir="ltr">gpt-4o-mini</strong></div>
   <div><span>کلید سرور</span><strong>{configured?'ثبت‌شده':'هنوز ثبت نشده'}</strong></div>
   <div><span>اتصال</span><strong>{loading?'در حال بررسی':connected?'آزمایش موفق':settings?.lastTestStatus==='failed'?'آزمایش ناموفق':'آزمایش نشده'}</strong></div>
  </div>
  <div className={styles.section}><div className={styles.sectionTitle}><KeyRound size={20}/><div><strong>ثبت یا تعویض توکن</strong><small>مقدار کامل توکن بعد از ذخیره هرگز نمایش داده نمی‌شود.</small></div></div>
   <label htmlFor="gapgpt-admin-key">کلید API جدید</label>
   <div className={styles.secret}><input id="gapgpt-admin-key" type={show?'text':'password'} value={apiKey} onChange={e=>setApiKey(e.target.value)}
    autoComplete="new-password" spellCheck="false" dir="ltr" placeholder={configured?'برای جایگزینی، کلید جدید را وارد کنید':'کلید دریافتی از GapGPT را وارد کنید'}/>
    <button type="button" onClick={()=>setShow(v=>!v)} aria-label={show?'مخفی کردن کلید':'نمایش موقت کلید'}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>
   <p className={styles.hint}>برای شروع از مدل <code dir="ltr">gpt-4o-mini</code> استفاده می‌کنیم. آدرس API ثابت و فقط سروری است:
    <code dir="ltr">https://api.gapgpt.app/v1</code></p>
   <button type="button" className={styles.primary} onClick={()=>action('save')} disabled={!!busy||apiKey.trim().length<20}>
    <LockKeyhole size={16}/>{busy==='save'?'در حال ثبت امن…':configured?'جایگزینی و ذخیرهٔ کلید':'ذخیرهٔ کلید'}</button>
  </div>
  <div className={styles.section}><div className={styles.sectionTitle}><ShieldCheck size={20}/><div><strong>آزمایش و فعال‌سازی</strong>
   <small>پس از تغییر کلید، ابتدا اتصال باید دوباره آزمایش شود.</small></div></div>
   <div className={styles.buttons}><button type="button" disabled={!!busy||!configured} onClick={()=>action('test')}>
    <RefreshCw size={16}/>{busy==='test'?'در حال آزمایش…':'تست کم‌هزینهٔ اتصال'}</button>
    {settings?.enabled?<button type="button" disabled={!!busy} className={styles.stop} onClick={()=>action('disable')}><Power size={16}/>غیرفعال‌کردن</button>
    :<button type="button" disabled={!!busy||!configured||!connected} className={styles.primary} onClick={()=>action('enable')}>
    <CheckCircle2 size={16}/>فعال‌سازی پیشنهادهای AI</button>}</div>
   <p className={styles.state}>وضعیت فعلی: <b>{settings?.enabled?'فعال برای پیش‌نویس‌های تحت نظارت':'غیرفعال'}</b>
    {settings?.updatedAt&&<small> · آخرین تغییر: {new Date(settings.updatedAt).toLocaleString('fa-IR')}</small>}</p>
  </div>
  <p className={styles.safety}><ShieldCheck size={16}/> هیچ پاسخی به‌صورت خودکار برای مشتری ارسال نخواهد شد. فعال‌سازی فقط پیشنهاد متن را در صندوق «نیازمند پاسخ شما» فراهم می‌کند. برای قیمت یا موجودی و مسائل حساس، انسان همچنان تصمیم‌گیرنده است.</p>
  {error&&<div className={styles.error} role="alert">{error}</div>}
  {message&&<div className={styles.success} role="status">{message}</div>}
 </section>;
}

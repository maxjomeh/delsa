'use client';
// Owner control of automatic replies: what the server allows, the master switch, an always-available STOP, caps, and the log
// of every decision CIMA made (including the ones it refused). Turning ON or resuming needs an explicit acknowledgement.
import {useCallback,useEffect,useState} from 'react';
import {OctagonX,ShieldCheck} from 'lucide-react';
import styles from './AutoRepliesPanel.module.css';

const num=v=>Number(v||0).toLocaleString('fa-IR');
const when=v=>new Date(v).toLocaleString('fa-IR',{timeZone:'Asia/Tehran',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
const MODE={
  off:['خاموش','سرور هنوز برای پاسخ خودکار تنظیم نشده است؛ حتی با روشن‌بودن کلید شما چیزی ارزیابی یا ارسال نمی‌شود.'],
  dry_run:['آزمایشی','حالت آزمایشی: سیما برای هر گفت‌وگو تصمیم می‌گیرد و ثبت می‌کند، ولی هیچ پیامی برای مشتری نمی‌فرستد.'],
  live:['زنده','حالت زنده: پاسخ‌های تأییدشده‌ی موضوع‌های خودکار بدون تأیید شما برای مشتری فرستاده می‌شود.'],
};
const STATUS={blocked:'مسدود شد',dry_run:'آزمایشی (ارسال نشد)',queued:'در صف',sent:'ارسال شد',rejected:'ارائه‌دهنده رد کرد',unknown:'نتیجه نامشخص',failed:'ارسال نشد'};
const REASON={AUTO_REPLY_DISABLED:'پاسخ خودکار خاموش است',TENANT_PAUSED:'پاسخ خودکار متوقف است',TOPIC_NOT_AUTOMATIC:'موضوع هنوز خودکار نیست',NEVER_AUTO_TOPIC:'موضوع همیشه با انسان است',
  TOPIC_NOT_ACTIVE:'موضوع فعال نیست',CONFIDENCE_BELOW_THRESHOLD:'اعتماد‌به‌نفس کمتر از آستانه',THRESHOLD_BELOW_OWNER_FLOOR:'آستانه پایین‌تر از کف شما',
  MESSAGING_WINDOW_CLOSED:'مهلت پاسخ اینستاگرام گذشته',ALREADY_HANDLED:'پیش‌تر پاسخ داده یا در صف است',NO_APPROVED_ANSWER:'پاسخ تأییدشده‌ای نبود',
  KNOWLEDGE_NOT_IN_TOPIC:'دانش مربوط به این موضوع نیست',ANSWER_CONTAINS_LOCKED_TOPIC:'متن پاسخ درباره‌ی قیمت یا تعهد است',ANSWER_TOO_LONG:'پاسخ بسیار طولانی است',
  HOURLY_CAP:'سقف ساعتی پر شد',CUSTOMER_DAILY_CAP:'سقف روزانه‌ی این مشتری پر شد',SENDER_NOT_CONNECTED:'پیج متصل نیست',CLAIM_REFUSED:'ارسال پذیرفته نشد',PREPARE_FAILED:'آماده‌سازی ارسال رد شد'};
const reasonText=code=>REASON[code]||(code.startsWith('MISSING_FIELD')?'اطلاعات لازم مشتری تأیید نشده':code.startsWith('RISK:')?'پیام مشتری حساس است':code.startsWith('PROVIDER_')?'ارائه‌دهنده پیام را نپذیرفت یا نتیجه نامشخص است':code);
const ERRORS={acknowledgement_required:'برای روشن‌کردن باید تأیید کنید.',invalid_caps:'سقف‌ها باید عدد صحیح معتبر باشند.',not_sent:'فقط پاسخ ارسال‌شده را می‌شود اشتباه علامت زد.',already_marked:'این مورد قبلاً علامت خورده است.',invalid_origin:'صفحه را تازه کنید.'};

export default function AutoRepliesPanel({onChange}){
  const [data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [ack,setAck]=useState(false),[caps,setCaps]=useState({hourly:'',daily:''});
  const load=useCallback(async()=>{
    try{const r=await fetch('/api/crm/auto',{cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error('x');setData(j);setCaps({hourly:String(j.caps.hourly),daily:String(j.caps.customerDaily)});setError('');}
    catch{setError('وضعیت پاسخ خودکار در دسترس نیست.');}
  },[]);
  useEffect(()=>{load();},[load]);
  async function act(action,payload={},message=''){
    if(busy)return;
    setBusy(true);setError('');setNotice('');
    try{
      const response=await fetch('/api/crm/auto',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...payload})});
      const json=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(ERRORS[json.error]||'انجام نشد؛ دوباره تلاش کنید.');
      setAck(false);if(message)setNotice(message);
      await load();onChange?.();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  if(!data)return <section className={styles.panel} aria-busy="true"><p className={styles.hint} role="status">{error||'در حال بارگذاری وضعیت پاسخ خودکار…'}</p></section>;
  const [modeName,modeText]=MODE[data.serverMode]||MODE.off;
  const running=data.enabled&&!data.paused;
  return <section className={styles.panel} aria-label="پاسخ خودکار">
    <header className={styles.head}>
      <div><h4><ShieldCheck size={18} aria-hidden="true"/>پاسخ خودکار</h4><p className={styles.hint}>{modeText}</p></div>
      <div className={styles.chips}>
        <span className={styles.chip} data-tone={data.serverMode}>حالت سرور: {modeName}</span>
        <span className={styles.chip} data-tone={running?'on':data.paused?'paused':'off'}>{running?'کلید شما: روشن':data.paused?'متوقف شده':'کلید شما: خاموش'}</span>
      </div>
    </header>
    {error&&<p role="alert" className={styles.error}>{error}</p>}
    {notice&&<p role="status" className={styles.notice}>{notice}</p>}

    <div className={styles.controls}>
      {running&&<button type="button" className={styles.stop} disabled={busy} onClick={()=>act('pause',{},'پاسخ خودکار فوراً متوقف شد و همه‌ی موضوع‌های خودکار به حالت «پیشنهاد» برگشتند.')}><OctagonX size={19} aria-hidden="true"/>توقف فوری</button>}
      {running&&<button type="button" disabled={busy} onClick={()=>act('disable',{},'پاسخ خودکار خاموش شد.')}>خاموش‌کردن</button>}
      {!running&&<div className={styles.confirm}>
        <label><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/>می‌دانم که در حالت زنده، پاسخ‌های تأییدشده‌ی موضوع‌های خودکار بدون تأیید من برای مشتری فرستاده می‌شود و هر زمان می‌توانم «توقف فوری» را بزنم.</label>
        <button type="button" className={styles.primary} disabled={busy||!ack} onClick={()=>act(data.paused?'resume':'enable',{acknowledged:true},data.paused?'ازسرگرفته شد.':'کلید پاسخ خودکار روشن شد.')}>{data.paused?'ازسرگیری':'روشن‌کردن پاسخ خودکار'}</button>
      </div>}
    </div>

    <form className={styles.caps} onSubmit={e=>{e.preventDefault();act('set_caps',{hourly:Number(caps.hourly),customerDaily:Number(caps.daily)},'سقف‌ها ذخیره شد.');}}>
      <label>حداکثر پاسخ خودکار در ساعت<input inputMode="numeric" value={caps.hourly} onChange={e=>setCaps({...caps,hourly:e.target.value})}/></label>
      <label>حداکثر برای هر مشتری در روز<input inputMode="numeric" value={caps.daily} onChange={e=>setCaps({...caps,daily:e.target.value})}/></label>
      <button disabled={busy}>ذخیره‌ی سقف‌ها</button>
    </form>

    <div className={styles.counts} aria-label="۲۴ ساعت گذشته">
      {['sent','dry_run','blocked','unknown','rejected','failed'].filter(k=>data.counts?.[k]).map(k=><span key={k}><b>{num(data.counts[k])}</b>{STATUS[k]}</span>)}
      {Object.keys(data.counts||{}).length===0&&<span className={styles.hint}>در ۲۴ ساعت گذشته تصمیمی ثبت نشده است.</span>}
    </div>

    {data.log.length>0&&<details className={styles.log} open><summary>گزارش تصمیم‌ها</summary><ul>
      {data.log.map(item=><li key={item.id}>
        <div className={styles.row}><strong>{item.topicLabel||'موضوع'}</strong><span className={styles.chip} data-tone={item.status}>{STATUS[item.status]||item.status}</span>
          {item.wrong_marked_at&&<span className={styles.chip} data-tone="wrong">علامت‌خورده: اشتباه</span>}<small>{when(item.created_at)}</small></div>
        {item.answer_text&&<p>{item.answer_text.length>90?item.answer_text.slice(0,90)+'…':item.answer_text}</p>}
        {item.reasons?.length>0&&<small className={styles.hint}>{item.reasons.map(reasonText).join('، ')}</small>}
        {item.status==='sent'&&!item.wrong_marked_at&&<button type="button" className={styles.link} disabled={busy} onClick={()=>{if(window.confirm('این پاسخ اشتباه بود؟ اعتماد‌به‌نفس این موضوع کم می‌شود و ممکن است از حالت خودکار خارج شود.'))act('mark_wrong',{id:item.id},'ثبت شد؛ سیما از این اشتباه یاد می‌گیرد.');}}>اشتباه بود</button>}
      </li>)}
    </ul></details>}
  </section>;
}

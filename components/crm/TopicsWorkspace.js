'use client';
// CIMA topics: what customers ask about, how sure CIMA is for each topic, and what the owner has allowed.
// Topic configuration and learning evidence. Automatic replies are controlled in AutoRepliesPanel (explicit acknowledgement to turn on).
import {useCallback,useEffect,useMemo,useState} from 'react';
import {Check,Lightbulb,RefreshCw,Search,ShieldAlert} from 'lucide-react';
import AutoRepliesPanel from './AutoRepliesPanel';
import styles from './TopicsWorkspace.module.css';

const num=v=>Number(v||0).toLocaleString('fa-IR');
const pct=v=>`${num(Math.round(v*100))}٪`;
const STATUS={proposed:'پیشنهادی',active:'فعال',retired:'بازنشسته'};
const STAGE={learning:'در حال یادگیری',shadow:'سایه (بدون ارسال)',suggest:'پیشنهاد به انسان',auto:'خودکار'};
const ERRORS={invalid_label:'نام باید بین ۲ تا ۱۲۰ نویسه باشد.',invalid_floor:'حداقل اعتماد‌به‌نفس باید بین ۵۰٪ و ۹۹٪ باشد.',unknown_field:'یکی از فیلدها دیگر فعال نیست.',
 invalid_transition:'این تغییر در وضعیت فعلی ممکن نیست.',not_found:'این موضوع پیدا نشد.',invalid_origin:'درخواست نامعتبر بود؛ صفحه را تازه کنید.',update_refused:'پایگاه داده این تغییر را نپذیرفت.'};
const FLOORS=[0.8,0.85,0.9,0.95,0.97,0.99];
const MIN_SAMPLES=30;

// "Why has this topic not advanced, and what can I do?" — built from the same decision the evaluator takes.
function readinessText(topic){
  const r=topic.readiness?.reason,c=topic.confidence,th=Number(topic.confidence_threshold);
  if(topic.never_auto||r==='NEVER_AUTO_TOPIC')return 'همیشه با انسان است؛ هرگز خودکار نمی‌شود.';
  switch(r){
    case 'NOT_ACTIVE':return topic.status==='retired'?'بازنشسته است.':'برای شروع سنجش، موضوع را فعال کنید.';
    case 'NEEDS_KNOWLEDGE_AND_FIELDS':{
      const todo=[];
      if(!topic.knowledgeApproved)todo.push('یک پاسخ تأییدشده‌ی مرتبط در «دانش کسب‌وکار» اضافه کنید');
      if(!topic.requiredFields?.length)todo.push('حداقل یک «اطلاعات لازم» انتخاب کنید');
      return todo.length?`برای ادامه: ${todo.join(' و ')}.`:'در حال بررسی…';
    }
    case 'READY_FOR_SHADOW':return 'آماده‌ی ورود به مرحله‌ی سایه است؛ «اجرای بازپخش» را بزنید.';
    case 'COLLECTING_SHADOW_EVIDENCE':return `شواهد کافی نیست (${num(Math.min(MIN_SAMPLES,Math.floor(c?.effectiveN||0)))} از ${num(MIN_SAMPLES)} نمونه)؛ «اجرای بازپخش» را بزنید یا پاسخ‌های بیشتری جمع شود.`;
    case 'SHADOW_EVIDENCE_SUFFICIENT':return 'شواهد کافی است؛ به «پیشنهاد به انسان» می‌رود.';
    case 'AUTO_REPLY_DISABLED':return 'برای خودکارشدن، کلید «پاسخ خودکار» را بالای صفحه روشن کنید.';
    case 'BELOW_AUTO_THRESHOLD':return `اعتماد‌به‌نفس ${c?.status==='measured'?pct(c.confidence):'هنوز نامشخص'} به آستانه‌ی ${pct(th)} نرسیده است.`;
    case 'CONFIDENCE_AT_THRESHOLD':return 'به آستانه رسیده است؛ در اجرای بعدی خودکار می‌شود.';
    case 'CONFIDENCE_HOLDS':return 'خودکار و پایدار است.';
    case 'CONFIDENCE_BELOW_THRESHOLD':case 'CONFIDENCE_COLLAPSED':case 'REPEATED_WRONG_AUTOMATIC_ANSWERS':
      return 'اعتماد‌به‌نفس کم شده است؛ در ارزیابی بعدی از مرحله‌ی فعلی پایین‌تر می‌آید.';
    default:return '';
  }
}

async function call(action,payload={}){
  const response=await fetch('/api/crm/topics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...payload})});
  const json=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(ERRORS[json.error]||'انجام نشد؛ دوباره تلاش کنید.');
  return json;
}

function Meter({confidence,threshold}){
  if(confidence?.status!=='measured'){
    const have=Math.min(MIN_SAMPLES,Math.floor(confidence?.effectiveN||0));
    return <div className={styles.meter}><div className={styles.track} role="progressbar" aria-label="نمونه‌های جمع‌شده" aria-valuemin={0} aria-valuemax={MIN_SAMPLES} aria-valuenow={have}><i style={{width:`${(have/MIN_SAMPLES)*100}%`}}/></div>
      <small>داده‌ی کافی نیست: {num(have)} از {num(MIN_SAMPLES)} نمونه</small></div>;
  }
  const value=confidence.confidence;
  return <div className={styles.meter}><div className={styles.track} role="meter" aria-label="اعتماد‌به‌نفس" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value*100)}>
    <i className={value>=threshold?styles.ok:''} style={{width:`${value*100}%`}}/><b style={{insetInlineStart:`${threshold*100}%`}} title={`آستانه ${pct(threshold)}`}/></div>
    <small>اعتماد‌به‌نفس {pct(value)}، آستانه {pct(threshold)}، {num(Math.round(confidence.effectiveN))} نمونه</small></div>;
}

function TopicCard({topic,fields,busy,onAct,onFields}){
  const [name,setName]=useState(topic.label),[editing,setEditing]=useState(false),[picked,setPicked]=useState(topic.requiredFields);
  useEffect(()=>{setName(topic.label);setPicked(topic.requiredFields);},[topic.label,topic.requiredFields.join('|')]);
  const dirty=picked.slice().sort().join('|')!==topic.requiredFields.slice().sort().join('|');
  return <article className={styles.card} data-status={topic.status}>
    <header>
      {editing
        ?<form onSubmit={e=>{e.preventDefault();onAct('rename',{id:topic.id,label:name}).then(ok=>ok&&setEditing(false));}}><input value={name} maxLength={120} onChange={e=>setName(e.target.value)} aria-label="نام موضوع" autoFocus/><button disabled={busy}>ذخیره</button><button type="button" onClick={()=>{setName(topic.label);setEditing(false);}}>انصراف</button></form>
        :<h4>{topic.label}<button type="button" className={styles.link} onClick={()=>setEditing(true)}>تغییر نام</button></h4>}
      <div className={styles.chips}>
        <span className={styles.chip} data-tone={topic.status}>{STATUS[topic.status]}</span>
        <span className={styles.chip}>{STAGE[topic.stage]}</span>
        {topic.never_auto&&<span className={styles.chip} data-tone="locked"><ShieldAlert size={14} aria-hidden="true"/>هرگز خودکار</span>}
      </div>
    </header>
    {readinessText(topic)&&<p className={styles.readiness} data-reason={topic.readiness?.reason} role="status">{readinessText(topic)}</p>}
    {!topic.never_auto&&<p className={styles.hint}>پاسخ تأییدشده‌ی مرتبط: {num(topic.knowledgeApproved||0)}</p>}
    {topic.origin==='discovered'&&topic.keywords?.length>0&&<p className={styles.hint}>کلیدواژه‌ها: {topic.keywords.slice(0,4).join('، ')}</p>}
    {topic.examples?.length>0&&<details><summary>نمونه سؤال‌ها</summary><ul>{topic.examples.slice(0,3).map((e,i)=><li key={i}>«{e}»</li>)}</ul></details>}
    <Meter confidence={topic.confidence} threshold={Number(topic.confidence_threshold)}/>
    {topic.never_auto
      ?<p className={styles.hint}>این موضوع شامل پرسش‌هایی است که همیشه باید انسان پاسخ بدهد؛ سیما فقط می‌تواند پیش‌نویس پیشنهاد کند.</p>
      :<>
        <fieldset className={styles.fields} disabled={busy||topic.status==='retired'}>
          <legend>اطلاعات لازم پیش از پاسخ</legend>
          <p className={styles.hint}>سیما فقط وقتی پاسخ می‌دهد که این اطلاعات برای مشتری تأیید شده باشد. بدون انتخاب، این موضوع از مرحله‌ی یادگیری جلوتر نمی‌رود.</p>
          {fields.length===0&&<p className={styles.hint}>فیلدی تعریف نشده است؛ از بخش «اطلاعات جدید» فیلد بسازید.</p>}
          <div className={styles.checks}>{fields.map(f=><label key={f.key}><input type="checkbox" checked={picked.includes(f.key)} onChange={e=>setPicked(e.target.checked?[...picked,f.key]:picked.filter(k=>k!==f.key))}/>{f.label}</label>)}</div>
          {dirty&&<button type="button" onClick={()=>onFields(topic.id,picked)}>ذخیره‌ی اطلاعات لازم</button>}
        </fieldset>
        <label className={styles.floor}>حداقل اعتماد‌به‌نفس لازم
          <select value={FLOORS.includes(Number(topic.confidence_floor))?Number(topic.confidence_floor):''} disabled={busy||topic.status==='retired'} onChange={e=>onAct('set_floor',{id:topic.id,floor:Number(e.target.value)})}>
            {!FLOORS.includes(Number(topic.confidence_floor))&&<option value="">{pct(Number(topic.confidence_floor))}</option>}
            {FLOORS.map(f=><option key={f} value={f}>{pct(f)}</option>)}
          </select>
          <small>سیما می‌تواند آستانه را بالاتر ببرد، هرگز پایین‌تر از این نمی‌آورد.</small>
        </label>
      </>}
    <footer>
      {topic.status!=='active'&&topic.status!=='retired'&&<button type="button" className={styles.primary} disabled={busy} onClick={()=>onAct('activate',{id:topic.id})}><Check size={17} aria-hidden="true"/>فعال‌سازی و شروع سنجش</button>}
      {topic.status==='retired'&&<button type="button" disabled={busy} onClick={()=>onAct('activate',{id:topic.id})}>فعال‌سازی دوباره</button>}
      {topic.status!=='retired'&&Number(topic.confidence_threshold)>Number(topic.confidence_floor)+1e-9&&<button type="button" disabled={busy} onClick={()=>{if(window.confirm(`آستانه‌ی این موضوع از ${pct(Number(topic.confidence_floor))} بالاتر رفته است (معمولاً بعد از «اشتباه بود»). به کف خودتان برگردانده شود؟ خودکارشدن دوباره آسان‌تر می‌شود.`))onAct('reset_threshold',{id:topic.id});}}>بازنشانی آستانه به {pct(Number(topic.confidence_floor))}</button>}
      {topic.status!=='retired'&&<button type="button" disabled={busy} onClick={()=>onAct('retire',{id:topic.id})}>بازنشسته‌کردن</button>}
    </footer>
  </article>;
}

export default function TopicsWorkspace(){
  const [data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[suggestions,setSuggestions]=useState([]);
  const load=useCallback(async()=>{
    try{const r=await fetch('/api/crm/topics',{cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error('x');setData(j);setError('');}
    catch{setError('فهرست موضوع‌ها در دسترس نیست.');}
  },[]);
  useEffect(()=>{load();},[load]);

  async function act(action,payload){
    if(busy)return false;
    setBusy(true);setError('');setNotice('');
    try{
      const result=await call(action,payload);
      if(action==='discover')setNotice(result.inserted?`${num(result.inserted)} موضوع جدید پیشنهاد شد.`:'موضوع تازه‌ای پیدا نشد.');
      if(action==='replay'){
        setNotice(`بازپخش انجام شد؛ ${num(result.persisted)} نتیجه‌ی تازه ثبت شد.`);
        setSuggestions(result.report.topics.filter(t=>t.knowledgeSuggestion).map(t=>({key:t.topic.key,label:t.topic.label,...t.knowledgeSuggestion})));
      }
      await load();return true;
    }catch(e){setError(e.message);return false;}finally{setBusy(false);}
  }
  async function saveFields(id,fields){
    if(busy)return;
    setBusy(true);setError('');setNotice('');
    try{await call('set_fields',{id,fields});setNotice('اطلاعات لازم ذخیره شد.');await load();}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function draftKnowledge(s){
    if(busy)return;
    setBusy(true);setError('');setNotice('');
    try{
      const response=await fetch('/api/crm/knowledge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',category:'faq',title:s.label.length>=3?s.label:`${s.label}…`,question:s.question,answer:s.answer})});
      if(!response.ok)throw new Error('ساخت پیش‌نویس انجام نشد.');
      setSuggestions(list=>list.filter(x=>x.key!==s.key));setNotice('پیش‌نویس در «دانش کسب‌وکار» ساخته شد؛ پس از بازبینی و تأیید شما استفاده می‌شود.');
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  const topics=useMemo(()=>data?.topics||[],[data]);
  const groups=useMemo(()=>[['فعال',topics.filter(t=>t.status==='active')],['پیشنهادی',topics.filter(t=>t.status==='proposed')],['بازنشسته',topics.filter(t=>t.status==='retired')]].filter(([,list])=>list.length),[topics]);

  return <section className={styles.wrap} aria-busy={busy}>
    <header className={styles.head}><div><h3>موضوع‌ها و پاسخ خودکار</h3><p>سیما از سؤال‌های واقعی مشتریان موضوع پیدا می‌کند و برای هر موضوع می‌سنجد چقدر مطمئن است.</p></div>
      <div className={styles.actions}>
        <button type="button" disabled={busy} onClick={()=>act('discover')}><Search size={17} aria-hidden="true"/>کشف موضوع‌ها</button>
        <button type="button" disabled={busy} onClick={()=>act('replay')}><RefreshCw size={17} aria-hidden="true"/>اجرای بازپخش</button>
      </div></header>
    <AutoRepliesPanel onChange={load}/>
    {error&&<p role="alert" className={styles.error}>{error}</p>}
    {notice&&<p role="status" className={styles.notice}>{notice}</p>}

    {suggestions.length>0&&<section className={styles.suggest} aria-label="پیشنهاد دانش"><h4><Lightbulb size={18} aria-hidden="true"/>پیشنهاد دانش از پاسخ‌های خودتان</h4>
      <p className={styles.hint}>شما به این پرسش‌ها همیشه تقریباً یک‌جور جواب داده‌اید. هر مورد فقط پیش‌نویس می‌شود و بدون تأیید شما استفاده نمی‌شود.</p>
      <ul>{suggestions.map(s=><li key={s.key}><div><strong>«{s.question}»</strong><p>{s.answer}</p>
        <small>{num(s.support)} پاسخ، ثبات {pct(s.consistency)}</small>
        {s.containsNumbers&&<small className={styles.warn}>شامل عدد (مثلاً ساعت یا تعداد) است؛ پیش از تأیید درستی‌اش را بررسی کنید.</small>}</div>
        <button type="button" disabled={busy} onClick={()=>draftKnowledge(s)}>ساخت پیش‌نویس دانش</button></li>)}</ul></section>}

    {!data&&!error&&<p role="status" className={styles.hint}>در حال بارگذاری…</p>}
    {data&&topics.length===0&&<div className={styles.empty}><p>هنوز موضوعی ثبت نشده است.</p><p className={styles.hint}>«کشف موضوع‌ها» را بزنید تا سیما از گفت‌وگوهای قبلی‌تان پیشنهاد بدهد. موضوع‌ها تا فعال‌سازی شما فقط پیشنهادی‌اند.</p></div>}
    {groups.map(([title,list])=><div key={title} className={styles.group}><h4>{title}<span className={styles.count}>{num(list.length)}</span></h4>
      <div className={styles.grid}>{list.map(t=><TopicCard key={t.id} topic={t} fields={data.fields||[]} busy={busy} onAct={act} onFields={saveFields}/>)}</div></div>)}
  </section>;
}

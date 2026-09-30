'use client';

import Link from 'next/link';
import ChatMessage from './ChatMessage';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '../lib/supabase/client';
import { daysRemainingIran } from '../lib/subscription-days';
import {
  ArrowLeft, BarChart3, Check, CircleHelp, Clock3, Database, ExternalLink,
  FileText, LogOut, MessageCircle, Plus, RefreshCw, Send, ShieldCheck,
  SlidersHorizontal, Trash2, WalletCards, X,
} from 'lucide-react';

const number = (value) => new Intl.NumberFormat('fa-IR').format(value ?? 0);
const dateTime = (value) => new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const sourceLabels = { source_price: 'قیمت از منبع', usd_subscription: 'اشتراک دلاری', fixed_price: 'قیمت ثابت' };
const ruleLabels = { maximum_change_percent: 'سقف تغییر قیمت', minimum_margin_percent: 'حداقل حاشیه سود', fixed_price: 'قیمت ثابت', custom: 'قانون شخصی' };
const nav = [
  ['overview', 'نمای کلی', BarChart3],
  ['account', 'اشتراک و فروشگاه', WalletCards],
  ['sources', 'منابع قیمت', Database],
  ['rules', 'قوانین قیمت‌گذاری', SlidersHorizontal],
  ['reports', 'گزارش اجراها', FileText],
  ['support', 'پشتیبانی', MessageCircle],
];

const planLabels = { demo: 'دمو', month: 'یک‌ماهه', quarter: 'سه‌ماهه', year: 'یک‌ساله' };

export default function CustomerDashboard({ userId, name, phone, initialSources, initialRules, initialRuns, initialMessages, store, subscriptions, loadError }) {
  const [tab, setTab] = useState('overview');
  const [sources, setSources] = useState(initialSources);
  const [rules, setRules] = useState(initialRules);
  const [runs] = useState(initialRuns);
  const [messages, setMessages] = useState(initialMessages);
  const [editingSource,setEditingSource]=useState(null);
  const [editingRule,setEditingRule]=useState(null);
  const [sourceForm, setSourceForm] = useState(false);
  const [ruleForm, setRuleForm] = useState(false);
  const [source, setSource] = useState({ name: '', url: '', pricing_model: 'source_price', currency: 'IRR', subscription_amount: '' });
  const [rule, setRule] = useState({ name: '', rule_type: 'maximum_change_percent', value: '' });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [notice, setNotice] = useState(loadError ? 'بخشی از اطلاعات حساب بارگذاری نشد. صفحه را تازه‌سازی کن؛ تنظیمات جدید همچنان قابل ثبت‌اند.' : '');
  const db = useMemo(() => createClient(), []);
  const currentNav = nav.find((item) => item[0] === tab);
  const lastRun = runs[0];
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = setInterval(update, 60_000);
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, []);
  useEffect(() => {
    const refresh = async () => { if (document.visibilityState !== 'visible') return; const { data } = await db.from('support_messages').select('*').eq('user_id', userId).order('created_at', { ascending: true }).limit(500); if (data) setMessages(data.filter(m=>!m.hidden_by?.includes(userId))); };
    const timer = setInterval(refresh, 5000); document.addEventListener('visibilitychange', refresh); return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [db, userId]);
  const activeSubscriptions = subscriptions.filter((item) => daysRemainingIran(item.expires_at, now) > 0);

  async function addSource(event) {
    event.preventDefault(); setBusy(true); setNotice('');
    const payload = { user_id: userId, ...source, subscription_amount: source.subscription_amount ? Number(source.subscription_amount) : null, currency: source.pricing_model === 'usd_subscription' ? 'USD' : source.currency };
    const { data, error } = await (editingSource ? db.from('apu_sources').update(payload).eq('id',editingSource).eq('user_id',userId).is('deleted_at',null) : db.from('apu_sources').insert(payload)).select().single();
    if (error) setNotice('ذخیرهٔ منبع انجام نشد. دوباره تلاش کن.');
    else { setSources(items=>editingSource?items.map(i=>i.id===editingSource?data:i):[data,...items]); setEditingSource(null); setSource({ name: '', url: '', pricing_model: 'source_price', currency: 'IRR', subscription_amount: '' }); setSourceForm(false); setNotice('منبع قیمت ذخیره شد.'); }
    setBusy(false);
  }

  async function addRule(event) {
    event.preventDefault(); setBusy(true); setNotice('');
    const { data, error } = await (editingRule ? db.from('apu_rules').update(rule).eq('id',editingRule).eq('user_id',userId).is('deleted_at',null) : db.from('apu_rules').insert({user_id:userId,...rule})).select().single();
    if (error) setNotice('ذخیرهٔ قانون انجام نشد. دوباره تلاش کن.');
    else { setRules(items=>editingRule?items.map(i=>i.id===editingRule?data:i):[data,...items]); setEditingRule(null); setRule({ name: '', rule_type: 'maximum_change_percent', value: '' }); setRuleForm(false); setNotice('قانون اختصاصی ذخیره شد.'); }
    setBusy(false);
  }

  async function toggleRecord(table, item, setter, collection) {
    setBusy(true); setNotice('');
    const { data, error } = await db.from(table).update({ enabled: !item.enabled }).eq('id', item.id).eq('user_id', userId).is('deleted_at', null).select().single();
    if (error) setNotice('تغییر وضعیت ذخیره نشد.');
    else setter(collection.map((row) => row.id === item.id ? data : row));
    setBusy(false);
  }

  async function removeRecord(table, id, setter, collection) {
    if (!window.confirm('این مورد حذف شود؟')) return;
    setBusy(true); setNotice('');
    const { error } = await db.from(table).update({ deleted_at: new Date().toISOString(), enabled: false }).eq('id', id).eq('user_id', userId).select('id').single();
    if (error) setNotice('حذف انجام نشد.'); else setter(collection.filter((row) => row.id !== id));
    setBusy(false);
  }

  async function messageAction(item,action,body) {
    const {error}=await db.rpc('support_message_action',{p_kind:'customer',p_id:item.id,p_action:action,p_body:body});
    if(error)throw error;
    const result=await db.from('support_messages').select('*').eq('user_id',userId).order('created_at',{ascending:true}).limit(500);
    if(result.error)throw result.error;setMessages(result.data.filter(m=>!m.hidden_by?.includes(userId)));
  }

  async function sendMessage(event) {
    event.preventDefault();
    const body = message.trim(); if (!body || busy) return;
    setBusy(true); setNotice('');
    const { data, error } = await db.from('support_messages').insert({ user_id: userId, sender_id: userId, sender_role: 'customer', body }).select().single();
    if (error) setNotice('پیام ارسال نشد. کمی بعد دوباره تلاش کن.');
    else { setMessages((items) => [...items, data]); setMessage(''); }
    setBusy(false);
  }

  return <main className="customer-shell">
    <aside className="customer-sidebar">
      <Link href="/" className="brand"><img className="brand-mark" src="/delsa-mark.svg" alt=""/><span className="brand-word">DELSA</span></Link>
      <div className="customer-account"><span className="customer-avatar">{name?.trim()?.[0] || 'د'}</span><span><strong>{name}</strong><small dir="ltr">{phone}</small></span></div>
      <span className="customer-nav-title">پنل مشتری</span>
      <nav>{nav.map(([id, label, Icon]) => <button key={id} onClick={() => { setTab(id); setNotice(''); }} className={tab === id ? 'active' : ''}><Icon size={19}/>{label}{id === 'support' && <span className="nav-new">پیام</span>}</button>)}</nav>
      <div className="customer-sidebar-bottom"><div className="customer-help"><ShieldCheck size={19}/><strong>اطلاعات حساب امن است</strong><p>داده‌ها فقط برای حساب خودت در دسترس هستند.</p></div><form action="/auth/signout" method="post"><button className="customer-logout"><LogOut size={18}/>خروج از حساب</button></form><Link href="/" className="customer-back"><ArrowLeft size={17}/>بازگشت به سایت</Link></div>
    </aside>
    <section className="customer-content">
      <header className="customer-topbar"><div><span>فضای مشتری</span><span className="customer-divider">/</span><strong>{currentNav?.[1]}</strong></div><span className="customer-status"><i/> {activeSubscriptions.length ? 'اشتراک فعال' : 'APU در حال راه‌اندازی'}</span></header>
      <div className="customer-main">
        {notice && <div className="customer-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="بستن"><X size={17}/></button></div>}
        <div className="customer-heading"><div><span className="customer-eyebrow">DELSA · APU</span><h1>{tab === 'overview' ? `سلام ${name?.split(' ')[0] || 'خوش آمدی'}،` : currentNav?.[1]}</h1><p>{tab === 'overview' ? 'منابع، قوانین و وضعیت به‌روزرسانی قیمت‌ها را از یک جا مدیریت کن.' : tab === 'account' ? 'محصولات فعال، زمان اشتراک و اطلاعات فروشگاهت را ببین.' : tab === 'sources' ? 'منابع قیمت و اشتراک‌های ریالی یا دلاری را تعریف کن.' : tab === 'rules' ? 'محدودیت‌ها و منطق اختصاصی قیمت‌گذاری خودت را ثبت کن.' : tab === 'reports' ? 'تاریخچهٔ اجرای واقعی APU و نتیجهٔ هر اجرا در این بخش ثبت می‌شود.' : 'پیامت را برای تیم پشتیبانی بفرست و پاسخ را همین‌جا پیگیری کن.'}</p></div>{(tab === 'sources' || tab === 'rules') && <button className="customer-primary" onClick={() => {if(tab==='sources'){setEditingSource(null);setSource({name:'',url:'',pricing_model:'source_price',currency:'IRR',subscription_amount:''});setSourceForm(!sourceForm)}else{setEditingRule(null);setRule({name:'',rule_type:'maximum_change_percent',value:''});setRuleForm(!ruleForm)}}}><Plus size={18}/>{tab === 'sources' ? 'افزودن منبع' : 'افزودن قانون'}</button>}</div>

        {tab === 'overview' && <>
          <section className="customer-hero"><div className="customer-hero-icon"><RefreshCw size={24}/></div><div><span>Automated Price Updates</span><h2>قیمت‌گذاری، با قواعد خودت</h2><p>منابع، اشتراک دلاری و قانون‌های اختصاصی را آماده کن تا با فعال‌شدن موتور APU، اجرای قیمت‌گذاری بر اساس تنظیمات تو انجام شود.</p></div><span className="customer-coming">در حال آماده‌سازی</span></section>
          <div className="customer-stats"><article><WalletCards/><span>اشتراک‌های فعال</span><strong>{number(activeSubscriptions.length)}</strong><small>{activeSubscriptions.length ? `${number(Math.min(...activeSubscriptions.map((item) => daysRemainingIran(item.expires_at, now))))} روز تا نزدیک‌ترین پایان` : 'هنوز اشتراکی فعال نیست'}</small></article><article><Database/><span>منابع ثبت‌شده</span><strong>{number(sources.length)}</strong><small>{number(sources.filter((item) => item.enabled).length)} منبع فعال</small></article><article><SlidersHorizontal/><span>قوانین قیمت‌گذاری</span><strong>{number(rules.length)}</strong><small>{number(rules.filter((item) => item.enabled).length)} قانون فعال</small></article><article><BarChart3/><span>اجراهای ثبت‌شده</span><strong>{number(runs.length)}</strong><small>{lastRun ? `آخرین اجرا ${dateTime(lastRun.created_at)}` : 'هنوز اجرایی ثبت نشده'}</small></article></div>
          <div className="customer-overview-grid"><section className="customer-panel"><div className="customer-panel-title"><div><span>شروع سریع</span><h2>آماده‌سازی APU</h2></div><span className="customer-step-count">۱ / ۳</span></div><div className="customer-step"><span className={sources.length ? 'step-done' : ''}>{sources.length ? <Check size={17}/> : '۱'}</span><div><strong>منابع قیمت را تعریف کن</strong><p>لینک منبع، قیمت دلاری یا قیمت ثابت را ثبت کن.</p></div></div><div className="customer-step"><span className={rules.length ? 'step-done' : ''}>{rules.length ? <Check size={17}/> : '۲'}</span><div><strong>قواعد خودت را اضافه کن</strong><p>سقف تغییر، حد سود یا منطق دلخواهت را مشخص کن.</p></div></div><div className="customer-step"><span>۳</span><div><strong>اتصال فروشگاه و اجرای APU</strong><p>پس از آماده‌شدن اتصال، گزارش اجراها در همین داشبورد می‌آید.</p></div></div><div className="customer-quick-actions"><button onClick={() => setTab('sources')}><Database size={17}/>مدیریت منابع</button><button onClick={() => setTab('rules')}><SlidersHorizontal size={17}/>تنظیم قوانین</button></div></section>
          <section className="customer-panel"><div className="customer-panel-title"><div><span>گزارش واقعی</span><h2>آخرین اجرا</h2></div><button className="customer-inline-link" onClick={() => setTab('reports')}>همه گزارش‌ها <ArrowLeft size={15}/></button></div>{lastRun ? <div className="customer-last-run"><span className="run-check"><Check size={19}/></span><div><strong>{lastRun.status === 'completed' ? 'اجرا با موفقیت انجام شد' : lastRun.status === 'partial' ? 'اجرا با نتیجهٔ ناقص' : 'اجرا با خطا روبه‌رو شد'}</strong><p>{dateTime(lastRun.created_at)}</p><small>{number(lastRun.updated_count)} به‌روزرسانی · {number(lastRun.failed_count)} خطا</small></div></div> : <div className="customer-empty"><Clock3 size={27}/><strong>هنوز اجرایی ثبت نشده</strong><p>با فعال‌شدن APU و اتصال منابع، گزارش‌ها اینجا ذخیره می‌شوند.</p></div>}</section></div>
        </>}

        {tab === 'account' && <div className="customer-overview-grid customer-account-grid"><section className="customer-panel"><div className="customer-panel-title"><div><span>محصولات من</span><h2>اشتراک‌ها</h2></div><span className="customer-count">{number(subscriptions.length)} مورد</span></div>{subscriptions.length ? subscriptions.map((item) => { const remaining = daysRemainingIran(item.expires_at, now); return <article className="customer-subscription" key={item.id}><strong>{item.store_products?.name || 'محصول'}</strong><span>{planLabels[item.plan] || item.plan}</span><b className={remaining ? '' : 'expired'}>{remaining ? `${number(remaining)} روز باقی‌مانده` : 'پایان‌یافته'}</b><small>پایان اشتراک: {dateTime(item.expires_at)}</small></article>; }) : <div className="customer-empty"><WalletCards size={27}/><strong>اشتراکی ثبت نشده</strong><p>محصولات خریداری‌شده پس از فعال‌سازی مدیر اینجا نمایش داده می‌شوند.</p></div>}</section><section className="customer-panel"><div className="customer-panel-title"><div><span>اطلاعات ثبت‌شده</span><h2>فروشگاه من</h2></div></div>{store ? <div className="customer-store"><strong>{store.name || 'فروشگاه بدون نام'}</strong>{store.website && <a href={store.website} target="_blank" rel="noopener noreferrer" dir="ltr">{store.website}<ExternalLink size={15}/></a>}<p>تنظیمات اتصال فروشگاه توسط تیم دلسا تکمیل می‌شود.</p></div> : <div className="customer-empty"><Database size={27}/><strong>فروشگاهی ثبت نشده</strong><p>پس از ثبت اطلاعات فروشگاه توسط مدیر، جزئیات آن اینجا نشان داده می‌شود.</p></div>}</section></div>}

        {tab === 'sources' && <section className="customer-panel customer-list-panel"><div className="customer-panel-title"><div><span>ورودی‌های APU</span><h2>منابع و اشتراک‌ها</h2></div><span className="customer-count">{number(sources.length)} مورد</span></div>{sourceForm && <form className="customer-form" onSubmit={addSource}><label>نام منبع یا سرویس<input required maxLength={100} value={source.name} onChange={(e) => setSource({...source, name: e.target.value})} placeholder="مثلاً اشتراک ابزار تحلیل"/></label><label>لینک منبع (اختیاری)<input dir="ltr" type="url" value={source.url} onChange={(e) => setSource({...source, url: e.target.value})} placeholder="https://example.com"/></label><label>مدل قیمت‌گذاری<select value={source.pricing_model} onChange={(e) => setSource({...source, pricing_model: e.target.value, currency: e.target.value === 'usd_subscription' ? 'USD' : source.currency})}><option value="source_price">دریافت قیمت از منبع</option><option value="usd_subscription">اشتراک با قیمت دلاری</option><option value="fixed_price">قیمت ثابت</option></select></label>{source.pricing_model === 'usd_subscription' ? <label>هزینهٔ اشتراک / دلار<input required type="number" min="0" step="0.01" value={source.subscription_amount} onChange={(e) => setSource({...source, subscription_amount: e.target.value})} placeholder="مثلاً 19.99"/></label> : source.pricing_model === 'fixed_price' ? <><label>واحد پول<select value={source.currency} onChange={(e) => setSource({...source, currency: e.target.value})}><option value="IRR">تومان / ریال</option><option value="USD">دلار</option></select></label><label>قیمت ثابت{source.currency === 'USD' ? ' / دلار' : ' / تومان'}<input type="number" min="0" step="0.01" value={source.subscription_amount} onChange={(e) => setSource({...source, subscription_amount: e.target.value})} placeholder="مبلغ"/></label></> : null}<div className="customer-form-actions"><button className="customer-primary" disabled={busy}><Check size={17}/>{busy ? 'در حال ذخیره…' : editingSource ? 'ذخیره تغییرات منبع' : 'ذخیرهٔ منبع'}</button><button type="button" className="customer-cancel" onClick={() => {setSourceForm(false);setEditingSource(null);setSource({name:'',url:'',pricing_model:'source_price',currency:'IRR',subscription_amount:''});}}>انصراف</button></div></form>}{sources.length ? <div className="customer-records">{sources.map((item) => <article className="customer-record" key={item.id}><span className="record-icon"><Database size={19}/></span><div className="record-main"><strong>{item.name}</strong><span>{sourceLabels[item.pricing_model]} · {item.currency === 'USD' ? 'دلار آمریکا' : 'تومان'}</span>{item.url && <a href={item.url} dir="ltr" target="_blank" rel="noreferrer">{item.url}<ExternalLink size={13}/></a>}</div><div className="record-value">{item.subscription_amount != null ? <><strong>{number(item.subscription_amount)}</strong><small>{item.currency}</small></> : <small>قیمت از منبع خوانده می‌شود</small>}</div><button disabled={busy} className={'record-toggle ' + (item.enabled ? 'on' : '')} onClick={() => toggleRecord('apu_sources', item, setSources, sources)} aria-label={item.enabled ? 'غیرفعال کردن' : 'فعال کردن'}>{item.enabled ? 'فعال' : 'غیرفعال'}</button><button className="record-toggle" disabled={busy} onClick={()=>{setEditingSource(item.id);setSource({name:item.name,url:item.url||'',pricing_model:item.pricing_model,currency:item.currency,subscription_amount:item.subscription_amount??''});setSourceForm(true);}}>ویرایش</button><button className="record-delete" disabled={busy} onClick={() => removeRecord('apu_sources', item.id, setSources, sources)} aria-label="حذف منبع"><Trash2 size={17}/></button></article>)}</div> : <div className="customer-empty"><Database size={28}/><strong>هنوز منبعی اضافه نکرده‌ای</strong><p>منبع قیمت یا اشتراک دلاری‌ات را ثبت کن تا تنظیماتت آماده باشد.</p></div>}<p className="customer-footnote"><CircleHelp size={15}/> تنظیمات ذخیره می‌شوند؛ محاسبه و اعمال واقعی قیمت پس از فعال‌سازی موتور APU انجام خواهد شد.</p></section>}

        {tab === 'rules' && <section className="customer-panel customer-list-panel"><div className="customer-panel-title"><div><span>منطق کسب‌وکار تو</span><h2>قوانین اختصاصی قیمت</h2></div><span className="customer-count">{number(rules.length)} مورد</span></div>{ruleForm && <form className="customer-form" onSubmit={addRule}><label>عنوان قانون<input required maxLength={100} value={rule.name} onChange={(e) => setRule({...rule, name: e.target.value})} placeholder="مثلاً سقف افزایش قیمت"/></label><label>نوع قانون<select value={rule.rule_type} onChange={(e) => setRule({...rule, rule_type: e.target.value})}><option value="maximum_change_percent">سقف تغییر قیمت (%)</option><option value="minimum_margin_percent">حداقل حاشیه سود (%)</option><option value="fixed_price">قیمت ثابت</option><option value="custom">قانون شخصی / توضیح دلخواه</option></select></label><label className="customer-rule-value">مقدار یا شرح قانون<textarea required maxLength={500} rows={3} value={rule.value} onChange={(e) => setRule({...rule, value: e.target.value})} placeholder={rule.rule_type === 'custom' ? 'قانونت را دقیق بنویس تا هنگام فعال‌سازی APU بررسی شود.' : 'مثلاً ۱۵'}/></label><div className="customer-form-actions"><button className="customer-primary" disabled={busy}><Check size={17}/>{busy ? 'در حال ذخیره…' : editingRule ? 'ذخیره تغییرات قانون' : 'ذخیرهٔ قانون'}</button><button type="button" className="customer-cancel" onClick={() => {setRuleForm(false);setEditingRule(null);setRule({name:'',rule_type:'maximum_change_percent',value:''});}}>انصراف</button></div></form>}{rules.length ? <div className="customer-records">{rules.map((item) => <article className="customer-record" key={item.id}><span className="record-icon"><SlidersHorizontal size={19}/></span><div className="record-main"><strong>{item.name}</strong><span>{ruleLabels[item.rule_type] || 'قانون شخصی'}</span></div><div className="record-value"><strong>{item.value}</strong></div><button disabled={busy} className={'record-toggle ' + (item.enabled ? 'on' : '')} onClick={() => toggleRecord('apu_rules', item, setRules, rules)} aria-label={item.enabled ? 'غیرفعال کردن' : 'فعال کردن'}>{item.enabled ? 'فعال' : 'غیرفعال'}</button><button className="record-toggle" disabled={busy} onClick={()=>{setEditingRule(item.id);setRule({name:item.name,rule_type:item.rule_type,value:item.value});setRuleForm(true);}}>ویرایش</button><button className="record-delete" disabled={busy} onClick={() => removeRecord('apu_rules', item.id, setRules, rules)} aria-label="حذف قانون"><Trash2 size={17}/></button></article>)}</div> : <div className="customer-empty"><SlidersHorizontal size={28}/><strong>قانونی ثبت نشده</strong><p>محدودیت‌ها یا قانون‌های شخصی قیمت‌گذاری را به زبان خودت تعریف کن.</p></div>}<p className="customer-footnote"><CircleHelp size={15}/> قانون‌ها ذخیره می‌شوند اما تا فعال‌شدن موتور APU روی قیمت‌ها اعمال نمی‌شوند.</p></section>}

        {tab === 'reports' && <section className="customer-panel customer-list-panel"><div className="customer-panel-title"><div><span>تاریخچهٔ فعالیت</span><h2>گزارش اجراهای APU</h2></div><span className="customer-count">{number(runs.length)} اجرا</span></div>{runs.length ? <div className="customer-run-table"><div className="run-table-head"><span>زمان اجرا</span><span>وضعیت</span><span>به‌روزرسانی</span><span>خطا</span></div>{runs.map((run) => <article key={run.id}><span>{dateTime(run.created_at)}</span><span className={'run-status ' + run.status}>{run.status === 'completed' ? 'موفق' : run.status === 'partial' ? 'ناقص' : 'ناموفق'}</span><strong>{number(run.updated_count)}</strong><span>{number(run.failed_count)}</span>{run.summary && <p>{run.summary}</p>}</article>)}</div> : <div className="customer-empty"><BarChart3 size={29}/><strong>هنوز گزارشی وجود ندارد</strong><p>گزارش‌ها با اجرای واقعی موتور APU اضافه می‌شوند. اینجا عدد نمونه نمایش داده نمی‌شود.</p></div>}<p className="customer-footnote"><Clock3 size={15}/> گزارش‌ها بعد از راه‌اندازی اتصال فروشگاه و موتور APU در همین صفحه قابل پیگیری خواهند بود.</p></section>}

        {tab === 'support' && <section className="customer-panel customer-support-panel"><div className="customer-panel-title"><div><span>ارتباط مستقیم</span><h2>گفت‌وگو با پشتیبانی</h2></div><span className="support-online"><i/> پشتیبانی دلسا</span></div><div className="support-chat"><div className="support-welcome"><span><MessageCircle size={21}/></span><div><strong>سلام، چطور می‌تونیم کمکت کنیم؟</strong><p>پیامت برای تیم پشتیبانی ارسال می‌شود و پاسخ همین‌جا نمایش داده می‌شود.</p></div></div>{messages.length ? messages.filter(item=>!item.hidden_by?.includes(userId)).map((item) => <article key={item.id} className={'support-message ' + (item.sender_role === 'customer' ? 'mine' : 'theirs')}><span>{item.sender_role === 'customer' ? 'شما' : 'پشتیبانی دلسا'}</span><ChatMessage message={item} canEdit={item.sender_id===userId} canDeleteAll={item.sender_id===userId} onAction={(action,value)=>messageAction(item,action,value)}/><time>{dateTime(item.created_at)}</time></article>) : <div className="support-empty">هنوز پیامی ثبت نشده. هر زمان خواستی پیام بده.</div>}</div><form className="support-compose" onSubmit={sendMessage}><textarea rows={2} maxLength={4000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="پیامت را اینجا بنویس…" aria-label="متن پیام"/><button className="customer-primary" disabled={!message.trim() || busy}><Send size={17}/>{busy ? 'در حال ارسال…' : 'ارسال پیام'}</button></form></section>}
        <footer className="customer-footer"><span>DELSA · فرصت بیشتر برای کارهای مهم‌تر</span><span>اطلاعات حساب تو با دسترسی اختصاصی ذخیره می‌شود.</span></footer>
      </div>
    </section>
  </main>;
}

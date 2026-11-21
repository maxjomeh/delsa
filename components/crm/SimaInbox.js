'use client';
import {useI18n} from '../i18n/I18nProvider';
import {tx} from '../../lib/i18n/config';
import {useEffect, useMemo, useState} from 'react';
import {buildConversations, inboxTotals} from '../../lib/crm/inbox.mjs';
import styles from './SimaInbox.module.css';
import {socialProfile} from '../../lib/crm/social-profile.mjs';

const channels = {
  manual: tx('ثبت دستی'), instagram: tx('اینستاگرام'), whatsapp: tx('واتساپ'),
  telegram: tx('تلگرام'), bale: tx('بله'), eitaa: tx('ایتا'), rubika: tx('روبیکا'),
  soroush: tx('سروش'), website: tx('وب‌سایت'), phone: tx('تماس')
};

export default function SimaInbox({db, userId, customers, interactions, informationQueue, onRefresh}) {
 const {t,intl}=useI18n();
 const stamp=value=>Number.isFinite(Date.parse(value||''))?new Date(value).toLocaleString(intl,{timeZone:'Asia/Tehran'}):t('زمان نامشخص'),
  pretty=n=>Number(n||0).toLocaleString(intl);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [source, setSource] = useState('all');
  const [activeId, setActiveId] = useState('');
  const [mode, setMode] = useState('inbound');
  const [channel, setChannel] = useState('manual');
  const [body, setBody] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const all = useMemo(() => buildConversations(customers, interactions), [customers, interactions]);
  const rows = useMemo(() => buildConversations(customers, interactions, {query: search, status, channel: source}), [customers, interactions, search, status, source]);
  const totals = useMemo(() => inboxTotals(all), [all]);
  const selected = rows.find(r => r.id === activeId) || rows[0] || null;
  const question = selected && informationQueue.find(q => q.customer_id === selected.id);
  const outgoing = mode !== 'inbound';

  // Selecting a different thread should start with its actual recorded channel.
  useEffect(() => {
    setChannel(selected && channels[selected.last.channel] ? selected.last.channel : 'manual');
  }, [selected?.id, selected?.last.channel]);

  async function save(event) {
    event.preventDefault();
    if (!selected || !body.trim() || busy) return;
    if (outgoing && !confirmed) {
      setError(t('برای ثبت تعامل ارسالی، تأیید کنید که پیام یا پیشنهاد قبلاً خارج از سیما ارسال شده است.'));
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const value = {
        tenant_id: userId,
        customer_id: selected.id,
        channel,
        direction: outgoing ? 'outbound' : 'inbound',
        kind: mode === 'offer' ? 'offer' : 'message',
        body: body.trim(),
        occurred_at: new Date().toISOString()
      };
      const result = await db.from('crm_interactions').insert(value).select('id').single();
      if (result.error) throw result.error;
      setBody('');
      setConfirmed(false);
      setNotice(t('تعامل در سیما ثبت شد. این کار هیچ پیامی به شبکه اجتماعی ارسال نکرد.'));
      await onRefresh();
    } catch {
      setError(t('ثبت تعامل انجام نشد. اشتراک، دسترسی و اتصال دیتابیس را بررسی کنید.'));
    } finally {
      setBusy(false);
    }
  }

  function choose(row) {
    setActiveId(row.id);
    setChannel(channels[row.last.channel] ? row.last.channel : 'manual');
    setMode('inbound');
    setBody('');
    setConfirmed(false);
    setError('');
    setNotice('');
  }

  return <section className={styles.wrap} aria-label={t('صندوق مکالمات سیما')}>
    <div className={styles.intro}>
      <div>
        <span className={styles.eyebrow}>SIMA / UNIFIED INBOX</span>
        <h3>{t('صندوق مکالمات یکپارچه')}</h3>
        <p>{t('تاریخچه تعاملات ثبت‌شده از کانال‌های مختلف، بر اساس پرونده هر مشتری.')}</p>
      </div>
      <div className={styles.metrics}>
        <div><strong>{pretty(totals.conversations)}</strong><small>{t('گفت‌وگو')}</small></div>
        <div><strong>{pretty(totals.needsResponse)}</strong><small>{t('نیازمند پاسخ احتمالی')}</small></div>
        <div><strong>{pretty(totals.loggedMessages)}</strong><small>{t('تعامل ثبت‌شده')}</small></div>
      </div>
    </div>
    <p className={styles.disclaimer}>{t('وضعیت «نیازمند پاسخ» از آخرین تعامل ثبت‌شده محاسبه می‌شود؛ رسید خواندن، ارسال واقعی یا تمام مکالمات اینستاگرام را نشان نمی‌دهد. تاریخچهٔ نمایشی ممکن است محدود به بازهٔ بارگذاری‌شده باشد؛ برای بررسی پیام‌های قدیمی‌تر از بخش تاریخچه و پروفایل مشتری استفاده کنید.')}</p>
    <div className={styles.filters}>
      <input aria-label={t('جست‌وجو در مکالمات')} placeholder={t('نام، اینستاگرام، شماره یا متن مکالمه…')} value={search} onChange={e => setSearch(e.target.value)} />
      <select aria-label={t('وضعیت پاسخ')} value={status} onChange={e => setStatus(e.target.value)}>
        <option value="all">{t('همه وضعیت‌ها')}</option>
        <option value="needs_response">{t('نیازمند پاسخ احتمالی')}</option>
        <option value="answered">{t('آخرین تعامل ثبت‌شده ارسالی')}</option>
      </select>
      <select aria-label={t('کانال ارتباط')} value={source} onChange={e => setSource(e.target.value)}>
        <option value="all">{t('همه کانال‌ها')}</option>
        {Object.entries(channels).map(([key, name]) => <option key={key} value={key}>{t(name)}</option>)}
      </select>
    </div>
    <div className={styles.layout}>
      <div className={styles.threads} aria-label={t('گفت‌وگوهای مشتریان')}>
        {rows.map(row => <button key={row.id} type="button" className={styles.thread + (selected?.id === row.id ? ' ' + styles.selected : '')} onClick={() => choose(row)} aria-current={selected?.id === row.id ? 'true' : undefined}>
          <span className={styles.avatar}>{socialProfile(row.customer).avatar?<img src={socialProfile(row.customer).avatar} alt="" loading="lazy" referrerPolicy="no-referrer" style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'inherit'}}/>:(row.customer.name||t('م')).slice(0,1)}</span>
          <span className={styles.threadBody}>
            <span className={styles.threadTop}><strong>{row.customer.name}</strong><small>{stamp(row.last.occurred_at)}</small></span>
            <span className={styles.preview}>{row.last.body}</span>
            <span className={styles.threadMeta}>{t(channels[row.last.channel]) || row.last.channel} · {pretty(row.count)} {t('تعامل')}</span>
            {row.needsResponse && <em>{t('نیازمند بررسی پاسخ')}</em>}
          </span>
        </button>)}
        {!rows.length && <div className={styles.empty}>{t('مکالمه‌ای با این فیلتر پیدا نشد. تعاملات ثبت‌شده در بخش «گفت‌وگو و تعاملات» اینجا نمایش داده خواهند شد.')}</div>}
      </div>
      <div className={styles.detail}>
        {!selected ? <div className={styles.empty}>{t('برای مشاهده مکالمه، یک مشتری را انتخاب کنید.')}</div> : <>
          <header className={styles.customer}>
            <div><h4>{selected.customer.name}</h4><span>{selected.customer.instagram ? '@' + selected.customer.instagram : selected.customer.phone || t('شناسه تماس ثبت نشده')} · {selected.customer.city || t('شهر نامشخص')}</span></div>
            <strong>{selected.needsResponse ? t('پاسخ نیازمند بررسی') : t('آخرین تعامل ثبت شده')}</strong>
          </header>
          <div className={styles.timeline} role="log" aria-label={t('تاریخچه تعاملات')}>
            {selected.messages.map(m => <article key={m.id} className={styles.bubble + (m.direction === 'outbound' ? ' ' + styles.outbound : '')}>
              <div className={styles.bubbleMeta}><strong>{m.direction === 'outbound' ? t('ارسالیِ ثبت‌شده') : t('دریافتی')}</strong><span>{t(channels[m.channel]) || m.channel} · {m.kind === 'offer' ? t('پیشنهاد') : m.kind === 'call' ? t('تماس') : m.kind === 'note' ? t('یادداشت') : t('پیام')}</span></div>
              <p>{m.body}</p><time>{stamp(m.occurred_at)}</time>
            </article>)}
          </div>
          {question && <div className={styles.question}><strong>{t('پرسش مناسب تعامل بعدی')}</strong><p>{question.question}</p><small>{t('تنها پس از پاسخ به درخواست اصلی مشتری، در صورت مناسب‌بودن شرایط مطرح شود.')}</small></div>}
          <form className={styles.compose} onSubmit={save}>
            <h4>{t('ثبت تعامل در پرونده')}</h4>
            <div className={styles.composeFilters}>
              <label>{t('نوع ثبت')} <select value={mode} onChange={e => {setMode(e.target.value); setConfirmed(false);}}>
                  <option value="inbound">{t('پیام دریافتی')}</option>
                  <option value="outbound">{t('پیام ارسال‌شده قبلی')}</option>
                  <option value="offer">{t('پیشنهاد ارسال‌شده قبلی')}</option>
                </select>
              </label>
              <label>{t('کانال')} <select value={channel} onChange={e => setChannel(e.target.value)}>
                  {Object.entries(channels).map(([key, name]) => <option key={key} value={key}>{t(name)}</option>)}
                </select>
              </label>
            </div>
            <label>{t('متن تعامل')} <textarea required rows={3} maxLength={8000} value={body} onChange={e => setBody(e.target.value)} placeholder={t('متن پیام یا شرح پیشنهاد ثبت‌شده…')} />
            </label>
            {outgoing && <label className={styles.confirm}><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} required/>{t('تأیید می‌کنم این پیام قبلاً در کانال انتخاب‌شده ارسال شده است؛ سیما فقط سابقه را ثبت می‌کند.')}</label>}
            <button disabled={busy || !body.trim() || (outgoing && !confirmed)} type="submit">{busy ? t('در حال ثبت…') : t('ثبت در پرونده')}</button>
            {error && <p role="alert" className={styles.error}>{error}</p>}
            {notice && <p role="status" className={styles.notice}>{notice}</p>}
            <small>{t('این فرم فقط تعاملِ انجام‌شده را ثبت می‌کند. برای ارسال واقعی انسانی از بخش «نیازمند پاسخ شما» استفاده کنید؛ ارسال خودکار AI غیرفعال است.')}</small>
          </form>
        </>}
      </div>
    </div>
  </section>;
}

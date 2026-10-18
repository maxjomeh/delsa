'use client';
import {useEffect, useMemo, useState} from 'react';
import {buildConversations, inboxTotals} from '../../lib/crm/inbox.mjs';
import styles from './SimaInbox.module.css';

const channels = {
  manual: 'ثبت دستی', instagram: 'اینستاگرام', whatsapp: 'واتساپ',
  telegram: 'تلگرام', bale: 'بله', eitaa: 'ایتا', rubika: 'روبیکا',
  soroush: 'سروش', website: 'وب‌سایت', phone: 'تماس'
};
const stamp = value => {
  if (!Number.isFinite(Date.parse(value || ''))) return 'زمان نامشخص';
  return new Date(value).toLocaleString('fa-IR', {timeZone: 'Asia/Tehran'});
};
const pretty = n => Number(n || 0).toLocaleString('fa-IR');

export default function SimaInbox({db, userId, customers, interactions, informationQueue, onRefresh}) {
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
      setError('برای ثبت تعامل ارسالی، تأیید کنید که پیام یا پیشنهاد قبلاً خارج از سیما ارسال شده است.');
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
      setNotice('تعامل در سیما ثبت شد. این کار هیچ پیامی به شبکه اجتماعی ارسال نکرد.');
      await onRefresh();
    } catch {
      setError('ثبت تعامل انجام نشد. اشتراک، دسترسی و اتصال دیتابیس را بررسی کنید.');
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

  return <section className={styles.wrap} aria-label="صندوق مکالمات سیما">
    <div className={styles.intro}>
      <div>
        <span className={styles.eyebrow}>SIMA / UNIFIED INBOX</span>
        <h3>صندوق مکالمات یکپارچه</h3>
        <p>تاریخچه تعاملات ثبت‌شده از کانال‌های مختلف، بر اساس پرونده هر مشتری.</p>
      </div>
      <div className={styles.metrics}>
        <div><strong>{pretty(totals.conversations)}</strong><small>گفت‌وگو</small></div>
        <div><strong>{pretty(totals.needsResponse)}</strong><small>نیازمند پاسخ احتمالی</small></div>
        <div><strong>{pretty(totals.loggedMessages)}</strong><small>تعامل ثبت‌شده</small></div>
      </div>
    </div>
    <p className={styles.disclaimer}>وضعیت «نیازمند پاسخ» از آخرین تعامل ثبت‌شده محاسبه می‌شود؛ رسید خواندن، ارسال واقعی یا تمام مکالمات اینستاگرام را نشان نمی‌دهد. این نما حداکثر ۵۰۰ تعامل و ۵۰۰ پرونده اخیر بارگذاری‌شده را پوشش می‌دهد.</p>
    <div className={styles.filters}>
      <input aria-label="جست‌وجو در مکالمات" placeholder="نام، اینستاگرام، شماره یا متن مکالمه…" value={search} onChange={e => setSearch(e.target.value)} />
      <select aria-label="وضعیت پاسخ" value={status} onChange={e => setStatus(e.target.value)}>
        <option value="all">همه وضعیت‌ها</option>
        <option value="needs_response">نیازمند پاسخ احتمالی</option>
        <option value="answered">آخرین تعامل ثبت‌شده ارسالی</option>
      </select>
      <select aria-label="کانال ارتباط" value={source} onChange={e => setSource(e.target.value)}>
        <option value="all">همه کانال‌ها</option>
        {Object.entries(channels).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
      </select>
    </div>
    <div className={styles.layout}>
      <div className={styles.threads} aria-label="گفت‌وگوهای مشتریان">
        {rows.map(row => <button key={row.id} type="button" className={styles.thread + (selected?.id === row.id ? ' ' + styles.selected : '')} onClick={() => choose(row)} aria-current={selected?.id === row.id ? 'true' : undefined}>
          <span className={styles.avatar}>{(row.customer.name || 'م').slice(0, 1)}</span>
          <span className={styles.threadBody}>
            <span className={styles.threadTop}><strong>{row.customer.name}</strong><small>{stamp(row.last.occurred_at)}</small></span>
            <span className={styles.preview}>{row.last.body}</span>
            <span className={styles.threadMeta}>{channels[row.last.channel] || row.last.channel} · {pretty(row.count)} تعامل</span>
            {row.needsResponse && <em>نیازمند بررسی پاسخ</em>}
          </span>
        </button>)}
        {!rows.length && <div className={styles.empty}>مکالمه‌ای با این فیلتر پیدا نشد. تعاملات ثبت‌شده در بخش «گفت‌وگو و تعاملات» اینجا نمایش داده خواهند شد.</div>}
      </div>
      <div className={styles.detail}>
        {!selected ? <div className={styles.empty}>برای مشاهده مکالمه، یک مشتری را انتخاب کنید.</div> : <>
          <header className={styles.customer}>
            <div><h4>{selected.customer.name}</h4><span>{selected.customer.instagram ? '@' + selected.customer.instagram : selected.customer.phone || 'شناسه تماس ثبت نشده'} · {selected.customer.city || 'شهر نامشخص'}</span></div>
            <strong>{selected.needsResponse ? 'پاسخ نیازمند بررسی' : 'آخرین تعامل ثبت شده'}</strong>
          </header>
          <div className={styles.timeline} role="log" aria-label="تاریخچه تعاملات">
            {selected.messages.map(m => <article key={m.id} className={styles.bubble + (m.direction === 'outbound' ? ' ' + styles.outbound : '')}>
              <div className={styles.bubbleMeta}><strong>{m.direction === 'outbound' ? 'ارسالیِ ثبت‌شده' : 'دریافتی'}</strong><span>{channels[m.channel] || m.channel} · {m.kind === 'offer' ? 'پیشنهاد' : m.kind === 'call' ? 'تماس' : m.kind === 'note' ? 'یادداشت' : 'پیام'}</span></div>
              <p>{m.body}</p><time>{stamp(m.occurred_at)}</time>
            </article>)}
          </div>
          {question && <div className={styles.question}><strong>پرسش مناسب تعامل بعدی</strong><p>{question.question}</p><small>تنها پس از پاسخ به درخواست اصلی مشتری، در صورت مناسب‌بودن شرایط مطرح شود.</small></div>}
          <form className={styles.compose} onSubmit={save}>
            <h4>ثبت تعامل در پرونده</h4>
            <div className={styles.composeFilters}>
              <label>نوع ثبت
                <select value={mode} onChange={e => {setMode(e.target.value); setConfirmed(false);}}>
                  <option value="inbound">پیام دریافتی</option>
                  <option value="outbound">پیام ارسال‌شده قبلی</option>
                  <option value="offer">پیشنهاد ارسال‌شده قبلی</option>
                </select>
              </label>
              <label>کانال
                <select value={channel} onChange={e => setChannel(e.target.value)}>
                  {Object.entries(channels).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
                </select>
              </label>
            </div>
            <label>متن تعامل
              <textarea required rows={3} maxLength={8000} value={body} onChange={e => setBody(e.target.value)} placeholder="متن پیام یا شرح پیشنهاد ثبت‌شده…" />
            </label>
            {outgoing && <label className={styles.confirm}><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} required/>تأیید می‌کنم این پیام قبلاً در کانال انتخاب‌شده ارسال شده است؛ سیما فقط سابقه را ثبت می‌کند.</label>}
            <button disabled={busy || !body.trim() || (outgoing && !confirmed)} type="submit">{busy ? 'در حال ثبت…' : 'ثبت در پرونده'}</button>
            {error && <p role="alert" className={styles.error}>{error}</p>}
            {notice && <p role="status" className={styles.notice}>{notice}</p>}
            <small>ارسال خودکار پیام هنوز فعال نیست. ثبت پیشنهاد ارسالی می‌تواند طبق تنظیمات مشتری، پیگیری جدید بسازد.</small>
          </form>
        </>}
      </div>
    </div>
  </section>;
}

"use client";

import { useEffect, useState } from "react";

const blank = { customerId: "", platform: "", username: "", password: "" };function customerPhone(customer) {
 const value = customer.phone || String(customer.email || '').match(/^phone-(\d+)@delsa\.invalid$/i)?.[1] || '';
 const digits = String(value).replace(/\D/g, '');
 if (digits.startsWith('98') && digits.length === 12) return '0' + digits.slice(2);
 if (digits.length === 10 && digits.startsWith('9')) return '0' + digits;
 return digits;
}
function customerLabel(customer) { return customer.full_name || customer.fullName || customerPhone(customer) || customer.email || customer.id; }

export default function PlatformCredentialsAdmin() {
  const [customers, setCustomers] = useState([]);
  const [credentials, setCredentials] = useState([]);  const [form, setForm] = useState(blank);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [activeCustomer, setActiveCustomer] = useState(0);
  const [revealed, setRevealed] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setError("");
    try {
      const response = await fetch("/api/admin/platform-credentials", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "بارگذاری اطلاعات انجام نشد.");
      setCustomers(data.customers || []);
      setCredentials(data.credentials || []);
    } catch (err) { setError(err.message || "ارتباط با سرور برقرار نشد."); }
  }
  useEffect(() => { load(); }, []);  const visible = credentials.filter((item) => (item.customer_id || item.customerId) === form.customerId);
  const customerQueryText = customerQuery.trim().toLocaleLowerCase();
  const customerQueryDigits = customerQuery.replace(/\D/g, '');
  const suggestions = customers.filter((customer) => {
    const phone = customerPhone(customer);
    const fields = [customerLabel(customer), phone, customer.email || ''].map(value => String(value).toLocaleLowerCase());
    return !customerQueryText || fields.some(value => value.includes(customerQueryText)) || (customerQueryDigits && phone.replace(/\D/g, '').includes(customerQueryDigits));
  }).slice(0, 8);
  function chooseCustomer(customer) {
    setForm(current => ({ ...current, customerId: customer.id }));
    setCustomerQuery(customerLabel(customer));
    setCustomerOpen(false);
    setActiveCustomer(0);
  }

  async function add(event) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/platform-credentials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ذخیره اطلاعات انجام نشد.");
      setForm((current) => ({ ...blank, customerId: current.customerId }));
      setNotice("دسترسی مشتری با موفقیت ذخیره شد."); await load();
    } catch (err) { setError(err.message || "ذخیره اطلاعات انجام نشد."); }
    finally { setBusy(false); }
  }
  async function reveal(id) {
    setError("");
    if (revealed[id]) { setRevealed((old) => { const next = { ...old }; delete next[id]; return next; }); return; }
    try {
      const response = await fetch("/api/admin/platform-credentials", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ action: "reveal", id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "نمایش رمز عبور ممکن نشد.");
      setRevealed((old) => ({ ...old, [id]: data.password }));
    } catch (err) { setError(err.message || "نمایش رمز عبور ممکن نشد."); }
  }
  async function remove(id) {
    if (!window.confirm("این دسترسی حذف شود؟")) return;
    setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/platform-credentials?id=" + encodeURIComponent(id), { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "حذف دسترسی انجام نشد.");
      setRevealed((old) => { const next = { ...old }; delete next[id]; return next; });
      setNotice("دسترسی حذف شد."); await load();
    } catch (err) { setError(err.message || "حذف دسترسی انجام نشد."); }
  }

  return <section className="credential-section" dir="rtl" aria-labelledby="credential-title">
    <div className="credential-heading"><div><span className="credential-eyebrow">مدیریت اطلاعات اتصال</span><h2 id="credential-title">دسترسی‌های مشتری</h2><p>اطلاعات ورود هر مشتری را برای پلتفرم‌های موردنیازش ثبت و مدیریت کنید.</p></div><span className="credential-count">{credentials.length} دسترسی</span></div>
    {error && <p className="credential-message is-error" role="alert">{error}</p>}{notice && <p className="credential-message is-success" role="status">{notice}</p>}
    <form className="credential-form" onSubmit={add}>
      <label className="credential-field credential-customer"><span>مشتری</span><div className="credential-customer-combo"><input required role="combobox" aria-autocomplete="list" aria-expanded={customerOpen} aria-controls="customer-suggestions" autoComplete="off" value={customerQuery} placeholder="نام یا شماره تماس مشتری را بنویسید" onFocus={() => setCustomerOpen(true)} onBlur={() => setCustomerOpen(false)} onChange={(event) => { setCustomerQuery(event.target.value); setCustomerOpen(true); setActiveCustomer(0); setForm(current => ({ ...current, customerId: "" })); }} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setActiveCustomer(index => Math.min(index + 1, suggestions.length - 1)); } else if (event.key === "ArrowUp") { event.preventDefault(); setActiveCustomer(index => Math.max(0, index - 1)); } else if (event.key === "Enter" && customerOpen && suggestions[activeCustomer]) { event.preventDefault(); chooseCustomer(suggestions[activeCustomer]); } else if (event.key === "Escape") setCustomerOpen(false); }} />{customerOpen && <div id="customer-suggestions" className="credential-customer-suggestions" role="listbox">{suggestions.length ? suggestions.map((customer, index) => <button type="button" role="option" aria-selected={form.customerId === customer.id} className={index === activeCustomer ? "active" : ""} key={customer.id} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseCustomer(customer)}><strong>{customerLabel(customer)}</strong><small dir="ltr">{customerPhone(customer) || customer.email}</small></button>) : <span className="credential-customer-no-results">مشتری‌ای با این مشخصات پیدا نشد.</span>}</div>}</div></label>
      <label className="credential-field"><span>نام پلتفرم</span><input required value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} placeholder="مثلاً ترب" autoComplete="off" /></label>
      <label className="credential-field"><span>یوزرنیم</span><input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="نام کاربری مشتری" autoComplete="off" /></label>
      <label className="credential-field"><span>پسورد</span><div className="credential-password-input"><input required type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="رمز عبور" autoComplete="new-password" /><button type="button" onClick={() => setShowPassword((v) => !v)}>{showPassword ? "پنهان" : "نمایش"}</button></div></label>
      <button className="credential-submit" type="submit" disabled={busy || !form.customerId}>{busy ? "در حال ذخیره…" : "افزودن دسترسی"}</button>
    </form>
    <div className="credential-list-heading"><h3>{form.customerId ? "دسترسی‌های مشتری انتخاب‌شده" : "انتخاب مشتری"}</h3>{form.customerId && <span>{visible.length} مورد</span>}</div>
    {!form.customerId ? <div className="credential-empty">برای مشاهده یا افزودن دسترسی، ابتدا مشتری را انتخاب کنید.</div> : visible.length === 0 ? <div className="credential-empty">هنوز دسترسی‌ای برای این مشتری ثبت نشده است.</div> : <div className="credential-list">{visible.map((item) => <article className="credential-item" key={item.id}><div className="credential-platform"><span className="credential-platform-mark">{(item.platform || "?").slice(0, 1)}</span><div><strong>{item.platform}</strong><small>{item.username}</small></div></div><div className="credential-secret"><span className="credential-secret-label">پسورد</span><code>{revealed[item.id] || "••••••••••"}</code></div><div className="credential-actions"><button type="button" onClick={() => reveal(item.id)}>{revealed[item.id] ? "پنهان‌کردن" : "نمایش پسورد"}</button><button type="button" className="credential-delete" onClick={() => remove(item.id)}>حذف</button></div></article>)}</div>}
    <p className="credential-security-note">پسوردها رمزگذاری‌شده ذخیره می‌شوند و فقط مدیر می‌تواند آن‌ها را نمایش دهد.</p>
  </section>;
}

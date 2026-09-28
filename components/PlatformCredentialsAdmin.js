"use client";

import { useEffect, useState } from "react";

const blank = { customerId: "", platform: "", username: "", password: "" };

export default function PlatformCredentialsAdmin() {
  const [customers, setCustomers] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [form, setForm] = useState(blank);
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
  useEffect(() => { load(); }, []);
  const visible = credentials.filter((item) => item.customerId === form.customerId);

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
      <label className="credential-field credential-customer"><span>مشتری</span><select required value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}><option value="">انتخاب مشتری</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.fullName || c.phone || c.email || c.id}</option>)}</select></label>
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

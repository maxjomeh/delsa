'use client';
import { useState } from 'react';
import { ImagePlus, Plus } from 'lucide-react';

function priceLabel(value) {
  if (value === null || value === undefined || value === '') return 'قیمت اعلام نشده';
  return new Intl.NumberFormat('fa-IR').format(Number(value)) + ' تومان';
}

export default function StoreProductsAdmin({ products = [], onCreated }) {
  const [form, setForm] = useState({ name: '', description: '', price: '', imageUrl: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setSuccess('');
    try {
      const response = await fetch('/api/admin/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'ثبت محصول انجام نشد.');
      setForm({ name: '', description: '', price: '', imageUrl: '' });
      setSuccess('محصول ذخیره شد و در فروشگاه نمایش داده می‌شود.'); onCreated?.();
    } catch (err) { setError(err.message || 'ثبت محصول انجام نشد.'); }
    finally { setBusy(false); }
  }
  return <div className="admin-products">
    <p className="admin-products-intro">محصول را اینجا ثبت کنید تا در صفحهٔ فروشگاه برای بازدیدکنندگان نمایش داده شود.</p>
    <form className="admin-product-form" onSubmit={submit}>
      <label>نام محصول<input required maxLength={120} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="مثلاً اشتراک APU" /></label>
      <label>توضیحات<textarea maxLength={1200} rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="توضیح کوتاه دربارهٔ محصول" /></label>
      <div className="admin-product-fields"><label>قیمت به تومان<input type="text" inputMode="numeric" dir="ltr" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="اختیاری" /></label><label>پیوند تصویر<input type="url" dir="ltr" value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://…" /></label></div>
      {error && <p className="admin-form-error" role="alert">{error}</p>}{success && <p className="admin-form-success" role="status">{success}</p>}
      <button className="credential-submit" type="submit" disabled={busy}>{busy ? 'در حال ذخیره…' : <><Plus size={17}/> افزودن به فروشگاه</>}</button>
    </form>
    <div className="admin-products-list"><div className="admin-products-list-title"><b>محصول‌های ثبت‌شده</b><span>{products.length.toLocaleString('fa-IR')} محصول</span></div>
      {products.length ? products.map(product => <article className="admin-product-row" key={product.id}><span className="admin-product-thumb">{product.image_url ? <img src={product.image_url} alt=""/> : <ImagePlus size={18}/>}</span><span className="admin-product-row-copy"><b>{product.name}</b><small>{priceLabel(product.price)}</small></span><span className="admin-product-published"><i/> منتشرشده</span></article>) : <p className="empty-users">هنوز محصولی اضافه نشده است.</p>}
    </div>
  </div>;
}

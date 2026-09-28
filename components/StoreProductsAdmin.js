'use client';
import { useRef, useState } from 'react';
import { ImagePlus, Pencil, Plus } from 'lucide-react';

function priceLabel(value) {
  if (value === null || value === undefined || value === '') return 'قیمت اعلام نشده';
  return new Intl.NumberFormat('fa-IR').format(Number(value)) + ' تومان';
}

export default function StoreProductsAdmin({ products = [], onCreated }) {
  const formRef = useRef(null);
  const [form, setForm] = useState({ name: '', description: '', price: '', imageUrl: '' });
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  function edit(product) {
    setEditingId(product.id);
    setForm({ name: product.name || '', description: product.description || '', price: product.price == null ? '' : String(product.price), imageUrl: product.image_url || '' });
    setError(''); setSuccess('');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function cancelEdit() {
    setEditingId(null);
    setForm({ name: '', description: '', price: '', imageUrl: '' });
    setError('');
  }
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setSuccess('');
    try {
      const response = await fetch('/api/admin/products', { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, ...(editingId ? { id: editingId } : {}) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'ذخیرهٔ محصول انجام نشد.');
      setForm({ name: '', description: '', price: '', imageUrl: '' });
      setEditingId(null);
      setSuccess(editingId ? 'تغییرات محصول ذخیره شد و در فروشگاه نمایش داده می‌شود.' : 'محصول ذخیره شد و در فروشگاه نمایش داده می‌شود.'); onCreated?.(Boolean(editingId));
    } catch (err) { setError(err.message || 'ذخیرهٔ محصول انجام نشد.'); }
    finally { setBusy(false); }
  }
  return <div className="admin-products">
    <p className="admin-products-intro">{editingId ? 'اطلاعات محصول را ویرایش و ذخیره کنید.' : 'محصول را اینجا ثبت کنید تا در صفحهٔ فروشگاه برای بازدیدکنندگان نمایش داده شود.'}</p>
    <form ref={formRef} className="admin-product-form" onSubmit={submit}>
      <label>نام محصول<input required maxLength={120} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="مثلاً اشتراک APU" /></label>
      <label>توضیحات<textarea maxLength={1200} rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="توضیح کوتاه دربارهٔ محصول" /></label>
      <div className="admin-product-fields"><label>قیمت به تومان<input type="text" inputMode="numeric" dir="ltr" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="اختیاری" /></label><label>پیوند تصویر<input type="url" dir="ltr" value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://…" /></label></div>
      {error && <p className="admin-form-error" role="alert">{error}</p>}{success && <p className="admin-form-success" role="status">{success}</p>}
      <div className="admin-product-form-actions"><button className="credential-submit" type="submit" disabled={busy}>{busy ? 'در حال ذخیره…' : editingId ? <><Pencil size={17}/> ذخیرهٔ تغییرات</> : <><Plus size={17}/> افزودن به فروشگاه</>}</button>{editingId && <button type="button" disabled={busy} onClick={cancelEdit}>انصراف از ویرایش</button>}</div>
    </form>
    <div className="admin-products-list"><div className="admin-products-list-title"><b>محصول‌های ثبت‌شده</b><span>{products.length.toLocaleString('fa-IR')} محصول</span></div>
      {products.length ? products.map(product => <article className="admin-product-row" key={product.id}><span className="admin-product-thumb">{product.image_url ? <img src={product.image_url} alt=""/> : <ImagePlus size={18}/>}</span><span className="admin-product-row-copy"><b>{product.name}</b><small>{priceLabel(product.price)}</small></span><span className="admin-product-published"><i/> منتشرشده</span><button className="admin-product-edit" type="button" disabled={busy} onClick={() => edit(product)}><Pencil size={14}/> ویرایش</button></article>) : <p className="empty-users">هنوز محصولی اضافه نشده است.</p>}
    </div>
  </div>;
}

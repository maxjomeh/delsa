'use client';
import { useEffect, useState } from 'react';
import { ImagePlus, Pencil, Plus, Archive, RotateCcw } from 'lucide-react';

function priceLabel(value) {
  if (value === null || value === undefined || value === '') return 'قیمت اعلام نشده';
  return new Intl.NumberFormat('fa-IR').format(Number(value)) + ' تومان';
}

export default function StoreProductsAdmin({ editingProduct, onCancelEdit, onSaved }) {
  const [form, setForm] = useState({ name: '', description: '', price: '', imageUrl: '' });
  const editingId = editingProduct?.id || null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  useEffect(() => {
    setForm(editingProduct ? { name: editingProduct.name || '', description: editingProduct.description || '', price: editingProduct.price == null ? '' : String(editingProduct.price), imageUrl: editingProduct.image_url || '' } : { name: '', description: '', price: '', imageUrl: '' });
    setError(''); setSuccess('');
  }, [editingProduct]);
  function cancelEdit() {
    setForm({ name: '', description: '', price: '', imageUrl: '' });
    setError('');
    onCancelEdit?.();
  }
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setSuccess('');
    try {
      const response = await fetch('/api/admin/products', { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, ...(editingId ? { id: editingId } : {}) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'ذخیرهٔ محصول انجام نشد.');
      setForm({ name: '', description: '', price: '', imageUrl: '' });
      setSuccess(editingId ? 'تغییرات محصول ذخیره شد و در فروشگاه نمایش داده می‌شود.' : 'محصول ذخیره شد و در فروشگاه نمایش داده می‌شود.');
      onSaved?.(Boolean(editingId));
    } catch (err) { setError(err.message || 'ذخیرهٔ محصول انجام نشد.'); }
    finally { setBusy(false); }
  }
  return <div className="admin-products">
    <p className="admin-products-intro">{editingId ? 'اطلاعات محصول را ویرایش و ذخیره کنید.' : 'محصول را اینجا ثبت کنید تا در صفحهٔ فروشگاه برای بازدیدکنندگان نمایش داده شود.'}</p>
    <form className="admin-product-form" onSubmit={submit}>
      <label>نام محصول<input required maxLength={120} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="مثلاً اشتراک APU" /></label>
      <label>توضیحات<textarea maxLength={1200} rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="توضیح کوتاه دربارهٔ محصول" /></label>
      <div className="admin-product-fields"><label>قیمت به تومان<input type="text" inputMode="numeric" dir="ltr" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="اختیاری" /></label><label>پیوند تصویر<input type="url" dir="ltr" value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://…" /></label></div>
      {error && <p className="admin-form-error" role="alert">{error}</p>}{success && <p className="admin-form-success" role="status">{success}</p>}
      <div className="admin-product-form-actions"><button className="credential-submit" type="submit" disabled={busy}>{busy ? 'در حال ذخیره…' : editingId ? <><Pencil size={17}/> ذخیرهٔ تغییرات</> : <><Plus size={17}/> افزودن به فروشگاه</>}</button>{editingId && <button type="button" disabled={busy} onClick={cancelEdit}>انصراف از ویرایش</button>}</div>
    </form>
  </div>;
}

export function StoreProductsList({ products = [], onEdit }) {
  const [rows,setRows]=useState(products),[busy,setBusy]=useState(null),[error,setError]=useState('');
  useEffect(()=>setRows(products),[products]);
  async function toggle(product){if(busy||!window.confirm(product.is_published?'محصول از فروشگاه بایگانی شود؟ اشتراک‌های مشتریان حفظ می‌شوند.':'محصول دوباره منتشر شود؟'))return;setBusy(product.id);setError('');try{const response=await fetch('/api/admin/products',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:product.id,isPublished:!product.is_published})});const data=await response.json();if(!response.ok)throw Error(data.error);setRows(items=>items.map(p=>p.id===product.id?data.product:p))}catch(e){setError(e.message||'تغییر وضعیت انجام نشد.')}finally{setBusy(null)}}
  return <div className="admin-products-list"><div className="admin-products-list-title"><b>محصول‌های ثبت‌شده</b><span>{rows.length.toLocaleString('fa-IR')} محصول</span></div>
    {rows.length ? rows.map(product => <article className="admin-product-row" key={product.id}><span className="admin-product-thumb">{product.image_url ? <img src={product.image_url} alt=""/> : <ImagePlus size={18}/>}</span><span className="admin-product-row-copy"><b>{product.name}</b><small>{priceLabel(product.price)}</small></span><span className="admin-product-published">{product.is_published&&<i aria-hidden="true"/>}{product.is_published?'منتشرشده':'بایگانی'}</span><button className="admin-product-edit" type="button" onClick={() => onEdit?.(product)}><Pencil size={14}/> ویرایش</button><button className="admin-product-edit" disabled={Boolean(busy)} onClick={()=>toggle(product)}>{product.is_published?<Archive size={14}/>:<RotateCcw size={14}/>} {product.is_published?'بایگانی':'فعال‌سازی'}</button></article>) : <p className="empty-users">هنوز محصولی اضافه نشده است.</p>}{error&&<p role="alert" className="admin-form-error">{error}</p>}
  </div>;
}

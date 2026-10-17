'use client';
import {useState} from 'react';
import {Plus,Upload,Save,Sparkles,Trash2} from 'lucide-react';
import {productStates,blankVariant,attributeText,parseAttributes,productSlug} from '../lib/builder-commerce';
import BuilderTaxonomy from './BuilderTaxonomy';
import styles from './SiteBuilder.module.css';
export default function BuilderProductForm({form,setForm,busy,access,submit,attributeInput,setAttributeInput,tagInput,setTagInput,imageInput,setImageInput,uploadImages,variantChange,generateSku,terms,addTerm,deleteTerm,onClose}){
 const [advanced,setAdvanced]=useState(false);
 const field=(key,value)=>setForm(f=>({...f,[key]:value}));
 return <form className={styles.card} onSubmit={submit}><div className={styles.sectionHeading}><div><h2>{form.id?'ویرایش محصول':'افزودن محصول'}</h2><p>نام، قیمت و موجودی را وارد کنید؛ آدرس محصول خودکار ساخته می‌شود.</p></div></div><fieldset disabled={busy||!access} className={styles.productFieldset}>
 <section className={styles.productSection}><h3>۱. اطلاعات اصلی</h3><div className={styles.formGrid}>
 <label>نام محصول<input autoFocus required minLength={2} maxLength={180} placeholder="مثلاً کفش ورزشی مردانه" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value,slug:f.autoSlug?productSlug(e.target.value):f.slug}))}/></label>
 <label>وضعیت انتشار<select value={form.status} onChange={e=>field('status',e.target.value)}>{Object.entries(productStates).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
 <BuilderTaxonomy label="دسته‌بندی" value={form.category} items={terms.filter(t=>t.kind==='category'&&t.active).map(t=>t.name)} onChange={v=>field('category',v)} onAdd={name=>addTerm('category',name)} onDelete={name=>deleteTerm('category',name)} disabled={busy||!access}/>
 <BuilderTaxonomy label="برند" value={form.brand} items={terms.filter(t=>t.kind==='brand'&&t.active).map(t=>t.name)} onChange={v=>field('brand',v)} onAdd={name=>addTerm('brand',name)} onDelete={name=>deleteTerm('brand',name)} disabled={busy||!access}/>
 <label>توضیح کوتاه<textarea maxLength={500} rows={2} placeholder="مهم‌ترین نکته‌های محصول برای خریدار" value={form.summary} onChange={e=>field('summary',e.target.value)}/></label>
 </div></section>
 <section className={styles.productSection}><h3>۲. قیمت و موجودی</h3><label>نوع محصول<select value={form.kind} onChange={e=>{if(form.variants.length>1&&!window.confirm('با تبدیل به محصول ساده، فقط تنوع اول فعال می‌ماند. ادامه می‌دهید؟'))return;setForm({...form,kind:e.target.value,variants:e.target.value==='simple'?[{...form.variants[0],label:'پیش‌فرض'}]:form.variants})}}><option value="simple">ساده</option><option value="variable">چند مدل؛ رنگ، اندازه یا مدل</option></select></label>
 {form.variants.map((v,i)=><section key={v.id||i} className={styles.variantCard}><div className={styles.formGrid}>{form.kind==='variable'&&<><label>نام تنوع<input required maxLength={180} value={v.label} onChange={e=>variantChange(i,{label:e.target.value})} placeholder="مشکی / سایز بزرگ"/></label><label>ویژگی‌های تنوع؛ «نام: مقدار»<textarea rows={2} value={v.attributeInput??attributeText(v.attributes)} onChange={e=>variantChange(i,{attributeInput:e.target.value,attributes:parseAttributes(e.target.value)})}/></label></>}
 <label>قیمت / تومان<input required type="number" min="0" max="1000000000000" step="1" placeholder="مثلاً 250000" value={v.price} onChange={e=>variantChange(i,{price:e.target.value})}/></label>
 <label>موجودی<input required type="number" min="0" max="100000000" disabled={!v.manage_stock} value={v.stock} onChange={e=>variantChange(i,{stock:e.target.value})}/></label>
 <label>شناسهٔ محصول (SKU)<div className={styles.inlineField}><input dir="ltr" maxLength={80} placeholder="خالی بماند، خودکار ساخته می‌شود" value={v.sku} onChange={e=>variantChange(i,{sku:e.target.value})}/><button type="button" title="ساخت شناسهٔ ترتیبی" aria-label={'ساخت خودکار شناسه '+(i+1)} onClick={()=>generateSku(i)}><Sparkles size={18}/></button></div></label>
 <label>قیمت با تخفیف / تومان<input type="number" min="0" max={v.price||0} step="1" placeholder="اختیاری" value={v.sale_price} onChange={e=>variantChange(i,{sale_price:e.target.value})}/></label>
 <label className={styles.checkLabel}><input type="checkbox" checked={v.manage_stock} onChange={e=>variantChange(i,{manage_stock:e.target.checked})}/>کنترل موجودی</label>
 </div>{form.kind==='variable'&&form.variants.length>1&&<button type="button" onClick={()=>setForm({...form,variants:form.variants.filter((_,j)=>j!==i)})}><Trash2 size={14}/>حذف تنوع از فروش</button>}</section>)}
 {form.kind==='variable'&&<button type="button" disabled={form.variants.length>=100} onClick={()=>setForm({...form,variants:[...form.variants,{...blankVariant(),label:''}]})}><Plus size={16}/>افزودن مدل / تنوع</button>}</section>
 <section className={styles.productSection}><h3>۳. عکس محصول</h3><label className={styles.fileButton}><Upload size={18}/>انتخاب عکس از دستگاه<input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={uploadImages}/></label><small>حداکثر ۱۲ عکس؛ هر عکس تا ۵ مگابایت</small><div className={styles.imageStrip}>{imageInput.split('\n').filter(x=>/^https:\/\//i.test(x)).slice(0,12).map((src,i)=><img key={i} src={src} alt={'تصویر محصول '+(i+1)} referrerPolicy="no-referrer"/>)}</div></section>
 <button type="button" aria-expanded={advanced} onClick={()=>setAdvanced(v=>!v)}>{advanced?'بستن جزئیات بیشتر':'جزئیات بیشتر؛ توضیحات، برچسب‌ها و آدرس'}</button>{advanced&&<section className={styles.productSection}><div className={styles.formGrid}>
 <label>آدرس محصول<input required dir="ltr" pattern="[a-z0-9][a-z0-9-]{1,79}" maxLength={80} value={form.slug} onChange={e=>setForm({...form,slug:e.target.value.toLowerCase(),autoSlug:false})}/><small>برای محصول جدید خودکار و یکتا ساخته می‌شود.</small></label>
 <label>توضیحات کامل<textarea maxLength={12000} rows={5} value={form.description} onChange={e=>field('description',e.target.value)}/></label>
 <label>ویژگی‌ها؛ هر خط «نام: مقدار»<textarea rows={4} value={attributeInput} onChange={e=>setAttributeInput(e.target.value)} placeholder={'جنس: فولاد\nکشور سازنده: ایران'}/></label>
 <label>برچسب‌ها؛ با ویرگول جدا کنید<input value={tagInput} maxLength={500} onChange={e=>setTagInput(e.target.value)} placeholder="مثلاً: جدید، تابستانی، هدیه، پرفروش"/></label>
 <label>وزن / گرم<input type="number" min="0" max="10000000" value={form.weight_grams} onChange={e=>field('weight_grams',e.target.value)}/></label><label className={styles.checkLabel}><input type="checkbox" checked={form.featured} onChange={e=>field('featured',e.target.checked)}/>محصول ویژه</label>
 <label>آدرس HTTPS تصاویر؛ هر تصویر در یک خط<textarea dir="ltr" rows={3} value={imageInput} onChange={e=>setImageInput(e.target.value)}/></label>
 </div></section>}</fieldset><div className={styles.productSaveBar}><button className={styles.primary} disabled={!access||busy}><Save size={16}/>{busy?'در حال ذخیره…':form.status==='published'?'ذخیره و انتشار محصول':'ذخیره محصول'}</button><button type="button" disabled={busy} onClick={onClose}>بستن فرم</button></div></form>
}

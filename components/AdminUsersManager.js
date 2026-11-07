'use client';
import {useEffect,useMemo,useState} from 'react';
import {Search,Trash2,UsersRound} from 'lucide-react';
import {useRouter} from 'next/navigation';
import CustomerDetails from './CustomerDetails';
import {daysRemainingIran} from '../lib/subscription-days';

const protectedCustomerIds=new Set(['e63e575f-6215-435a-8bbe-fdc3a199c54d']);
function formatPhone(user){
 const phone=String(user.phone||user.email?.match(/^phone-(\d+)@delsa\.invalid$/i)?.[1]||'');
 const digits=phone.replace(/\D/g,'');
 if(digits.startsWith('98')&&digits.length===12)return '0'+digits.slice(2);
 return phone||'—';
}
export default function AdminUsersManager({users,products,subscriptions,apuChanges={},onSubscriptionsChanged}){
 const router=useRouter(),[query,setQuery]=useState(''),[marked,setMarked]=useState([]),[expanded,setExpanded]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[now,setNow]=useState(Date.now());
 useEffect(()=>{const handle=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(handle)},[]);
 useEffect(()=>setMarked(old=>old.filter(id=>users.some(u=>u.id===id&&u.role!=='admin'&&!protectedCustomerIds.has(id)))),[users]);
 const filtered=useMemo(()=>users.filter(u=>(u.full_name+' '+formatPhone(u)).toLowerCase().includes(query.trim().toLowerCase())),[users,query]);
 const deletable=filtered.filter(u=>u.role!=='admin'&&!protectedCustomerIds.has(u.id));
 async function remove(ids){
  if(busy||!ids.length)return;
  const accounts=users.filter(u=>ids.includes(u.id));
  if(accounts.length!==ids.length||accounts.some(u=>u.role==='admin'||protectedCustomerIds.has(u.id))){setError('این حساب محافظت شده است و نمی‌توان آن را حذف کرد.');return;}
  const label=accounts.length===1?'«'+(accounts[0].full_name||'مشتری')+'»':accounts.length.toLocaleString('fa-IR')+' مشتری';
  if(!window.confirm('حساب '+label+' از دسترسی خارج و از فهرست پنهان شود؟ اطلاعات وابسته برای حفاظت از داده‌ها آرشیو می‌شوند.'))return;
  setBusy(true);setError('');setNotice('');
  let completed=0;const failures=[];
  try{
   for(const account of accounts){
    try{
     const response=await fetch('/api/admin/customer-details',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete-customer',customerId:account.id,confirm:'DELETE_CUSTOMER'})});
     const result=await response.json();
     if(!response.ok)throw Error(result.error||'حذف انجام نشد');
     completed++;
    }catch(e){failures.push(account.full_name+': '+e.message)}
   }
   if(completed)setNotice(completed.toLocaleString('fa-IR')+' حساب غیرفعال و از فهرست خارج شد.');
   if(failures.length)setError(failures.join(' | '));
   setMarked([]);router.refresh();
  }finally{setBusy(false)}
 }
 return <div className="admin-user-manager">
  <div className="admin-cleanup-bar">
   <label className="admin-cleanup-filter"><Search size={16}/><input value={query} type="search" onChange={e=>setQuery(e.target.value)} placeholder="جست‌وجوی نام یا موبایل"/></label>
   <label><input type="checkbox" checked={deletable.length>0&&deletable.every(u=>marked.includes(u.id))} onChange={e=>setMarked(e.target.checked?deletable.map(u=>u.id):[])}/> انتخاب همه مشتریان نمایش‌داده‌شده</label>
   <span>{marked.length.toLocaleString('fa-IR')} انتخاب</span>
   <button className="admin-cleanup-danger" type="button" disabled={busy||!marked.length} onClick={()=>remove(marked)}><Trash2 size={15}/> حذف انتخاب‌شده‌ها</button>
  </div>
  {error&&<p className="admin-form-error" role="alert">{error}</p>}
  {notice&&<p className="admin-form-success" role="status">{notice}</p>}
  <div className="users-table">
   <div className="users-row users-head"><span>کاربر</span><span>شماره</span><span>نقش</span><span>اشتراک فعال</span><span>عملیات</span></div>
   {filtered.map(u=>{
    const protectedUser=u.role==='admin'||protectedCustomerIds.has(u.id),selected=marked.includes(u.id);
    const active=subscriptions.filter(a=>a.customer_id===u.id&&new Date(a.expires_at).getTime()>now);
    return <div className="admin-user-entry" key={u.id}>
     <div className="users-row">
      <span className="admin-cleanup-identity"><input disabled={protectedUser||busy} type="checkbox" checked={selected} aria-label={'انتخاب '+u.full_name} onChange={e=>setMarked(old=>e.target.checked?[...old,u.id]:old.filter(id=>id!==u.id))}/><UsersRound size={16}/><b>{u.full_name||'بدون نام'}</b>{apuChanges[u.id]>0&&<small className="apu-new">{apuChanges[u.id]} تغییر جدید</small>}</span>
      <span dir="ltr">{formatPhone(u)}</span>
      <span className={u.role==='admin'?'role-admin':'role-user'}>{u.role==='admin'?'مدیر':protectedUser?'محافظت‌شده':'مشتری'}</span>
      <span className="users-subscriptions">{active.length?active.map(a=><small key={a.id}>{products.find(p=>p.id===a.product_id)?.name||'محصول'} · {daysRemainingIran(a.expires_at,now).toLocaleString('fa-IR')} روز</small>):'—'}</span>
      <span className="admin-cleanup-row-actions"><button type="button" onClick={()=>setExpanded(expanded===u.id?null:u.id)}>{expanded===u.id?'بستن':'جزئیات'}</button><button type="button" className="admin-cleanup-danger" disabled={protectedUser||busy} onClick={()=>remove([u.id])} aria-label={'حذف '+u.full_name}><Trash2 size={15}/></button></span>
     </div>
     {expanded===u.id&&<CustomerDetails customer={u} products={products} onSubscriptionsChanged={rows=>onSubscriptionsChanged?.(u.id,rows)} onChanged={()=>router.refresh()}/>}
    </div>;
   })}
   {!filtered.length&&<p className="empty-users">کاربری پیدا نشد.</p>}
  </div>
 </div>;
}

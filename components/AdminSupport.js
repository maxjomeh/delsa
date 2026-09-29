'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {Send,RefreshCw} from 'lucide-react';
import {createClient} from '../lib/supabase/client';
const formatTime=value=>new Intl.DateTimeFormat('fa-IR',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Tehran'}).format(new Date(value));
export default function AdminSupport(){
 const db=useMemo(()=>createClient(),[]),[threads,setThreads]=useState([]),[selected,setSelected]=useState(null),[body,setBody]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const load=useCallback(async()=>{const [customer,visitors,visitorMessages,profiles]=await Promise.all([
 db.from('support_messages').select('id,user_id,sender_role,body,created_at').order('created_at',{ascending:false}).limit(500),
 db.from('visitor_chats').select('id,phone,created_at,updated_at').order('updated_at',{ascending:false}).limit(100),
 db.from('visitor_chat_messages').select('id,chat_id,sender_role,body,created_at').order('created_at',{ascending:false}).limit(500),
 db.from('profiles').select('id,full_name,phone').limit(500)]);
 if([customer,visitors,visitorMessages,profiles].some(r=>r.error)){setError('دریافت گفت‌وگوها انجام نشد.');return;}
 const names=new Map(profiles.data.map(p=>[p.id,p]));const map=new Map();
 for(const m of customer.data){const key='customer:'+m.user_id;if(!map.has(key)){const p=names.get(m.user_id);map.set(key,{key,type:'customer',id:m.user_id,title:p?.full_name||'مشتری',phone:p?.phone||'',messages:[]})}map.get(key).messages.push(m)}
 for(const c of visitors.data)map.set('visitor:'+c.id,{key:'visitor:'+c.id,type:'visitor',id:c.id,title:'بازدیدکننده',phone:c.phone||'',messages:[]});
 for(const m of visitorMessages.data){const t=map.get('visitor:'+m.chat_id);if(t)t.messages.push(m)}
 const all=[...map.values()].map(t=>({...t,messages:t.messages.sort((a,b)=>new Date(a.created_at)-new Date(b.created_at))})).sort((a,b)=>new Date(b.messages.at(-1)?.created_at||0)-new Date(a.messages.at(-1)?.created_at||0));setThreads(all);setSelected(current=>current&&all.some(t=>t.key===current)?current:all[0]?.key||null);setError('');},[db]);
 useEffect(()=>{load();const timer=setInterval(()=>{if(document.visibilityState==='visible')load()},5000);return()=>clearInterval(timer)},[load]);
 const active=threads.find(t=>t.key===selected);
 async function reply(e){e.preventDefault();const value=body.trim();if(!value||!active||busy)return;setBusy(true);setError('');const {data:{user},error:authError}=await db.auth.getUser();if(authError||!user){setError('برای پاسخ دوباره وارد حساب مدیر شوید.');setBusy(false);return}const result=active.type==='customer'?await db.from('support_messages').insert({user_id:active.id,sender_id:user.id,sender_role:'admin',body:value}):await db.from('visitor_chat_messages').insert({chat_id:active.id,sender_role:'admin',body:value});if(result.error)setError('پاسخ ثبت نشد. دوباره تلاش کنید.');else{setBody('');await load()}setBusy(false)}
 return <div className="admin-support"><div className="admin-support-top"><p>پیام‌های مشتریان و بازدیدکنندگان هر چند ثانیه تازه می‌شوند.</p><button type="button" onClick={load}><RefreshCw size={15}/> تازه‌سازی</button></div>{error&&<p className="admin-form-error" role="alert">{error}</p>}<div className="admin-support-layout"><div className="admin-support-list">{threads.length?threads.map(t=><button type="button" key={t.key} className={selected===t.key?'active':''} onClick={()=>setSelected(t.key)}><strong>{t.title}{t.type==='visitor'?' · وب‌سایت':''}</strong><small dir="ltr">{t.phone||'شماره ثبت نشده'}</small><span>{t.messages.at(-1)?.body||'هنوز پیامی نیست'}</span></button>):<p>هنوز گفت‌وگویی ثبت نشده است.</p>}</div><div className="admin-support-conversation">{active?<><div className="admin-support-contact"><strong>{active.title}</strong><span dir="ltr">{active.phone||'شماره هنوز دریافت نشده'}</span></div><div className="admin-support-messages">{active.messages.map(m=><article key={m.id} className={m.sender_role==='admin'?'admin-reply':''}><small>{m.sender_role==='admin'?'شما':m.sender_role==='system'?'پیام خودکار':active.title} · {formatTime(m.created_at)}</small><p>{m.body}</p></article>)}</div><form onSubmit={reply}><textarea required maxLength={active.type==='visitor'?2000:4000} rows={2} value={body} onChange={e=>setBody(e.target.value)} placeholder="پاسخ خود را بنویسید…"/><button type="submit" disabled={busy||!body.trim()}><Send size={16}/> ارسال پاسخ</button></form></>:<p>گفت‌وگویی را انتخاب کنید.</p>}</div></div></div>
}

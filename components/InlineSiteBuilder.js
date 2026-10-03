'use client';
import {useEffect,useMemo,useState} from 'react';
import {createClient} from '../lib/supabase/client';
import SiteBuilder from './SiteBuilder';
export default function InlineSiteBuilder({userId,isAdmin=false,owners=[]}){
 const db=useMemo(()=>createClient(),[]),[result,setResult]=useState(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 const ready=Boolean(result);
 useEffect(()=>{if(ready)return;let alive=true;setError('');async function load(){try{
 let query=db.from('builder_sites').select('*').order('created_at',{ascending:false});
 if(!isAdmin)query=query.eq('owner_id',userId).is('deleted_at',null);
 const [sites,access]=await Promise.all([query,db.rpc('has_site_builder_access')]);
 if(sites.error||access.error)throw sites.error||access.error;
 if(alive)setResult({sites:sites.data||[],access:Boolean(access.data)});
 }catch{if(alive)setError('اطلاعات سایت‌ها بارگذاری نشد. دوباره تلاش کنید.')}}load();return()=>{alive=false}},[db,userId,isAdmin,attempt,ready]);
 useEffect(()=>{if(!ready)return;let alive=true,pending=false;
 async function refresh(){if(pending||document.visibilityState==='hidden')return;pending=true;try{const {data,error}=await db.rpc('has_site_builder_access');if(alive&&!error)setResult(previous=>previous.access===Boolean(data)?previous:{...previous,access:Boolean(data)})}catch{}finally{pending=false}}
 refresh();const timer=setInterval(refresh,20000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
 return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh)};
 },[db,ready]);
 if(error)return <div role="alert"><p>{error}</p><button onClick={()=>setAttempt(n=>n+1)}>تلاش دوباره</button></div>;
 if(!result)return <p role="status">در حال بارگذاری سایت‌ها…</p>;
 return <SiteBuilder userId={userId} initialSites={result.sites} access={result.access} embedded isAdmin={isAdmin} owners={owners}/>;
}

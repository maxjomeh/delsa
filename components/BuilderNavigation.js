'use client';
import {useEffect,useRef,useState} from 'react';
import {Menu,X,ChevronDown} from 'lucide-react';
import styles from './SiteBuilder.module.css';
export default function BuilderNavigation({items,value,onChange,disabled=false}){
 const [open,setOpen]=useState(false),trigger=useRef(null);
 useEffect(()=>{if(!open)return;const escape=e=>{if(e.key==='Escape'){setOpen(false);trigger.current?.focus()}};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape)},[open]);
 const current=items.find(x=>x[0]===value)?.[1]||'بخش‌های سایت';
 return <><label className={styles.builderNavSelect}>بخش سایت‌ساز<select aria-label="بخش سایت‌ساز" disabled={disabled} value={value} onChange={e=>onChange(e.target.value)}>{items.map(([id,title])=><option key={id} value={id}>{title}</option>)}</select><ChevronDown size={15} aria-hidden="true"/></label><div className={styles.builderFloatingNav}>{open&&<><button className={styles.builderNavBackdrop} aria-label="بستن فهرست بخش‌ها" onClick={()=>setOpen(false)}/><nav id="builder-mobile-sections" aria-label="فهرست بخش‌های سایت‌ساز">{items.map(([id,title,Icon])=><button key={id} disabled={disabled} aria-current={id===value?'page':undefined} onClick={()=>{onChange(id);setOpen(false)}}>{Icon&&<Icon size={16}/>}<span>{title}</span></button>)}</nav></>}<button ref={trigger} className={styles.builderNavTrigger} aria-expanded={open} aria-controls="builder-mobile-sections" aria-label="فهرست بخش‌های سایت‌ساز" onClick={()=>setOpen(v=>!v)}>{open?<X size={19}/>:<Menu size={19}/>}<span>{current}</span></button></div></>;
}

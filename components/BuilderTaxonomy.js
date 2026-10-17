'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {ChevronDown,Minus,Plus,Check} from 'lucide-react';
import styles from './SiteBuilder.module.css';
export default function BuilderTaxonomy({label,value,items,onChange,onAdd,onDelete,disabled}){
 const [open,setOpen]=useState(false),[adding,setAdding]=useState(false),[name,setName]=useState('');
 const root=useRef(null),trigger=useRef(null),id=useId();
 const options=[...new Set([...items,value].filter(Boolean))];
 useEffect(()=>{if(!open)return;const outside=e=>{if(!root.current?.contains(e.target))setOpen(false)};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside)},[open]);
 useEffect(()=>{if(disabled)setOpen(false)},[disabled]);
 const close=()=>{setOpen(false);trigger.current?.focus()};
 const choose=n=>{onChange(n);close()};
 const add=()=>{if(!name.trim()||disabled)return;onAdd(name.trim()).then(()=>{setName('');setAdding(false);close()}).catch(()=>{})};
 function keys(e){if(e.key==='Escape'&&open){e.preventDefault();e.stopPropagation();close();return}if(!open||!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;e.preventDefault();const buttons=[...root.current.querySelectorAll('[data-taxonomy-list] button:not(:disabled)')];const i=buttons.indexOf(document.activeElement);const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:i<0?(e.key==='ArrowUp'?buttons.length-1:0):e.key==='ArrowDown'?(i+1)%buttons.length:(i-1+buttons.length)%buttons.length;buttons[next]?.focus()}
 return <div ref={root} className={styles.taxonomyField} onKeyDown={keys}><span id={id+'-label'}>{label}</span><button ref={trigger} type="button" disabled={disabled} className={styles.taxonomyTrigger} aria-labelledby={id+'-label '+id+'-value'} aria-expanded={open} aria-controls={id+'-list'} onClick={()=>setOpen(v=>!v)} onKeyDown={e=>{if(!open&&['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();setOpen(true)}}}><span id={id+'-value'}>{value||'انتخاب '+label}</span><ChevronDown size={17}/></button>
 {open&&<div id={id+'-list'} data-taxonomy-list className={styles.taxonomyDropdown} role="group" aria-label={'گزینه‌های '+label}><button type="button" className={styles.taxonomyOption} onClick={()=>choose('')}>بدون {label}</button>{options.map(n=><div key={n} className={styles.taxonomyRow}><button type="button" className={styles.taxonomyOption} aria-pressed={value===n} onClick={()=>choose(n)}><span>{n}</span>{value===n&&<Check size={15}/>}</button><button type="button" className={styles.removeTerm} aria-label={'حذف '+label+' '+n} title={'حذف '+n} onClick={()=>{setOpen(false);onDelete(n)}}><Minus size={16}/></button></div>)}<button type="button" className={styles.taxonomyOption} onClick={()=>{setAdding(true);setOpen(false)}}><Plus size={16}/>افزودن {label} جدید</button></div>}
 {adding&&<div className={styles.inlineField}><input aria-label={label+' جدید'} autoFocus maxLength={120} placeholder={'نام '+label+' جدید'} value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();add()}}}/><button type="button" disabled={disabled||!name.trim()} onClick={add}><Plus size={16}/>افزودن</button><button type="button" onClick={()=>setAdding(false)}>انصراف</button></div>}</div>
}

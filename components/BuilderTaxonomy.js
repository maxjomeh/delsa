'use client';
import {useState} from 'react';
import {Minus,Plus} from 'lucide-react';
import styles from './SiteBuilder.module.css';
export default function BuilderTaxonomy({label,value,items,onChange,onAdd,onDelete,disabled}){
 const [adding,setAdding]=useState(false),[name,setName]=useState('');
 return <div className={styles.taxonomyField}><label>{label}<select disabled={disabled} value={value} onChange={e=>{if(e.target.value==='__new'){setAdding(true);return}onChange(e.target.value)}}><option value="">انتخاب {label}</option>{[...new Set([...items,value].filter(Boolean))].map(n=><option key={n} value={n}>{n}</option>)}<option value="__new">＋ افزودن {label} جدید</option></select></label>{value&&<button type="button" disabled={disabled} className={styles.removeTerm} aria-label={'حذف '+label+' '+value} title={'حذف '+value} onClick={()=>onDelete(value)}><Minus size={16}/></button>}{adding&&<div className={styles.inlineField}><input aria-label={label+' جدید'} autoFocus maxLength={120} placeholder={'نام '+label+' جدید'} value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(name.trim())onAdd(name.trim()).then(()=>{setName('');setAdding(false)}).catch(()=>{})}}}/><button type="button" disabled={disabled||!name.trim()} onClick={()=>onAdd(name.trim()).then(()=>{setName('');setAdding(false)}).catch(()=>{})}><Plus size={16}/>افزودن</button><button type="button" onClick={()=>setAdding(false)}>انصراف</button></div>}</div>
}

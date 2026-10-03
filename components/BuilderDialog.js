'use client';
import {useEffect,useRef} from 'react';
import {X} from 'lucide-react';
import styles from './SiteBuilder.module.css';
export default function BuilderDialog({title,children,onClose}){
 const ref=useRef(null),closeRef=useRef(null);
 useEffect(()=>{const el=ref.current;el.showModal();closeRef.current?.focus();return()=>el.close()},[]);
 return <dialog ref={ref} className={styles.builderDialog} onCancel={e=>{e.preventDefault();onClose()}} onClick={e=>{if(e.target===ref.current)onClose()}}><header><h2>{title}</h2><button type="button" ref={closeRef} onClick={onClose} aria-label="بستن پنجره"><X size={20}/></button></header>{children}</dialog>
}

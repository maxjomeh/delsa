'use client';
import {Plus,Trash2} from 'lucide-react';
import ui from './BuilderVisualEditor.module.css';
const fields={faq:['پرسش','پاسخ'],testimonials:['نظر','نام مشتری','عنوان یا شهر'],stats:['عدد','عنوان'],pricing:['نام طرح','قیمت','توضیح'],steps:['عنوان مرحله','توضیح'],team:['نام','سمت','معرفی'],gallery:['آدرس HTTPS تصویر','توضیح تصویر'],logos:['آدرس HTTPS لوگو','نام برند'],links:['نام لینک','آدرس لینک'],hours:['روز','ساعت'],progress:['عنوان','درصد'],checklist:['مزیت'],features:['ویژگی']};
export default function BuilderElementItems({type,items,onChange}){
 const labels=fields[type];if(!labels)return null;
 function edit(row,column,value){const parts=items[row].split('|');while(parts.length<labels.length)parts.push('');parts[column]=value.replace(/\|/g,'／');onChange(items.map((item,i)=>i===row?parts.slice(0,labels.length).join('|'):item))}
 return <div className={ui.itemEditor}>{items.map((item,row)=><fieldset key={row}><legend>مورد {(row+1).toLocaleString('fa-IR')}</legend>{labels.map((label,column)=><label key={label}>{label}<input aria-label={label+' '+(row+1)} value={item.split('|')[column]||''} maxLength={['gallery','logos','links'].includes(type)&&column===(type==='links'?1:0)?2048:600} inputMode={type==='progress'&&column===1?'numeric':undefined} dir={['gallery','logos','links'].includes(type)&&column===(type==='links'?1:0)?'ltr':undefined} onChange={e=>edit(row,column,e.target.value)}/></label>)}<button type="button" aria-label={'حذف مورد '+(row+1)} onClick={()=>onChange(items.filter((_,i)=>i!==row))}><Trash2 size={13}/>حذف مورد</button></fieldset>)}<button type="button" disabled={items.length>=12} onClick={()=>onChange([...items,Array(labels.length).fill('').join('|')])}><Plus size={14}/>افزودن مورد</button></div>;
}

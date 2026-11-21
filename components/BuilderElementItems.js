'use client';
import {useI18n} from './i18n/I18nProvider';
import {tx} from '../lib/i18n/config';
import {Plus,Trash2} from 'lucide-react';
import ui from './BuilderVisualEditor.module.css';
const fields={faq:[tx('پرسش'),tx('پاسخ')],testimonials:[tx('نظر'),tx('نام مشتری'),tx('عنوان یا شهر')],stats:[tx('عدد'),tx('عنوان')],pricing:[tx('نام طرح'),tx('قیمت'),tx('توضیح')],steps:[tx('عنوان مرحله'),tx('توضیح')],team:[tx('نام'),tx('سمت'),tx('معرفی')],gallery:[tx('آدرس HTTPS تصویر'),tx('توضیح تصویر')],logos:[tx('آدرس HTTPS لوگو'),tx('نام برند')],links:[tx('نام لینک'),tx('آدرس لینک')],hours:[tx('روز'),tx('ساعت')],progress:[tx('عنوان'),tx('درصد')],checklist:[tx('مزیت')],features:[tx('ویژگی')]};
export default function BuilderElementItems({type,items,onChange}){
 const {t,intl}=useI18n();
 const labels=fields[type]?.map(l=>t(l));if(!labels)return null;
 function edit(row,column,value){const parts=items[row].split('|');while(parts.length<labels.length)parts.push('');parts[column]=value.replace(/\|/g,'／');onChange(items.map((item,i)=>i===row?parts.slice(0,labels.length).join('|'):item))}
 return <div className={ui.itemEditor}>{items.map((item,row)=><fieldset key={row}><legend>{t('مورد')} {new Intl.NumberFormat(intl).format(row+1)}</legend>{labels.map((label,column)=><label key={label}>{label}<input aria-label={label+' '+(row+1)} value={item.split('|')[column]||''} maxLength={['gallery','logos','links'].includes(type)&&column===(type==='links'?1:0)?2048:600} inputMode={type==='progress'&&column===1?'numeric':undefined} dir={['gallery','logos','links'].includes(type)&&column===(type==='links'?1:0)?'ltr':undefined} onChange={e=>edit(row,column,e.target.value)}/></label>)}<button type="button" aria-label={t('حذف مورد {n}',{n:row+1})} onClick={()=>onChange(items.filter((_,i)=>i!==row))}><Trash2 size={13}/>{t('حذف مورد')}</button></fieldset>)}<button type="button" disabled={items.length>=12} onClick={()=>onChange([...items,Array(labels.length).fill('').join('|')])}><Plus size={14}/>{t('افزودن مورد')}</button></div>;
}

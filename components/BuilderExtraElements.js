import {safeUrl} from '../lib/site-builder';
import styles from './BuilderExtraElements.module.css';
export const extraElementTypes=['faq','testimonials','stats','pricing','steps','team','gallery','video','quote','checklist','alert','logos','links','hours','progress','table'];
const cells=s=>String(s).split('|').map(x=>x.trim());
const percent=s=>Math.max(0,Math.min(100,Number(String(s||'0').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))||0));
export default function BuilderExtraElements({block:b,preview=false}){
 const rows=b.items.map(cells),intro=<>{b.title&&<h2>{b.title}</h2>}{b.text&&<p>{b.text}</p>}</>;
 const links=rows.map(([label,url])=>({label,url:safeUrl(url)})).filter(x=>x.url);
 if(b.type==='quote')return <figure className={styles.quote}><blockquote>{b.text}</blockquote><figcaption>{b.title}</figcaption></figure>;
 if(b.type==='alert')return <aside className={styles.alert}>{intro}{b.url&&<a href={preview?undefined:safeUrl(b.url)}>{b.button||'بیشتر بدانید'} ↗</a>}</aside>;
 return <div className={styles.element}>{intro}
 {b.type==='faq'&&<div className={styles.faq}>{rows.map(([question,...answer],i)=><details key={i}><summary>{question}</summary><p>{answer.join(' | ')||'پاسخ را در پنل محتوا وارد کنید.'}</p></details>)}</div>}
 {b.type==='testimonials'&&<div className={styles.cards}>{rows.map(([text,name,role],i)=><figure key={i}><span className={styles.mark}>“</span><blockquote>{text}</blockquote><figcaption><strong>{name}</strong><small>{role}</small></figcaption></figure>)}</div>}
 {b.type==='stats'&&<dl className={styles.stats}>{rows.map(([value,label],i)=><div key={i}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
 {b.type==='pricing'&&<div className={styles.cards}>{rows.map(([name,price,...description],i)=><article key={i}><small>طرح {i+1}</small><h3>{name}</h3><strong className={styles.price}>{price}</strong><p>{description.join(' | ')}</p>{b.url&&<a className={styles.linkButton} href={preview?undefined:safeUrl(b.url)}>{b.button||'انتخاب طرح'}</a>}</article>)}</div>}
 {b.type==='steps'&&<ol className={styles.steps}>{rows.map(([title,...text],i)=><li key={i}><span>{(i+1).toLocaleString('fa-IR')}</span><div><h3>{title}</h3><p>{text.join(' | ')}</p></div></li>)}</ol>}
 {b.type==='team'&&<div className={styles.cards}>{rows.map(([name,role,...text],i)=><article key={i}><span className={styles.avatar}>{name?.slice(0,1)}</span><h3>{name}</h3><small>{role}</small><p>{text.join(' | ')}</p></article>)}</div>}
 {['gallery','logos'].includes(b.type)&&<div className={`${styles.gallery} ${b.type==='logos'?styles.logos:''}`}>{rows.filter(([url])=>/^https:\/\//i.test(url)).map(([url,alt],i)=><figure key={i}><img src={url} alt={alt||b.title} loading="lazy" referrerPolicy="no-referrer"/>{alt&&<figcaption>{alt}</figcaption>}</figure>)}{!rows.some(([url])=>/^https:\/\//i.test(url))&&<p className={styles.placeholder}>تصاویر را از پنل محتوا اضافه کنید.</p>}</div>}
 {b.type==='video'&&(b.url&&/^(https:\/\/|\/(?!\/))/i.test(b.url)?<video className={styles.video} src={b.url} poster={b.image||undefined} controls preload="none" playsInline aria-label={b.title}/>:<p className={styles.placeholder}>لینک مستقیم ویدیو را از پنل محتوا وارد کنید.</p>)}
 {b.type==='checklist'&&<ul className={styles.checklist}>{b.items.map((item,i)=><li key={i}><span aria-hidden="true">✓</span>{item}</li>)}</ul>}
 {b.type==='links'&&<div className={styles.links}>{links.map(({label,url},i)=><a key={i} href={preview?undefined:url}>{label}<span aria-hidden="true">↗</span></a>)}</div>}
 {b.type==='hours'&&<dl className={styles.hours}>{rows.map(([day,...hours],i)=><div key={i}><dt>{day}</dt><dd>{hours.join(' | ')}</dd></div>)}</dl>}
 {b.type==='progress'&&<div className={styles.progress}>{rows.map(([label,value],i)=><label key={i}><span>{label}<strong>{percent(value).toLocaleString('fa-IR')}٪</strong></span><progress max="100" value={percent(value)} aria-label={label}/></label>)}</div>}
 {b.type==='table'&&rows.length>0&&<div className={styles.tableWrap}><table><thead><tr>{rows[0].slice(0,6).map((v,i)=><th key={i} scope="col">{v}</th>)}</tr></thead><tbody>{rows.slice(1).map((row,i)=><tr key={i}>{rows[0].slice(0,6).map((_,j)=><td key={j}>{row[j]||'—'}</td>)}</tr>)}</tbody></table></div>}
 </div>;
}

import Link from 'next/link';
import {normalizeDocument} from '../lib/site-builder';
import styles from './SiteBuilder.module.css';
export default function BuilderSiteView({name,document,pageSlug='',base='',preview=false,onNavigate}){const doc=normalizeDocument(document),page=doc.pages.find(p=>p.slug===pageSlug)||doc.pages[0];return <div className={`${styles.website} ${styles[doc.template]||''}`} style={{'--site-accent':doc.color}}><header className={styles.siteHeader}><strong>{name}</strong><nav aria-label="صفحات سایت">{doc.pages.map(p=>preview?<button key={p.id} onClick={()=>onNavigate?.(p.id)} aria-current={p.slug===pageSlug?'page':undefined}>{p.title}</button>:<Link key={p.id} href={`${base}${p.slug?'/'+p.slug:''}`} aria-current={p.slug===pageSlug?'page':undefined}>{p.title}</Link>)}</nav></header><main>{page?.blocks.map(b=><section key={b.id} id={b.type==='contact'?'contact':undefined} className={`${styles.siteBlock} ${styles[b.type]}`}>
{b.type==='hero'&&<><span className={styles.siteBadge}>به {name} خوش آمدید</span><h1>{b.title}</h1><p>{b.text}</p>{b.url&&<a className={styles.siteButton} href={preview?undefined:b.url}>{b.button||'بیشتر بدانید'} ↗</a>}</>}
{b.type==='text'&&<><h2>{b.title}</h2><p>{b.text}</p></>}
{b.type==='features'&&<><h2>{b.title}</h2><p>{b.text}</p><div className={styles.featureGrid}>{b.items.map((item,i)=><article key={i}><span>۰{i+1}</span><h3>{item}</h3></article>)}</div></>}
{b.type==='contact'&&<><h2>{b.title}</h2><p>{b.text}</p>{b.url&&<a className={styles.siteButton} href={preview?undefined:b.url}>{b.button||'تماس با ما'}</a>}</>}
{b.type==='image'&&<><h2>{b.title}</h2>{b.image&&<img src={b.image} alt={b.title} loading="lazy" referrerPolicy="no-referrer"/>}<p>{b.text}</p></>}
</section>)}</main><footer className={styles.siteFooter}><span>{name}</span><Link href="/builder">ساخته‌شده با دلسا</Link></footer></div>}

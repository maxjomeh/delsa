'use client';
import Link from 'next/link';
import SiteI18n from './i18n/SiteI18n';
import {useI18n} from './i18n/I18nProvider';
import {tx} from '../lib/i18n/config';
import {blockDesignVars,blockDesignAttributes,accentPair} from '../lib/builder-design';
import {normalizeDocument} from '../lib/site-builder';
import BuilderExtraElements,{extraElementTypes} from './BuilderExtraElements';
import BuilderTemplateArt from './BuilderTemplateArt';
import BuilderHeroArt,{BuilderDecor} from './BuilderHeroArt';
import {templateById,isV2} from '../lib/builder-templates';
import {fontVars} from '../lib/builder-fonts';
import BuilderMotion from './BuilderMotion';
import BuilderFloatingCover from './BuilderFloatingCover';
import {cardLine} from '../lib/builder-industries';
import {formatMoney,effectivePrice,normalizeText} from '../lib/builder-commerce';
import './builder-fonts.css';
import './builder-design-system.css';
import './builder-templates.css';
import './builder-polish.css';
import './builder-v2.css';
import styles from './SiteBuilder.module.css';
const labels={studio:tx('برای برندهایی که متفاوت فکر می‌کنند'),catalog:tx('ویترین آنلاین کسب‌وکار شما'),consultant:tx('تخصص، گفت‌وگو، راه‌حل'),atelier:tx('پوشاک و اکسسوری'),tech:tx('تکنولوژی برای زندگی'),botanical:tx('انتخاب‌های طبیعی'),jewel:tx('زیورآلات و اکسسوری'),home:tx('دکور و لوازم خانه'),sport:tx('پوشاک و تجهیزات ورزشی'),editorial:tx('مجلهٔ کتاب و فرهنگ'),commerce:tx('خرید آنلاین، ساده و سریع'),cinematic:tx('کتاب‌ها، روی پرده')};
const v2Symbols={zarrin:'◆',bagh:'❦',qalam:'❡',shab:'◢',jashn:'✺',sang:'▰',deco:'✦',noor:'◌',pars:'❂',sorat:'⟫',mehr:'●',retro:'☼'};
const brandSymbols={studio:'✳',catalog:'◈',editorial:'§',commerce:'▣',cinematic:'◐'};
const httpsUrl=x=>/^https:\/\//i.test(x||'');
const coverOf=p=>(p?.images||[]).find(httpsUrl)||'';
const lowestPrice=p=>{const v=(p?.variants||[]).filter(x=>x.enabled!==false);return v.length?Math.min(...v.map(effectivePrice)):null};
// "Book of the week": the product flagged as featured (or the newest); copy comes from the block.
function BookSpotlight({b,products,base,preview,template,industry}){
 const {t,intl}=useI18n();
 const p=products.find(x=>x.featured)||products[0],img=b.image||coverOf(p),price=lowestPrice(p),meta=p?cardLine(industry,p.attributes,t):'';
 const action=p&&(preview?<span className={styles.siteButton} data-ds="button">{t('مشاهده و خرید')}</span>:<Link className={styles.siteButton} data-ds="button" href={`${base}/product/${p.slug}`}>{t('مشاهده و خرید')} <span aria-hidden="true">↗</span></Link>);
 return <>
  <div data-part="spot-cover">{template==='cinematic'?<BuilderFloatingCover src={img} alt={p?.title||b.title} title={p?.title}/>:img?<img src={img} alt={p?.title||b.title} loading="lazy" referrerPolicy="no-referrer"/>:<span data-part="cover-fallback" aria-hidden="true"><b>{p?.title||t('عنوان کتاب')}</b></span>}</div>
  <div data-part="spot-copy"><span className={styles.sectionEyebrow}>{b.title||t('کتاب هفته')}</span><h2>{p?.title||t('عنوان کتاب هفته')}</h2>{meta&&<p data-part="spot-meta">{meta}</p>}<p>{b.text}</p>{price!=null&&<strong data-part="spot-price">{formatMoney(price,intl,t('تومان'))}</strong>}{action}</div>
 </>;
}
// Author profile: name in the title, bio in the text, books matched by the product "author" field.
function AuthorSpotlight({b,products,base,preview}){
 const {t}=useI18n();
 const same=x=>normalizeText(x).replace(/[\u200c\s]+/g,' ').trim(),name=b.title||t('نام نویسنده'),books=b.title?products.filter(p=>same(p.attributes?.author)===same(b.title)).slice(0,4):[];
 return <>
  <div data-part="author-photo">{b.image?<img src={b.image} alt={name} loading="lazy" referrerPolicy="no-referrer"/>:<span aria-hidden="true">{name.slice(0,1)}</span>}</div>
  <div data-part="author-copy"><span className={styles.sectionEyebrow}>{t('نویسندهٔ ویژه')}</span><h2>{name}</h2><p>{b.text}</p>{books.length>0&&<ul data-part="author-books">{books.map(p=><li key={p.id}>{preview?<span>{p.title}</span>:<Link href={`${base}/product/${p.slug}`}>{coverOf(p)&&<img src={coverOf(p)} alt="" loading="lazy" referrerPolicy="no-referrer"/>}<span>{p.title}</span></Link>}</li>)}</ul>}</div>
 </>;
}
function SiteViewInner({name,document,pageSlug='',viewKey='',base='',products=[],preview=false,onNavigate,productsSlot,shopNav,content,beforeContent,afterContent,editor}){
 const {t,dir,intl}=useI18n();
 const doc=normalizeDocument(document),page=doc.pages.find(p=>p.slug===pageSlug)||doc.pages[0];
 const meta=templateById(doc.template),v2=isV2(doc.template),searchable=v2?meta.search:doc.template==='commerce',promo=v2?meta.promo:doc.template==='commerce';
 return <div className={`${styles.website} ${styles[doc.template]||''}`} style={{'--site-accent':doc.color,'--site-accent-fill':accentPair(doc.color).fill,'--site-on-accent':accentPair(doc.color).text,...fontVars(doc.fonts)}} data-delsa-site="" lang={doc.lang} dir={dir} data-template={doc.template} data-v2={v2?'':undefined} data-surface={v2&&doc.surface?doc.surface:undefined} data-motion={editor?undefined:doc.motion}>
 {v2&&<BuilderDecor/>}
 {!editor&&<BuilderMotion/>}
 <header className={styles.siteHeader} data-part="header">{promo&&!editor&&doc.description&&<div data-part="promo-bar">{doc.description}</div>}<div className={styles.siteBrand} data-part="brand"><span className={styles.brandSymbol} aria-hidden="true">{v2Symbols[doc.template]||brandSymbols[doc.template]||'◉'}</span><strong>{name}</strong></div>{searchable&&!preview&&!editor&&<form data-part="header-search" action={`${base}/shop`} role="search"><input name="q" type="search" placeholder={t('جست‌وجوی محصول…')} aria-label={t('جست‌وجوی محصولات')}/><button aria-label={t('جست‌وجو')}>⌕</button></form>}<nav aria-label={t('صفحات سایت')} data-part="nav">{doc.pages.map(p=>preview?<button key={p.id} onClick={()=>onNavigate?.(p.id)} aria-current={p.slug===pageSlug?'page':undefined}>{p.title}</button>:<Link key={p.id} href={`${base}${p.slug?'/'+p.slug:''}`} aria-current={p.slug===pageSlug?'page':undefined}>{p.title}</Link>)}{shopNav}</nav></header>
 {beforeContent}<div key={viewKey} data-ds="page">{content||<><div className={styles.siteSections} style={{'--page-columns':page?.columns||1,'--page-gap':(page?.gap||0)+'px'}}>{page?.blocks.map(b=><section key={b.id} id={b.type==='contact'?'contact':b.type==='products'?'products':b.type==='features'?'services':undefined} {...blockDesignAttributes(b.style,b.mobileStyle)} style={blockDesignVars(b.style,b.mobileStyle)} data-design-block={b.id} data-block={b.type} data-reveal={editor||['hero','divider','spacer'].includes(b.type)?undefined:''} onClick={editor?e=>{e.preventDefault();e.stopPropagation();editor.onSelect(b.id)}:undefined} onDragOver={editor?e=>{e.preventDefault();editor.onDragOver(b.id)}:undefined} onDrop={editor?e=>{e.preventDefault();editor.onDrop(e,b.id)}:undefined} tabIndex={editor?0:undefined} onKeyDown={editor?e=>{if(e.target===e.currentTarget&&(e.key==='Enter'||e.key===' ')){e.preventDefault();editor.onSelect(b.id)}}:undefined} aria-label={editor?t('انتخاب {title}',{title:b.title}):undefined} className={`${styles.siteBlock} ${styles[b.type]} ${b.style?.hiddenDesktop?styles.hideDesktop:''} ${b.style?.hiddenMobile?styles.hideMobile:''} ${editor?styles.designSelectable:''} ${editor?.selectedId===b.id?styles.designSelected:''} ${editor?.dropId===b.id?styles.designDrop:''}`}>
 {editor&&editor.controls(b)}
 {extraElementTypes.includes(b.type)&&<BuilderExtraElements block={b} preview={preview}/>}

 {b.type==='heading'&&<h2>{b.title}</h2>}{b.type==='button'&&<a className={styles.siteButton} data-ds="button" href={preview?undefined:b.url}>{b.button||b.title||t('دکمه')}</a>}{b.type==='divider'&&<hr/>}{b.type==='spacer'&&<span aria-hidden="true"/>}
 {b.type==='products'&&(productsSlot?<>{b.title&&<h2>{b.title}</h2>}{b.text&&<p>{b.text}</p>}{productsSlot}</>:<><div className={styles.sectionEyebrow}>{t('ویترین کسب‌وکار')}</div><h2>{b.title||t('محصولات فروشگاه')}</h2><p>{b.text}</p><div className={styles.emptyCatalog}><span aria-hidden="true">◈</span><strong>{t('محصولات شما، در این ویترین')}</strong><p>{t('بعد از افزودن و انتشار اولین محصول، تصویر، قیمت و گزینه‌های خرید اینجا نمایش داده می‌شوند.')}</p></div></>)}
 {b.type==='hero'&&<><div className={styles.heroCopy} data-ds="hero"><span className={styles.siteBadge}>{t(v2?meta.tagline:labels[doc.template])}</span><h1>{b.title}</h1><p>{b.text}</p>{b.url&&<a className={styles.siteButton} data-ds="button" href={preview?undefined:b.url}>{b.button||t('بیشتر بدانید')} <span aria-hidden="true">↗</span></a>}<div className={styles.heroSignature}><i/><span>{v2?t(meta.signature):doc.template==='studio'?t('هویت مستقل · تجربهٔ متفاوت'):doc.template==='catalog'?t('کشف کنید · مقایسه کنید · انتخاب کنید'):doc.template==='consultant'?t('شناخت نیاز · طراحی مسیر · همراهی'):t('کشف محصولات · انتخاب آگاهانه · ثبت سفارش')}</span></div></div><div className={styles.heroVisual} data-ds="hero-visual">{doc.template==='cinematic'&&(b.image||coverOf(products.find(x=>x.featured)||products[0]))?<BuilderFloatingCover src={b.image||coverOf(products.find(x=>x.featured)||products[0])} alt={b.title}/>:b.image?<img src={b.image} alt={b.title} referrerPolicy="no-referrer"/>:v2?<BuilderHeroArt template={doc.template} initial={(name||t('د')).trim().slice(0,1)}/>:<BuilderTemplateArt template={doc.template}/>}</div>{v2&&<div data-part="hero-ticker" aria-hidden="true"><span>{Array.from({length:6},(_,i)=>t(meta.signature).split(' · ').map((w,j)=><b key={i+'-'+j}>{w}</b>))}</span></div>}{doc.template==='studio'&&<div className={styles.studioRibbon} aria-hidden="true"><span>{t('ایده')}</span>✳<span>{t('طراحی')}</span>✳<span>{t('تجربه')}</span>✳<span>{t('ارتباط')}</span></div>}</>}
 {b.type==='bookSpotlight'&&<BookSpotlight b={b} products={products} base={base} preview={preview} template={doc.template} industry={doc.industry}/>}{b.type==='authorSpotlight'&&<AuthorSpotlight b={b} products={products} base={base} preview={preview}/>}{b.type==='text'&&<><span className={styles.sectionEyebrow}>{t('داستان و تخصص')}</span><h2>{b.title}</h2><p>{b.text}</p></>}
 {b.type==='features'&&<><div className={styles.sectionEyebrow}>{doc.template==='consultant'?t('چطور همکاری می‌کنیم؟'):t('چه چیزی مهم است؟')}</div><h2>{b.title}</h2><p>{b.text}</p><div className={styles.featureGrid} data-part="feature-grid">{b.items.map((item,i)=><article key={i} data-ds="card" data-reveal={editor?undefined:''} style={{'--i':i}}><span>{new Intl.NumberFormat(intl,{minimumIntegerDigits:2}).format(i+1)}</span><h3>{item}</h3><i aria-hidden="true">↗</i></article>)}</div></>}
 {b.type==='contact'&&<><div><span className={styles.sectionEyebrow}>{t('در ارتباط بمانیم')}</span><h2>{b.title}</h2><p>{b.text}</p></div>{b.url&&<a className={styles.siteButton} data-ds="button" href={preview?undefined:b.url}>{b.button||t('تماس با ما')} ↗</a>}</>}
 {b.type==='image'&&<><h2>{b.title}</h2>{b.image&&<img src={b.image} alt={b.title} loading="lazy" referrerPolicy="no-referrer"/>}<p>{b.text}</p></>}
 </section>)}</div>{!page?.blocks.some(b=>b.type==='products')&&productsSlot}</>}{afterContent}</div>
 <footer className={styles.siteFooter} data-part="footer"><div className={styles.siteBrand}><span className={styles.brandSymbol} aria-hidden="true">✳</span><strong>{name}</strong></div>{editor?<span>{t('ساخته‌شده با دلسا ↗')}</span>:<Link href="/builder">{t('ساخته‌شده با دلسا ↗')}</Link>}</footer></div>;
}

// The site renders in its own language (document.lang), whatever language the surrounding page uses.
export default function BuilderSiteView({messages,...props}){
 return <SiteI18n lang={normalizeDocument(props.document).lang} messages={messages}><SiteViewInner {...props}/></SiteI18n>;
}

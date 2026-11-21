const tx=s=>s; // marks UI text that components translate when they show it (see lib/i18n/config.js)
// Browser-side glue between the product form and the book catalog: ISBN lookup, mapping a result to form
// fields (always confirmed by the customer), and contributing the saved book to the shared catalog.
// Everything degrades gracefully: when the catalog tables/functions are not installed (or the user has no
// access) the product still saves and the customer can type the data by hand.
import {isbn13} from './book-isbn';
import {peopleOf} from './book-seo';
import {industryById,cleanFieldValue} from './builder-industries';

const MESSAGES={400:tx('شابک معتبر نیست.'),401:tx('برای جست‌وجو باید وارد حساب شوید.'),403:tx('دسترسی سایت‌ساز لازم است.'),429:tx('سقف جست‌وجو (۶۰ بار در ساعت) پر شده؛ بعداً دوباره تلاش کنید.')};
const UNAVAILABLE=tx('جست‌وجوی شابک فعلاً در دسترس نیست؛ اطلاعات را دستی وارد کنید.');

// GET /api/builder/books/lookup. Returns {ok:true,data} or {ok:false,message}.
export async function lookupBook(isbn,{fetchImpl=globalThis.fetch}={}){
 const code=isbn13(isbn);
 if(!code)return {ok:false,message:tx('ابتدا یک شابک معتبر (ISBN-10 یا ISBN-13) وارد کنید.')};
 try{
  const res=await fetchImpl('/api/builder/books/lookup?isbn='+encodeURIComponent(code),{headers:{Accept:'application/json'}});
  if(!res.ok)return {ok:false,message:MESSAGES[res.status]||UNAVAILABLE};
  return {ok:true,data:await res.json()};
 }catch{return {ok:false,message:UNAVAILABLE}}
}

// Normalises a lookup response (catalog edition or Open Library suggestion) to one flat candidate, or null.
export function candidateFrom(result){
 if(result?.source==='catalog'&&result.edition){
  const e=result.edition;
  return {origin:'catalog',label:e.verified?tx('کاتالوگ دلسا (تأییدشده)'):tx('کاتالوگ دلسا (تأییدنشده)'),isbn:e.isbn13,title:e.title||'',author:(e.authors||[]).join('، '),translator:(e.translators||[]).join('، '),publisher:e.publisher||'',
   publish_year:e.publish_year?String(e.publish_year):'',year_calendar:e.year_calendar||'',pages:e.pages?String(e.pages):'',edition:e.edition_label||'',language:e.language||'',cover:e.cover||'',image:e.cover_image_url||'',
   source:e.source||'manual',source_ref:e.source_ref||'',field_sources:{},otherEditions:e.other_editions||[]};
 }
 if(result?.source==='open_library'&&result.suggestion){
  const s=result.suggestion;
  return {origin:'open_library',label:'Open Library',isbn:result.isbn13||s.isbn,title:s.title||'',author:(s.authors||[]).join('، '),translator:(s.translators||[]).join('، '),publisher:s.publisher||'',
   publish_year:s.publish_year?String(s.publish_year):'',year_calendar:s.year_calendar||'gregorian',pages:s.pages?String(s.pages):'',edition:s.edition_label||'',language:s.language||'',cover:s.cover||'',image:s.cover_image_url||'',
   source:'open_library',source_ref:s.source_ref||'',field_sources:s.field_sources||{},otherEditions:[]};
 }
 return null;
}

// Fills the product form from a confirmed candidate. Only non-empty, valid values replace existing ones;
// Gregorian years are not copied into the (Jalali) "سال انتشار" field and are reported in `notes` instead.
export function applyCandidate({title,values,imageInput},c){
 const industry=industryById('books'),field=k=>industry.fields.find(f=>f.key===k),next={...values},notes=[];
 const set=(k,raw)=>{const clean=raw?cleanFieldValue(field(k),raw):'';if(clean)next[k]=clean};
 set('isbn',c.isbn);set('author',c.author);set('translator',c.translator);set('publisher',c.publisher);set('pages',c.pages);set('edition',c.edition);set('language',c.language);set('cover',c.cover);
 if(c.publish_year){
  const gregorian=c.year_calendar==='gregorian'||(!c.year_calendar&&Number(c.publish_year)>=1700);
  if(gregorian)notes.push('سال میلادی انتشار: '+c.publish_year+' (سال شمسی را دستی وارد کنید)');else set('publish_year',c.publish_year);
 }
 return {title:c.title||title,values:next,imageInput:c.image&&!String(imageInput||'').trim()?c.image:imageInput,notes};
}

// Payload for the catalog_upsert_edition RPC from the saved form data.
export function editionPayload({title,values,images=[],meta}){
 const v=values||{},isbn=isbn13(v.isbn);
 if(!isbn||!String(title||'').trim())return null;
 const year=Number(v.publish_year),payload={isbn,title:String(title).trim(),authors:peopleOf(v.author),translators:peopleOf(v.translator),source:meta?.source||'manual'};
 for(const [from,to] of [['publisher','publisher'],['language','language'],['edition','edition_label'],['cover','cover']])if(v[from])payload[to]=v[from];
 if(Number.isInteger(year)&&year>=1200&&year<=2200){payload.publish_year=year;payload.year_calendar=year<1700?'jalali':'gregorian'}
 if(Number(v.pages)>0)payload.pages=Number(v.pages);
 const image=images.find(x=>/^https:\/\//i.test(x||''));if(image)payload.cover_image_url=image;
 if(meta?.source_ref)payload.source_ref=meta.source_ref;
 if(meta?.field_sources&&Object.keys(meta.field_sources).length)payload.field_sources=meta.field_sources;
 return payload;
}

const MISSING=/PGRST202|PGRST205|42883|42P01|could not find|does not exist/i;
// Adds the book to the shared catalog and links the product to it. Never throws:
// 'saved' | 'skipped' (catalog not installed / nothing to send) | 'failed'.
export async function contributeEdition(db,siteId,productId,payload){
 if(!payload||!productId)return {status:'skipped'};
 try{
  const {data,error}=await db.rpc('catalog_upsert_edition',{p_site:siteId,p:payload});
  if(error)return MISSING.test(error.code+' '+error.message)?{status:'skipped'}:{status:'failed'};
  const edition=data?.id;
  if(!edition)return {status:'failed'};
  const del=await db.from('builder_product_books').delete().eq('product_id',productId);
  if(del.error)return MISSING.test(del.error.code+' '+del.error.message)?{status:'skipped'}:{status:'failed'};
  const ins=await db.from('builder_product_books').insert({product_id:productId,site_id:siteId,edition_id:edition});
  return ins.error?{status:'failed'}:{status:'saved',created:Boolean(data.created)};
 }catch{return {status:'failed'}}
}

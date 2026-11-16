// Book metadata lookup: shared catalog first, Open Library second. Nothing here writes to the database;
// the result is only a SUGGESTION that the customer confirms or corrects before it is saved.
//
// Open Library is the only external source: its bibliographic metadata is openly licensed. Other sources
// (Google Books, national libraries, shops) have terms of use that must be reviewed before being added here.
import {isbn13} from './book-isbn';

export const OPEN_LIBRARY_ORIGIN='https://openlibrary.org';
const MAX_BODY=200*1024;
const clean=(v,max)=>{const s=String(v??'').replace(/\s+/g,' ').trim();return s?s.slice(0,max):''};
const people=list=>(Array.isArray(list)?list:[]).map(x=>clean(x?.name??x,120)).filter(Boolean).slice(0,10);
// Cover images must come from Open Library over HTTPS; any other host is dropped.
const coverUrl=c=>{for(const u of [c?.large,c?.medium,c?.small]){try{const url=new URL(String(u));if(url.protocol==='https:'&&(url.hostname==='covers.openlibrary.org'||url.hostname.endsWith('.archive.org'))&&u.length<=2048)return url.toString()}catch{}}return ''};

// Maps the `data` object of https://openlibrary.org/api/books?jscmd=data to a catalog suggestion (or null).
export function mapOpenLibrary(isbn,data){
 const title=clean([data?.title,data?.subtitle].filter(Boolean).join(': '),300);
 if(!title)return null;
 const out={isbn:isbn,title,authors:people(data.authors),translators:[],publisher:clean(data.publishers?.[0]?.name,160),language:'',edition_label:'',cover:'',source:'open_library',source_ref:clean(data.key||data.identifiers?.openlibrary?.[0],200)};
 const year=String(data.publish_date||'').match(/\b(1[2-9]\d\d|2[01]\d\d)\b/);
 if(year){out.publish_year=Number(year[1]);out.year_calendar='gregorian'}
 const pages=Number(data.number_of_pages??String(data.pagination||'').match(/\d+/)?.[0]);
 if(Number.isInteger(pages)&&pages>=1&&pages<=100000)out.pages=pages;
 const image=coverUrl(data.cover);if(image)out.cover_image_url=image;
 out.field_sources=Object.fromEntries(['title','authors','publisher','publish_year','pages','cover_image_url'].filter(k=>out[k]&&(!Array.isArray(out[k])||out[k].length)).map(k=>[k,'open_library']));
 return out;
}

// Fetches one ISBN from Open Library. Returns a suggestion, null when the book is unknown, and throws
// Error('lookup_unavailable') on network problems, timeouts, non-JSON or oversized responses.
export async function fetchOpenLibrary(isbn,{fetchImpl=globalThis.fetch,timeoutMs=4000}={}){
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeoutMs);
 try{
  const res=await fetchImpl(`${OPEN_LIBRARY_ORIGIN}/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,{signal:ctl.signal,headers:{Accept:'application/json'}});
  if(!res.ok)throw new Error('http '+res.status);
  const text=await res.text();
  if(text.length>MAX_BODY)throw new Error('too large');
  const json=JSON.parse(text);
  return mapOpenLibrary(isbn,json?.['ISBN:'+isbn]);
 }catch{throw new Error('lookup_unavailable')}
 finally{clearTimeout(timer)}
}

// Orchestration. `catalogLookup(isbn13)` returns an edition or null; `register(isbn13)` enforces the per-user rate
// limit and may throw; `fetchImpl` is injectable for tests. Errors with a stable `code`: invalid_isbn.
export async function lookupIsbn({isbn,catalogLookup,register,fetchImpl}){
 const code=isbn13(isbn);
 if(!code){const e=new Error('invalid_isbn');e.code='invalid_isbn';throw e}
 const edition=await catalogLookup(code);
 if(edition)return {isbn13:code,source:'catalog',edition};
 await register(code);
 try{
  const suggestion=await fetchOpenLibrary(code,{fetchImpl});
  return suggestion?{isbn13:code,source:'open_library',suggestion}:{isbn13:code,source:'none'};
 }catch{return {isbn13:code,source:'none',error:'lookup_unavailable'}}
}

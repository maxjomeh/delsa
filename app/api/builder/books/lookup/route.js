import {NextResponse} from 'next/server';
import {createClient} from '../../../../../lib/supabase/server';
import {isbn13} from '../../../../../lib/book-isbn';
import {lookupIsbn} from '../../../../../lib/book-lookup';

// GET /api/builder/books/lookup?isbn=...
// Returns {source:'catalog'|'open_library'|'none', edition?|suggestion?}. Signed-in site-builder customers only;
// the catalog is read first and the external source is contacted only on a miss (60 lookups per user and hour,
// enforced in the database). Nothing is saved here: the customer confirms the data in the product form first.
const status={store_access_denied:403,lookup_rate_limited:429,invalid_isbn:400};
export async function GET(request){
 const isbn=new URL(request.url).searchParams.get('isbn')||'';
 if(!isbn13(isbn))return NextResponse.json({error:'invalid_isbn'},{status:400});
 const db=await createClient();
 const {data:{user}}=await db.auth.getUser();
 if(!user)return NextResponse.json({error:'unauthorized'},{status:401});
 try{
  const result=await lookupIsbn({
   isbn,
   catalogLookup:async code=>{const {data,error}=await db.rpc('catalog_lookup_edition',{p_isbn:code});if(error)throw error;return data},
   register:async code=>{const {error}=await db.rpc('catalog_register_lookup',{p_isbn:code});if(error)throw error}
  });
  return NextResponse.json(result,{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){
  const key=e?.code==='invalid_isbn'?'invalid_isbn':Object.keys(status).find(k=>String(e?.message||'').includes(k));
  return NextResponse.json({error:key||'unavailable'},{status:key?status[key]:502});
 }
}

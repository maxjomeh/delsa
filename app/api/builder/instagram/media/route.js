import {NextResponse} from 'next/server';
import {createClient} from '../../../../../lib/supabase/server';
import {seal,unseal,serverDatabase} from '../../../../../lib/crm/instagram';
import {fetchMediaPage,fetchMediaById,InstagramError,errorMessages} from '../../../../../lib/builder-instagram';
import {loadToken,markExpired} from '../../../../../lib/builder-instagram-token';
import {graphOrigin,isUuid,missingObject} from '../../../../../lib/builder-instagram-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(value,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store, private'}});
const status={instagram_token_invalid:401,instagram_permission:403,instagram_rate_limited:429,instagram_unavailable:502};

// GET /api/builder/instagram/media?account=<row id>&kind=posts|stories|new&after=<cursor>
// kind=new lists the "product suggestions" found by the periodic check (fresh thumbnails are read from Instagram by id).
// Reads one page of the signed-in customer's own media. Nothing is stored here.
export async function GET(request){
 const q=new URL(request.url).searchParams,id=q.get('account'),kind=q.get('kind')==='stories'?'stories':'posts',fresh=q.get('kind')==='new';
 if(!isUuid(id))return json({error:'invalid'},400);
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)return json({error:'unauthorized'},401);
 const access=await db.rpc('has_site_builder_access');
 if(access.error||!access.data)return json({error:'store_access_denied',message:errorMessages.store_access_denied},403);
 // RLS: only the owner's own accounts are visible.
 const {data:row}=await db.from('builder_instagram_accounts').select('id,username,status').eq('id',id).maybeSingle();
 if(!row)return json({error:'not_found'},404);
 if(row.status!=='connected')return json({error:'instagram_token_invalid',message:errorMessages.instagram_token_invalid},401);
 const svc=serverDatabase(),origin=graphOrigin();
 let token,accountId;
 try{({token,accountId}=await loadToken({svc,userId:user.id,accountRow:id,origin,seal,unseal}))}
 catch(e){
  const code=e instanceof InstagramError?e.code:'instagram_unavailable';
  if(code==='instagram_token_invalid')await markExpired(svc,user.id,id);
  return json({error:code,message:errorMessages[code]},code==='instagram_unavailable'?503:status[code]||502);
 }
 try{
  let page;
  if(fresh){
   const r=await db.from('builder_instagram_suggestions').select('media_id').eq('account_row',id).eq('status','new').order('posted_at',{ascending:false,nullsFirst:false}).limit(24);
   if(r.error)return json({error:missingObject(r.error)?'unavailable':'failed'},503);
   const items=[],gone=[];
   for(let i=0;i<(r.data||[]).length;i+=6)await Promise.all(r.data.slice(i,i+6).map(async x=>{
    try{items.push(await fetchMediaById({token,id:x.media_id,origin}))}
    catch(e){if(e instanceof InstagramError&&e.code==='instagram_not_found')gone.push(x.media_id);else if(e instanceof InstagramError&&['instagram_token_invalid','instagram_permission','instagram_rate_limited'].includes(e.code))throw e}
   }));
   // Posts deleted on Instagram since the check disappear from the inbox.
   if(gone.length)await db.from('builder_instagram_suggestions').update({status:'dismissed'}).eq('account_row',id).in('media_id',gone).eq('status','new');
   items.sort((a,b)=>Date.parse(b.timestamp||0)-Date.parse(a.timestamp||0));
   page={items,next:null};
  }else page=await fetchMediaPage({token,account:accountId,kind,after:q.get('after')||'',origin});
  // Mark what the customer already imported into the chosen site (RLS: only their own sites are visible).
  const siteId=q.get('site');let imported={};
  if(isUuid(siteId)&&page.items.length){const {data}=await db.from('builder_instagram_imports').select('media_id,product_id').eq('site_id',siteId).in('media_id',page.items.map(i=>i.id));for(const r of data||[])imported[r.media_id]=r.product_id}
  return json({...page,items:page.items.map(i=>imported[i.id]?{...i,imported:true,productId:imported[i.id]}:i),account:{id,username:row.username}});
 }catch(e){
  const code=e instanceof InstagramError?e.code:'instagram_unavailable';
  if(code==='instagram_token_invalid')await markExpired(svc,user.id,id);
  return json({error:code,message:errorMessages[code]},status[code]||502);
 }
}

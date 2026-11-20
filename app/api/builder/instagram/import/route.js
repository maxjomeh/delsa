import {NextResponse} from 'next/server';
import {createClient} from '../../../../../lib/supabase/server';
import {seal,unseal,serverDatabase} from '../../../../../lib/crm/instagram';
import {fetchMediaById,InstagramError,errorMessages} from '../../../../../lib/builder-instagram';
import {loadToken,markExpired} from '../../../../../lib/builder-instagram-token';
import {importMedia,downloadAsset,ImportError,importErrors,BATCH_LIMIT,SITE_QUOTA_BYTES} from '../../../../../lib/builder-instagram-import';
import {graphOrigin,isUuid} from '../../../../../lib/builder-instagram-server';
import {requireSiteAccount} from '../../../../../lib/builder-instagram-access';
import {normalizeOverrides} from '../../../../../lib/builder-ai';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const json=(value,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store, private'}});

// POST {account, site, ids:[<=3 Instagram media ids], overrides?:{<id>:{title,price,...}}} -> {results:[{id,status:'created'|'duplicate'|'failed',productId?,images?,videos?,skipped?,error?,message?}]}
// The browser only names the media; the server re-reads each item from Instagram with the owner's token, copies the files into
// storage and creates a DRAFT product through the owner's own session (plan rules and RLS apply). The browser loops over batches.
export async function POST(request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'forbidden'},403);
 let body;try{body=await request.json()}catch{return json({error:'invalid'},400)}
 const ids=[...new Set((Array.isArray(body.ids)?body.ids:[]).map(String))];
 if(!isUuid(body.account)||!isUuid(body.site)||!ids.length||ids.length>BATCH_LIMIT||ids.some(x=>!/^[0-9]{1,40}$/.test(x)))return json({error:'invalid'},400);
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)return json({error:'unauthorized'},401);
 const checked=await requireSiteAccount({db,user,siteId:body.site,accountId:body.account,messages:errorMessages});
 if(!checked.ok)return json(checked.body,checked.status);
 const industry=checked.site.draft?.industry||'general';
 const svc=serverDatabase(),origin=graphOrigin();
 let token;
 try{({token}=await loadToken({svc,userId:user.id,accountRow:body.account,origin,seal,unseal}))}
 catch(e){const code=e instanceof InstagramError?e.code:'instagram_unavailable';if(code==='instagram_token_invalid')await markExpired(svc,user.id,body.account);return json({error:code,message:errorMessages[code]},code==='instagram_token_invalid'?401:503)}
 // per-site media quota
 const used=await svc.rpc('builder_site_media_bytes',{p_site:body.site});
 if(used.error)return json({error:'unavailable',message:errorMessages.instagram_unavailable},503);
 if(Number(used.data)>=SITE_QUOTA_BYTES)return json({error:'storage_full',message:importErrors.storage_full},409);
 const {data:existing}=await db.from('builder_instagram_imports').select('media_id,product_id').eq('site_id',body.site).in('media_id',ids);
 const done=Object.fromEntries((existing||[]).map(r=>[r.media_id,r.product_id]));
 const deps={
  download:downloadAsset,
  upload:async(bucket,path,buffer,type)=>{const up=await svc.storage.from(bucket).upload(path,buffer,{contentType:type,upsert:true,cacheControl:'31536000'});if(up.error)throw new ImportError('save_failed');return svc.storage.from(bucket).getPublicUrl(path).data.publicUrl},
  remove:(bucket,paths)=>svc.storage.from(bucket).remove(paths),
  saveProduct:async(doc,variants)=>{const r=await db.rpc('save_builder_product',{p_site:body.site,p_product:null,p_document:doc,p_variants:variants,p_expected:null});if(r.error){if(r.error.code==='23505')throw new ImportError('duplicate');if(String(r.error.message||'').includes('builder_free_product_limit'))throw new ImportError('plan_limit');throw new ImportError('save_failed',String(r.error.message||'').slice(0,80))}return r.data},
  deleteProduct:id=>svc.from('builder_products').delete().eq('id',id).eq('site_id',body.site).then(()=>{},()=>{})
 };
 const results=[];let stop=false;
 for(const id of ids){
  if(done[id]){results.push({id,status:'duplicate',productId:done[id],message:importErrors.duplicate});continue}
  if(stop){results.push({id,status:'failed',error:'skipped',message:errorMessages.instagram_token_invalid});continue}
  try{
   const over=body.overrides&&typeof body.overrides==='object'&&body.overrides[id]?normalizeOverrides(body.overrides[id],{industry}):null;
   if(over&&over.include===false){results.push({id,status:'skipped'});continue}
   const media=await fetchMediaById({token,id,origin});
   const r=await importMedia({media,site:body.site,options:{over},deps:{...deps,record:async({productId,videos})=>{
    const rec=await svc.rpc('builder_instagram_record_import',{p_owner:user.id,p_site:body.site,p_product:productId,p_account:body.account,p_media:media.id,p_kind:media.kind,p_permalink:media.permalink,p_posted:media.timestamp||null,p_caption:media.caption,p_videos:videos});
    if(rec.error)throw String(rec.error.message||'').includes('builder_instagram_duplicate')?new ImportError('duplicate'):new ImportError('save_failed');
   }}});
   results.push({id,status:'created',...r});
  }catch(e){
   const code=e instanceof InstagramError||e instanceof ImportError?e.code:'failed';
   if(code==='instagram_token_invalid'){stop=true;await markExpired(svc,user.id,body.account)}
   results.push({id,status:code==='duplicate'?'duplicate':'failed',error:code,message:importErrors[code]||errorMessages[code]||importErrors.failed});
  }
 }
 return json({results});
}

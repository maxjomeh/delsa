// Turning an Instagram media item into a DRAFT product (step 2): copy the pictures/video into our own storage,
// build the product from the caption with plain rules (no AI yet) and remember where it came from.
// Everything here is dependency-injected (`deps`) so the whole flow is testable without Instagram, Storage or the database.
import {safeMediaUrl} from './builder-instagram';
export const MAX_IMAGE_BYTES=5*1024*1024;      // the images bucket limit
export const MAX_VIDEO_BYTES=50*1024*1024;     // larger videos keep only their cover
export const MAX_IMAGES=10;                    // a product holds 12; leave room for manual additions
export const MAX_VIDEOS=2;
export const SITE_QUOTA_BYTES=1024*1024*1024;  // media stored per site
export const BATCH_LIMIT=3;                    // items per request (keeps one request well inside the function time limit)
export const BUCKETS={image:'builder-product-images',video:'builder-product-videos'};

const HASHTAG=/#[\p{L}\p{N}_]{1,60}/gu;
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
// First meaningful line without hashtags/links, cut at a word boundary.
export function titleFromCaption(caption){
 const line=String(caption||'').split(/\r?\n/).map(l=>clean(l.replace(HASHTAG,' ').replace(/https?:\/\/\S+/g,' '))).find(l=>l.length>=2)||'';
 if(line.length<2)return 'محصول اینستاگرام';
 if(line.length<=100)return line;
 const cut=line.slice(0,100),at=cut.lastIndexOf(' ');return (at>40?cut.slice(0,at):cut).trim();
}
export function descriptionFromCaption(caption){
 return String(caption||'').replace(/\r\n/g,'\n').split('\n').map(l=>l.replace(HASHTAG,' ').replace(/[ \t]+/g,' ').trim()).join('\n').replace(/\n{3,}/g,'\n\n').trim().slice(0,12000);
}
export function summaryFrom(description,title){
 const flat=clean(description);if(!flat||flat===title)return '';
 return (flat.length<=200?flat:flat.slice(0,200).replace(/\s\S*$/,'')+'…').slice(0,500);
}
export function tagsFromCaption(caption){
 const seen=new Set(),out=[];
 for(const m of String(caption||'').match(HASHTAG)||[]){const t=m.slice(1).replace(/_/g,' ').trim().slice(0,40);const k=t.toLowerCase();if(t.length>=2&&!seen.has(k)){seen.add(k);out.push(t)}if(out.length===10)break}
 return out;
}
export const slugForMedia=id=>'ig-'+String(id).replace(/[^0-9]/g,'').slice(0,40);
export const skuForMedia=id=>'IG-'+String(id).replace(/[^0-9]/g,'').slice(0,40);

// Which files are copied: product pictures (carousel: every picture; reel/video: the cover) and up to two videos.
export function planAssets(media){
 const images=[],videos=[];
 const addImage=u=>{const url=safeMediaUrl(u);if(url&&!images.includes(url)&&images.length<MAX_IMAGES)images.push(url)};
 if(media.children?.length){for(const c of media.children){if(c.type==='video'){if(c.url&&videos.length<MAX_VIDEOS)videos.push({url:c.url,poster:c.thumbnail});addImage(c.thumbnail)}else addImage(c.url||c.thumbnail)}}
 else if(media.video){addImage(media.thumbnail);if(media.videoUrl)videos.push({url:media.videoUrl,poster:media.thumbnail})}
 else addImage(media.thumbnail);
 if(!images.length&&media.thumbnail)addImage(media.thumbnail);
 return {images,videos};
}
// File type from its first bytes (the CDN's Content-Type is not trusted).
export function sniffType(buf){
 if(!buf||buf.length<12)return '';
 if(buf[0]===0xff&&buf[1]===0xd8&&buf[2]===0xff)return 'image/jpeg';
 if(buf.slice(0,8).toString('hex')==='89504e470d0a1a0a')return 'image/png';
 if(buf.slice(0,4).toString('latin1')==='RIFF'&&buf.slice(8,12).toString('latin1')==='WEBP')return 'image/webp';
 if(buf.slice(4,8).toString('latin1')==='ftyp'){const brand=buf.slice(8,12).toString('latin1');return brand==='qt  '?'video/quicktime':'video/mp4'}
 return '';
}
export const extensionOf=type=>({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/quicktime':'mov'})[type]||'bin';
export class ImportError extends Error{constructor(code,detail=''){super(code);this.code=code;this.detail=detail}}

// Downloads one CDN file with a hard size cap. Only Instagram/Facebook CDN hosts, https, no redirects.
export async function downloadAsset(url,{maxBytes,kinds,fetchImpl=globalThis.fetch,timeout=25000}){
 if(!safeMediaUrl(url))throw new ImportError('asset_blocked');
 let res;try{res=await fetchImpl(url,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout?.(timeout)})}catch{throw new ImportError('asset_unreachable')}
 if(!res.ok)throw new ImportError('asset_unreachable');
 const declared=Number(res.headers?.get?.('content-length')||0);if(declared>maxBytes)throw new ImportError('asset_too_large');
 const chunks=[];let size=0;
 if(res.body?.getReader){const r=res.body.getReader();for(;;){const {done,value}=await r.read();if(done)break;size+=value.length;if(size>maxBytes){try{await r.cancel()}catch{}throw new ImportError('asset_too_large')}chunks.push(Buffer.from(value))}}
 else{const b=Buffer.from(await res.arrayBuffer());size=b.length;if(size>maxBytes)throw new ImportError('asset_too_large');chunks.push(b)}
 const buffer=Buffer.concat(chunks),type=sniffType(buffer);
 if(!type||!kinds.includes(type.split('/')[0]))throw new ImportError('asset_type');
 return {buffer,type,bytes:buffer.length};
}

export function productDocument(media,{images}){
 const description=descriptionFromCaption(media.caption),title=titleFromCaption(media.caption);
 return {title,slug:slugForMedia(media.id),kind:'simple',status:'draft',description,summary:summaryFrom(description,title),category:'',brand:'',images,tags:tagsFromCaption(media.caption),attributes:{},featured:false,weight_grams:0};
}
export const draftVariant=media=>({label:'پیش‌فرض',sku:skuForMedia(media.id),price:0,sale_price:null,stock:0,manage_stock:false,attributes:{}});

// Imports ONE media item. deps: {download(url,opts), upload(bucket,path,buffer,type)->publicUrl, remove(bucket,paths),
// saveProduct(doc,variants)->productId, record({productId,videos}) }. Uploaded files are removed again when a later step fails.
export async function importMedia({media,site,deps}){
 const plan=planAssets(media),uploaded=[];
 try{
  const images=[],videos=[],skipped=[];
  for(const [i,url] of plan.images.entries()){
   try{const f=await deps.download(url,{maxBytes:MAX_IMAGE_BYTES,kinds:['image']});const path=`${site}/ig-${media.id}-${i}.${extensionOf(f.type)}`;images.push(await deps.upload(BUCKETS.image,path,f.buffer,f.type));uploaded.push([BUCKETS.image,path])}
   catch(e){skipped.push(e.code||'asset_failed')}
  }
  if(!images.length)throw new ImportError('no_image',skipped[0]||'');
  for(const [i,v] of plan.videos.entries()){
   try{const f=await deps.download(v.url,{maxBytes:MAX_VIDEO_BYTES,kinds:['video']});const path=`${site}/ig-${media.id}-v${i}.${extensionOf(f.type)}`;const url=await deps.upload(BUCKETS.video,path,f.buffer,f.type);uploaded.push([BUCKETS.video,path]);
    let poster='';const at=plan.images.indexOf(v.poster);if(at>=0&&at<images.length)poster=images[at];
    videos.push({url,poster,bytes:f.bytes})}
   catch(e){skipped.push(e.code||'asset_failed')}
  }
  const productId=await deps.saveProduct(productDocument(media,{images}),[draftVariant(media)]);
  try{await deps.record({productId,videos})}
  catch(e){await deps.deleteProduct?.(productId);throw e}
  return {productId,images:images.length,videos:videos.length,skipped};
 }catch(e){
  const byBucket={};for(const [b,p] of uploaded)(byBucket[b]||=[]).push(p);
  for(const [b,paths] of Object.entries(byBucket))try{await deps.remove(b,paths)}catch{}
  throw e;
 }
}
export const importErrors={
 asset_blocked:'آدرس فایل مجاز نیست.',asset_unreachable:'فایل از اینستاگرام دریافت نشد.',asset_too_large:'فایل بزرگ‌تر از سقف مجاز است.',asset_type:'نوع فایل پشتیبانی نمی‌شود.',
 no_image:'هیچ تصویری از این مورد قابل ذخیره نبود.',duplicate:'قبلاً وارد شده است.',storage_full:'فضای رسانهٔ این سایت پر شده است.',save_failed:'ساخت محصول انجام نشد.',failed:'وارد کردن انجام نشد.'
};

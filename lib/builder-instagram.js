// Site builder <-> Instagram: reading a customer's own posts, reels and stories through the official Instagram API
// (graph.instagram.com, the same app and login as the CRM connector). Pure functions with an injectable fetch so the
// logic is testable without the network. Nothing here touches the database or stores media (that is the next step).
export const GRAPH='https://graph.instagram.com';
export const BUILDER_SCOPE='instagram_business_basic';
const FIELDS='id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,children{id,media_type,media_url,thumbnail_url}';
const STORY_FIELDS='id,media_type,media_url,thumbnail_url,permalink,timestamp';
export const PAGE_SIZE=24;
export const kinds={image:'تصویر',carousel:'چندتصویری',video:'ویدیو',reel:'ریلز',story:'استوری'};

// Only https URLs on Instagram/Facebook CDNs or instagram.com are ever passed on to the browser.
const hostOk=h=>/(^|\.)(cdninstagram\.com|fbcdn\.net|instagram\.com)$/i.test(h);
export function safeMediaUrl(value){
 try{const u=new URL(String(value||''));return u.protocol==='https:'&&!u.username&&!u.password&&hostOk(u.hostname)?u.toString().slice(0,2048):''}catch{return ''}
}
export function safePermalink(value){
 try{const u=new URL(String(value||''));return u.protocol==='https:'&&/(^|\.)instagram\.com$/i.test(u.hostname)&&!u.username?u.origin+u.pathname:''}catch{return ''}
}
const isVideo=t=>t==='VIDEO';
export function mediaKind(raw,{story=false}={}){
 if(story||raw?.media_product_type==='STORY')return 'story';
 if(raw?.media_product_type==='REELS')return 'reel';
 if(raw?.media_type==='CAROUSEL_ALBUM')return 'carousel';
 return isVideo(raw?.media_type)?'video':'image';
}
// One Graph media object -> the flat shape the dialog (and later the importer) uses; null for unusable items.
export function normalizeMedia(raw,{story=false}={}){
 if(!raw||typeof raw!=='object'||!/^[0-9]{1,40}$/.test(String(raw.id||'')))return null;
 const kind=mediaKind(raw,{story}),video=isVideo(raw.media_type);
 const children=(Array.isArray(raw.children?.data)?raw.children.data:[]).slice(0,10).map(c=>({id:String(c.id||''),type:isVideo(c.media_type)?'video':'image',url:safeMediaUrl(c.media_url),thumbnail:safeMediaUrl(c.thumbnail_url||(isVideo(c.media_type)?'':c.media_url))})).filter(c=>/^[0-9]{1,40}$/.test(c.id)&&(c.url||c.thumbnail));
 const own=safeMediaUrl(raw.media_url),thumb=safeMediaUrl(raw.thumbnail_url)||(video?'':own)||children[0]?.thumbnail||'';
 // Every item needs a still image (grid cover, product cover); a video without one is skipped.
 if(!thumb)return null;
 const time=Date.parse(raw.timestamp);
 return {id:String(raw.id),kind,video,caption:String(raw.caption||'').slice(0,2200),permalink:safePermalink(raw.permalink),thumbnail:thumb,
  videoUrl:video?own:'',children,timestamp:Number.isFinite(time)?new Date(time).toISOString():''};
}
const ERRORS={190:'instagram_token_invalid',102:'instagram_token_invalid',10:'instagram_permission',200:'instagram_permission',4:'instagram_rate_limited',17:'instagram_rate_limited',32:'instagram_rate_limited',613:'instagram_rate_limited'};
export class InstagramError extends Error{constructor(code){super(code);this.code=code}}
async function graph(url,{token,fetchImpl=globalThis.fetch,timeout=12000}={}){
 let res,body;
 try{res=await fetchImpl(url,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout?.(timeout)});body=await res.json()}
 catch{throw new InstagramError('instagram_unavailable')}
 if(body?.error||!res.ok){const e=body?.error||{};throw new InstagramError(ERRORS[e.code]||(e.type==='OAuthException'?'instagram_token_invalid':res.status===429?'instagram_rate_limited':'instagram_unavailable'))}
 return body;
}
// kind: 'posts' (posts + reels, newest first) or 'stories' (only stories that are live right now).
export async function fetchMediaPage({token,account,kind='posts',after='',limit=PAGE_SIZE,fetchImpl,origin=GRAPH}){
 if(!token)throw new InstagramError('instagram_token_invalid');
 const stories=kind==='stories',size=Math.max(1,Math.min(50,Number(limit)||PAGE_SIZE));
 const u=new URL(stories?`${origin}/${encodeURIComponent(account)}/stories`:`${origin}/me/media`);
 u.searchParams.set('fields',stories?STORY_FIELDS:FIELDS);u.searchParams.set('limit',String(size));
 if(!stories&&/^[A-Za-z0-9_\-=+/]{1,400}$/.test(after||''))u.searchParams.set('after',after);
 const body=await graph(u.toString(),{token,fetchImpl});
 const items=(Array.isArray(body.data)?body.data:[]).map(m=>normalizeMedia(m,{story:stories})).filter(Boolean);
 const cursor=body.paging?.cursors?.after,next=!stories&&body.paging?.next&&typeof cursor==='string'&&cursor?cursor:null;
 return {items,next};
}
// One media object by id (used by the importer: the server never trusts URLs sent by the browser).
export async function fetchMediaById({token,id,fetchImpl,origin=GRAPH}){
 if(!token)throw new InstagramError('instagram_token_invalid');
 if(!/^[0-9]{1,40}$/.test(String(id||'')))throw new InstagramError('instagram_unavailable');
 const u=new URL(`${origin}/${id}`);u.searchParams.set('fields',FIELDS);
 const body=await graph(u.toString(),{token,fetchImpl});
 const item=normalizeMedia(body,{story:body?.media_product_type==='STORY'});
 if(!item)throw new InstagramError('instagram_media_unusable');
 return item;
}
// Long-lived tokens last 60 days and can be renewed once they are older than 24 hours.
export const REFRESH_WITHIN_DAYS=20;
export const needsRefresh=(expiresAt,now=Date.now())=>{const t=Date.parse(expiresAt);return Number.isFinite(t)&&t-now<REFRESH_WITHIN_DAYS*86400000};
export async function refreshToken({token,fetchImpl=globalThis.fetch,origin=GRAPH}){
 const u=new URL(`${origin}/refresh_access_token`);u.searchParams.set('grant_type','ig_refresh_token');u.searchParams.set('access_token',token);
 let res,body;try{res=await fetchImpl(u.toString(),{cache:'no-store',signal:AbortSignal.timeout?.(12000)});body=await res.json()}catch{throw new InstagramError('instagram_unavailable')}
 if(!res.ok||body?.error||!body?.access_token||!(Number(body.expires_in)>0))throw new InstagramError(ERRORS[body?.error?.code]||'instagram_unavailable');
 return {token:body.access_token,expires:new Date(Date.now()+Math.min(Number(body.expires_in),90*86400)*1000).toISOString()};
}
// Messages for the customer; codes never contain details about tokens.
export const errorMessages={
 instagram_token_invalid:'اتصال اینستاگرام منقضی یا لغو شده است. دوباره وصل کنید.',
 instagram_permission:'دسترسی خواندن محتوا داده نشده است. اتصال را دوباره برقرار کنید و همهٔ دسترسی‌ها را تأیید کنید.',
 instagram_rate_limited:'اینستاگرام موقتاً تعداد درخواست‌ها را محدود کرده است؛ چند دقیقه بعد دوباره تلاش کنید.',
 instagram_unavailable:'ارتباط با اینستاگرام برقرار نشد؛ دوباره تلاش کنید.',
 instagram_media_unusable:'این مورد تصویر قابل استفاده ندارد.',
 not_configured:'اتصال رسمی اینستاگرام هنوز توسط دلسا تنظیم نشده است.',
 store_access_denied:'دسترسی سایت‌ساز لازم است.',
 account_limit:'حداکثر ۵ حساب اینستاگرام قابل اتصال است.'
};

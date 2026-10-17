import {createCipheriv,createDecipheriv,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {createClient as createSupabaseClient} from '@supabase/supabase-js';

export function instagramConfiguration(origin){
 const callback=process.env.INSTAGRAM_REDIRECT_URI||'';
 let callbackValid=false;try{const u=new URL(callback);callbackValid=u.protocol==='https:'&&u.pathname==='/api/crm/instagram/callback'&&(!origin||u.origin===origin);}catch{}
 const encryption=Buffer.from(process.env.PLATFORM_CREDENTIALS_ENCRYPTION_KEY||'','base64').length===32;
 return {ready:!!(process.env.INSTAGRAM_APP_ID&&process.env.INSTAGRAM_APP_SECRET&&process.env.INSTAGRAM_WEBHOOK_APP_SECRET&&process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN&&callbackValid&&encryption&&(process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)),callback};
}
export function serverDatabase(){
 const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!key)throw new Error('CRM server is not configured');
 return createSupabaseClient(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function encryptionKey(){const key=Buffer.from(process.env.PLATFORM_CREDENTIALS_ENCRYPTION_KEY||'','base64');if(key.length!==32)throw new Error('CRM encryption unavailable');return key;}
export function seal(value){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);const body=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),body].map(x=>x.toString('base64url')).join('.');}
export function unseal(value){const [iv,tag,body]=String(value).split('.').map(x=>Buffer.from(x,'base64url'));if(iv?.length!==12||tag?.length!==16||!body)throw new Error('Invalid state');const decipher=createDecipheriv('aes-256-gcm',encryptionKey(),iv);decipher.setAuthTag(tag);return Buffer.concat([decipher.update(body),decipher.final()]).toString('utf8');}
export function verifyInstagramSignature(raw,signature,secret=process.env.INSTAGRAM_WEBHOOK_APP_SECRET){
 if(!secret||!/^sha256=[a-f0-9]{64}$/.test(signature||''))return false;
 const actual=Buffer.from(signature.slice(7),'hex'),expected=createHmac('sha256',secret).update(raw).digest();return timingSafeEqual(actual,expected);
}
export function instagramAuthorization(state){const u=new URL('https://www.instagram.com/oauth/authorize');u.search=new URLSearchParams({client_id:process.env.INSTAGRAM_APP_ID,redirect_uri:process.env.INSTAGRAM_REDIRECT_URI,response_type:'code',scope:'instagram_business_basic,instagram_business_manage_messages',state,enable_fb_login:'0',force_authentication:'1'}).toString();return u.toString();}
async function jsonFetch(url,options={}){const response=await fetch(url,{...options,cache:'no-store',signal:AbortSignal.timeout(12000)});const value=await response.json();if(!response.ok||value.error)throw new Error('Instagram request failed');return value;}
export async function exchangeInstagramCode(code){
 const shortResponse=await jsonFetch('https://api.instagram.com/oauth/access_token',{method:'POST',body:new URLSearchParams({client_id:process.env.INSTAGRAM_APP_ID,client_secret:process.env.INSTAGRAM_APP_SECRET,grant_type:'authorization_code',redirect_uri:process.env.INSTAGRAM_REDIRECT_URI,code})});
 const short=shortResponse.data?.[0]||shortResponse;if(!short.access_token)throw new Error('Instagram token missing');
 const longUrl=new URL('https://graph.instagram.com/access_token');longUrl.search=new URLSearchParams({grant_type:'ig_exchange_token',client_secret:process.env.INSTAGRAM_APP_SECRET,access_token:short.access_token}).toString();
 const long=await jsonFetch(longUrl);if(!long.access_token||!Number.isFinite(Number(long.expires_in))||Number(long.expires_in)<=0)throw new Error('Instagram expiry missing');
 const me=await jsonFetch('https://graph.instagram.com/me?fields=user_id,username',{headers:{Authorization:`Bearer ${long.access_token}`}});
 const account=String(me.user_id||me.id||short.user_id||'');if(!/^[0-9]{1,40}$/.test(account))throw new Error('Instagram account missing');
 await jsonFetch(`https://graph.instagram.com/${account}/subscribed_apps`,{method:'POST',headers:{Authorization:`Bearer ${long.access_token}`},body:new URLSearchParams({subscribed_fields:'messages'})});
 return {account,username:String(me.username||'').slice(0,80),token:long.access_token,expires:new Date(Date.now()+Math.min(Number(long.expires_in),90*86400)*1000).toISOString()};
}
export function instagramEvents(payload){
 if(payload?.object!=='instagram'||!Array.isArray(payload.entry))return [];
 const events=[];
 for(const entry of payload.entry.slice(0,50)){if(!/^[0-9]{1,40}$/.test(String(entry.id||'')))continue;
  for(const event of (Array.isArray(entry.messaging)?entry.messaging:[]).slice(0,100)){
   const account=String(entry.id),sender=String(event.sender?.id||''),recipient=String(event.recipient?.id||'');
   if(event.message?.is_echo||sender===account||recipient!==account||!/^[0-9]{1,40}$/.test(sender)||typeof event.message?.mid!=='string'||event.message.mid.length>180||typeof event.message?.text!=='string'||!event.message.text.trim()||event.message.text.length>8000)continue;
   const timestamp=Number(event.timestamp);if(!Number.isFinite(timestamp)||timestamp<=0||timestamp>Date.now()+300000)continue;
   events.push({account,sender,event:event.message.mid,body:event.message.text,occurred:new Date(timestamp).toISOString()});
  }
 }return events;
}

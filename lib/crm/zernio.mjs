import {createHmac, timingSafeEqual} from 'node:crypto';

const API_ORIGIN='https://zernio.com';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OBJECT_ID=/^[a-f0-9]{24}$/i;
export const ZERNIO_PLATFORMS=Object.freeze(['instagram','facebook']);
// Events this tenant-aware intake can safely persist. Processing each type in CRM
// is a separate, opt-in worker; subscribing does not enable automated replies.
export const ZERNIO_EVENTS=Object.freeze([
 'account.connected','account.disconnected',
 'message.received','message.sent','message.edited','message.deleted',
 'message.delivered','message.read','message.failed',
 'conversation.started','conversation.control_changed',
 'reaction.received','referral.received','comment.received',
 'review.new','review.updated',
 'contact.tag_added','contact.tag_removed','contact.field_changed',
 'sequence.enrolled','sequence.exited',
 'workflow.run.started','workflow.run.completed','workflow.run.failed',
 'lead.received'
]);
const ACCOUNT_OPTIONAL_EVENTS=new Set([
 'contact.tag_added','contact.tag_removed','contact.field_changed',
 'sequence.enrolled','sequence.exited',
 'workflow.run.started','workflow.run.completed','workflow.run.failed'
]);

export function tenantIdValid(value){return typeof value==='string'&&UUID.test(value);}
export function profileIdValid(value){return typeof value==='string'&&OBJECT_ID.test(value);}
export function zernioConfigured(){return !!process.env.ZERNIO_API_KEY?.trim();}
export function verifyZernioSignature(body,signature,secret=process.env.ZERNIO_WEBHOOK_SECRET){
 if(!secret||typeof signature!=='string'||!/^[a-f0-9]{64}$/.test(signature))return false;
 const actual=Buffer.from(signature,'hex');
 const expected=createHmac('sha256',secret).update(body).digest();
 return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
// Zernio inbox/account events route with account.profileId, not profiles[].
// Profile ownership always comes from our database, never from externalId on a webhook.
// A missing profile is allowed to normalize for safe 2xx ignore (never cross-tenant attach).
export function validatedZernioEvent(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||!UUID.test(payload.id||'')||!ZERNIO_EVENTS.includes(payload.event))return null;
 const account=payload.account&&typeof payload.account==='object'&&!Array.isArray(payload.account)?payload.account:null;
 const accountId=account?.accountId??account?.id??null;
 if(accountId!==null&&!profileIdValid(accountId))return null;
 if(!accountId&&!ACCOUNT_OPTIONAL_EVENTS.has(payload.event))return null;
 if(payload.profiles!==undefined&&(!Array.isArray(payload.profiles)||payload.profiles.length!==1))return null;
 const candidates=[account?.profileId,payload.profileId,payload.profile?._id??payload.profile?.id,payload.profiles?.[0]?._id??payload.profiles?.[0]?.id]
   .filter(x=>x!==null&&x!==undefined&&x!=='');
 if(candidates.some(x=>!profileIdValid(x))||new Set(candidates).size>1)return null;
 return {eventId:payload.id,profileId:candidates[0]||null,accountId,eventType:payload.event};
}
export async function zernioRequest(method,path,{query,body,idempotencyKey}={}){
 const key=process.env.ZERNIO_API_KEY?.trim();
 if(!key)throw new Error('ZERNIO_NOT_CONFIGURED');
 if(typeof path!=='string'||!path.startsWith('/v1/')||!/^\/[a-z0-9/%._~-]+$/i.test(path)||path.includes('..')||path.includes('//')||/%2f|%5c|%2e/i.test(path))throw new Error('Invalid Zernio API path');
 const url=new URL('/api'+path,API_ORIGIN);
 for(const [name,value] of Object.entries(query||{}))if(value!==undefined&&value!==null)url.searchParams.set(name,String(value));
 const response=await fetch(url,{method,headers:{Authorization:`Bearer ${key}`,'Accept':'application/json',...(body?{'Content-Type':'application/json'}:{}),...(idempotencyKey?{'Idempotency-Key':idempotencyKey}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(12000)});
 let data={};try{data=await response.json();}catch{}
 if(!response.ok){const error=new Error('ZERNIO_REQUEST_FAILED');error.status=response.status;error.code=typeof data?.code==='string'?data.code:'';throw error;}
 return data;
}
export function publicAccount(account,profileId){
 const id=String(account?._id||account?.accountId||'');
 const source=typeof account?.profileId==='object'?account.profileId?._id:account?.profileId;
 if(!OBJECT_ID.test(id)||source!==profileId)return null;
 return {id,platform:String(account.platform||'').slice(0,40),username:String(account.username||account.displayName||'').slice(0,100),connected:account.isActive===true||account.status==='connected',needsReconnect:account.needsReconnect===true};
}

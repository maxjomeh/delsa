import {createHmac, timingSafeEqual} from 'node:crypto';

const API_ORIGIN='https://zernio.com';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OBJECT_ID=/^[a-f0-9]{24}$/i;
export const ZERNIO_PLATFORMS=Object.freeze(['instagram','facebook']);
export const ZERNIO_EVENTS=Object.freeze(['account.connected','account.disconnected','message.received','comment.received']);

export function tenantIdValid(value){return typeof value==='string'&&UUID.test(value);}
export function profileIdValid(value){return typeof value==='string'&&OBJECT_ID.test(value);}
export function zernioConfigured(){return !!process.env.ZERNIO_API_KEY?.trim();}
export function verifyZernioSignature(body,signature,secret=process.env.ZERNIO_WEBHOOK_SECRET){
 if(!secret||typeof signature!=='string'||!/^[a-f0-9]{64}$/.test(signature))return false;
 const actual=Buffer.from(signature,'hex');
 const expected=createHmac('sha256',secret).update(body).digest();
 return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
export function validatedZernioEvent(payload){
 if(!payload||typeof payload!=='object'||!UUID.test(payload.id||'')||!ZERNIO_EVENTS.includes(payload.event))return null;
 if(!Array.isArray(payload.profiles)||payload.profiles.length!==1)return null;
 const profile=payload.profiles[0];
 if(!tenantIdValid(profile?.externalId)||!profileIdValid(profile?.id))return null;
 const accountId=payload.account?.accountId;
 if(typeof accountId!=='string'||!OBJECT_ID.test(accountId))return null;
 if(payload.account?.profileId&&payload.account.profileId!==profile.id)return null;
 return {eventId:payload.id,tenantId:profile.externalId,profileId:profile.id,accountId,eventType:payload.event};
}
export async function zernioRequest(method,path,{query,body,idempotencyKey}={}){
 const key=process.env.ZERNIO_API_KEY?.trim();
 if(!key)throw new Error('ZERNIO_NOT_CONFIGURED');
 if(typeof path!=='string'||!path.startsWith('/v1/')||!/^[a-z0-9/-]+$/.test(path.slice(4)))throw new Error('Invalid Zernio API path');
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

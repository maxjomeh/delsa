import {NextResponse} from 'next/server';
import {serverDatabase} from '../../../../../lib/crm/instagram';
import {verifyZernioSignature,validatedZernioEvent,ZERNIO_EVENTS} from '../../../../../lib/crm/zernio.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=20;

async function rawBody(request){
 const reader=request.body?.getReader();
 if(!reader)throw new Error('empty');
 const chunks=[];let length=0;
 for(;;){const {done,value}=await reader.read();if(done)break;
  length+=value.byteLength;
  if(length>262144){await reader.cancel();throw new Error('too_large');}
  chunks.push(Buffer.from(value));
 }
 return Buffer.concat(chunks);
}
export async function POST(request){
 if(!process.env.ZERNIO_WEBHOOK_SECRET||process.env.ZERNIO_ENABLE_WEBHOOK!=='true')return new Response('Not configured',{status:503});
 let raw;
 try{raw=await rawBody(request);}catch(e){return new Response('Invalid body',{status:e.message==='too_large'?413:400});}
 if(!verifyZernioSignature(raw,request.headers.get('x-zernio-signature')))return new Response('Invalid signature',{status:401});
 let payload;try{payload=JSON.parse(raw.toString('utf8'));}catch{return new Response('Invalid JSON',{status:400});}
 if(payload?.event==='webhook.test')return NextResponse.json({received:true,test:true});
 if(!ZERNIO_EVENTS.includes(payload?.event))return NextResponse.json({received:true,ignored:true});
 const normalized=validatedZernioEvent(payload);
 if(!normalized)return new Response('Invalid event',{status:400});
 // Zernio may omit profileId for shared/unowned accounts. Never infer a tenant.
 if(!normalized.profileId)return NextResponse.json({received:true,ignored:true,reason:'unmapped_profile'});
 try{
  const db=serverDatabase();
  const {data:owned,error:ownedError}=await db.from('crm_zernio_profiles').select('tenant_id').eq('profile_id',normalized.profileId).maybeSingle();
  if(ownedError)throw ownedError;
  if(!owned)return NextResponse.json({received:true,ignored:true,reason:'unknown_profile'});
  const {error}=await db.from('crm_zernio_events').insert({event_id:normalized.eventId,tenant_id:owned.tenant_id,profile_id:normalized.profileId,account_id:normalized.accountId,event_type:normalized.eventType,payload});
  if(error&&error.code!=='23505')throw error;
  return NextResponse.json({received:true,duplicate:error?.code==='23505'});
 }catch{return new Response('Retry later',{status:503});}
}

import {NextResponse} from 'next/server';
import {verifyInstagramSignature,instagramEvents,serverDatabase} from '../../../../../lib/crm/instagram';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request){
 const q=new URL(request.url).searchParams;
 if(process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN&&q.get('hub.mode')==='subscribe'&&q.get('hub.verify_token')===process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN&&q.get('hub.challenge'))return new Response(q.get('hub.challenge'),{headers:{'Cache-Control':'no-store'}});
 return new Response('Forbidden',{status:403});
}
export async function POST(request){
 if(!process.env.INSTAGRAM_WEBHOOK_APP_SECRET)return new Response('Not configured',{status:503});
 const reader=request.body?.getReader();if(!reader)return new Response('Invalid body',{status:400});
 const chunks=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>262144){await reader.cancel();return new Response('Too large',{status:413});}chunks.push(Buffer.from(value));}
 const raw=Buffer.concat(chunks);
 if(!verifyInstagramSignature(raw,request.headers.get('x-hub-signature-256')))return new Response('Forbidden',{status:403});
 let payload;try{payload=JSON.parse(raw.toString('utf8'));}catch{return new Response('Invalid JSON',{status:400});}
 try{const events=instagramEvents(payload);if(events.length){const db=serverDatabase();for(const e of events){const r=await db.rpc('crm_receive_instagram',{p_account:e.account,p_sender:e.sender,p_event:e.event,p_body:e.body,p_occurred:e.occurred});if(r.error)throw r.error;}}
  return NextResponse.json({received:true});
 }catch{return new Response('Retry later',{status:503});}
}

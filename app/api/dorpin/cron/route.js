import {NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {database,scan} from '../../../../lib/dorpin/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request){
 const expected=process.env.DORPIN_CRON_SECRET;const actual=request.headers.get('authorization')||'';
 const token=Buffer.from(`Bearer ${expected||''}`),received=Buffer.from(actual);
 if(!expected||token.length!==received.length||!timingSafeEqual(token,received))return NextResponse.json({error:'Unauthorized'},{status:401});
 try{const db=database();const rows=await db.rpc('dorpin_due_monitors');if(rows.error)throw rows.error;const due=rows.data||[];
 const results=[];for(const row of due){try{results.push({id:row.id,...await scan(db,row.user_id,row.id)});}catch{results.push({id:row.id,failed:true});}}
 return NextResponse.json({results},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Monitor unavailable'},{status:503});}
}

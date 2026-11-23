import {NextResponse} from 'next/server';
import {createClient} from '../../../../../lib/supabase/server';
import {serverDatabase} from '../../../../../lib/crm/instagram';
import {runBacktest,summarizeBacktest} from '../../../../../lib/crm/backtest.mjs';
import {loadInteractions,loadKnowledge} from '../../../../../lib/crm/topic-store.mjs';
// READ-ONLY historical replay for the signed-in CRM tenant: discovers topics from past questions and replays
// them against the tenant's approved knowledge. It never writes, never sends, and only ever reads this tenant's rows.
export const runtime='nodejs';
export const dynamic='force-dynamic';
const reply=(body,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){
 const auth=await createClient();
 const {data:{user},error}=await auth.auth.getUser();
 if(error||!user)return reply({error:'unauthenticated'},401);
 const {data:active,error:accessError}=await auth.rpc('has_active_crm');
 if(accessError||active!==true)return reply({error:'crm_access_required'},403);
 const db=serverDatabase();
 const [interactions,knowledge]=await Promise.all([loadInteractions(db,user.id),loadKnowledge(db,user.id)]);
 if(!interactions.ok||!knowledge.ok)return reply({error:interactions.ok?knowledge.error:interactions.error},503);
 return reply({report:summarizeBacktest(runBacktest({interactions:interactions.rows,knowledge:knowledge.rows})),truncated:interactions.truncated,
  note:'Read-only replay. Knowledge suggestions are drafts for human approval; nothing was saved or sent.'});
}

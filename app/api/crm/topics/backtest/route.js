import {NextResponse} from 'next/server';
import {createClient} from '../../../../../lib/supabase/server';
import {serverDatabase} from '../../../../../lib/crm/instagram';
import {runBacktest,summarizeBacktest} from '../../../../../lib/crm/backtest.mjs';
// READ-ONLY historical replay for the signed-in CRM tenant: discovers topics from past questions and replays
// them against the tenant's approved knowledge. It never writes, never sends, and only ever reads this tenant's rows.
export const runtime='nodejs';
export const dynamic='force-dynamic';
const PAGE=1000,MAX_PAGES=4;
const reply=(body,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){
 const auth=await createClient();
 const {data:{user},error}=await auth.auth.getUser();
 if(error||!user)return reply({error:'unauthenticated'},401);
 const {data:active,error:accessError}=await auth.rpc('has_active_crm');
 if(accessError||active!==true)return reply({error:'crm_access_required'},403);
 const db=serverDatabase();
 const interactions=[];let truncated=false;
 for(let page=0;page<MAX_PAGES;page++){
  const {data,error:readError}=await db.from('crm_interactions')
   .select('id,customer_id,channel,direction,kind,body,occurred_at,created_at').eq('tenant_id',user.id)
   .order('created_at',{ascending:false}).range(page*PAGE,page*PAGE+PAGE-1);
  if(readError)return reply({error:'interactions_unavailable'},503);
  interactions.push(...(data||[]));
  if((data||[]).length<PAGE)break;
  if(page===MAX_PAGES-1)truncated=true;
 }
 const {data:knowledge,error:knowledgeError}=await db.from('sima_knowledge_entries')
  .select('id,title,question,answer,revision,status,expires_at').eq('tenant_id',user.id).eq('status','approved').limit(250);
 if(knowledgeError)return reply({error:'knowledge_unavailable'},503);
 return reply({report:summarizeBacktest(runBacktest({interactions,knowledge:knowledge||[]})),truncated,
  note:'Read-only replay. Knowledge suggestions are drafts for human approval; nothing was saved or sent.'});
}

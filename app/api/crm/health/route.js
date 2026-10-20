import {NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {serverDatabase} from '../../../../lib/crm/instagram';
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
 const results=await Promise.allSettled([
  db.from('crm_zernio_profiles').select('profile_id',{count:'exact',head:true}).eq('tenant_id',user.id),
  db.from('crm_zernio_events').select('event_id',{count:'exact',head:true}).eq('tenant_id',user.id).eq('status','pending'),
  db.from('sima_human_review_cases').select('id',{count:'exact',head:true}).eq('tenant_id',user.id).eq('state','awaiting_human'),
  db.from('crm_field_definitions').select('id',{count:'exact',head:true}).eq('tenant_id',user.id).eq('enabled',true)
 ]);
 const metric=i=>results[i].status==='fulfilled'&&!results[i].value.error?results[i].value.count:null;
 const providerConfigured=process.env.ZERNIO_CONNECT_ENABLED==='true'&&!!process.env.ZERNIO_API_KEY;
 const webhookConfigured=process.env.ZERNIO_ENABLE_WEBHOOK==='true'&&!!process.env.ZERNIO_WEBHOOK_SECRET;
 return reply({status:providerConfigured&&webhookConfigured?'ready':'degraded',
  checks:{channelConnection:providerConfigured?'configured':'not_configured_in_this_deployment',
   webhook:webhookConfigured?'configured':'not_configured_in_this_deployment',
   storedProfiles:metric(0),queuedEvents:metric(1),humanReviews:metric(2),activeCustomerFields:metric(3)},
  note:'This is a configuration and queue snapshot, not proof of end-to-end provider delivery.'});
}

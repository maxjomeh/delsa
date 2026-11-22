// A complete "tenant ready for automatic replies" world on the in-memory fake database. Tests change ONE thing at a time.
import {discoverTopics} from '../../lib/crm/topic-discovery.mjs';
import {fakeDb} from './fake-db.mjs';
import {NOW,HOURS_REPLY,standard} from './conversations.mjs';

export const T1='tenant-1',ACCOUNT='a'.repeat(24);
export const topicProfile=()=>discoverTopics(standard()).find(t=>t.examples.some(e=>/ساعت/.test(e)));
const minutes=m=>new Date(NOW-m*60000).toISOString();

export function world({customers=1,confidence='high',evidence=40,extra={}}={}){
 const t=topicProfile();
 const outcomes=Array.from({length:evidence},(_,i)=>({id:i+1,tenant_id:T1,topic_id:'topic-hours',source:'shadow',outcome:confidence==='high'?'accepted':(i%2?'accepted':'rejected'),created_at:minutes(60)}));
 const cases=[],interactions=[],people=[],states=[];
 for(let i=1;i<=customers;i++){
  const id=`c${i}`;
  people.push({id,tenant_id:T1,do_not_contact:false});
  cases.push({id:`r${i}`,tenant_id:T1,customer_id:id,account_id:ACCOUNT,channel:'instagram',last_message_id:`m${i}`,last_occurred_at:minutes(10+i),state:'awaiting_human',conversation_version:1});
  interactions.push({id:`m${i}`,tenant_id:T1,customer_id:id,channel:'instagram',direction:'inbound',kind:'message',body:'ساعت کاری شما چیه؟',occurred_at:minutes(10+i)});
  states.push({tenant_id:T1,customer_id:id,field_id:'f1',status:'confirmed'});
 }
 const seed={
  sima_autonomy_settings:[{tenant_id:T1,auto_enabled:true,paused_at:null,auto_hourly_cap:20,auto_customer_daily_cap:3}],
  sima_topics:[{id:'topic-hours',tenant_id:T1,topic_key:t.key,label:'ساعت کاری',risk_class:'low',status:'active',stage:'auto',never_auto:false,confidence_floor:'0.900',confidence_threshold:'0.900',origin:'discovered',keywords:t.keywords,examples:t.examples,profile:t.profile,activated_at:minutes(5000),created_at:minutes(6000)}],
  sima_topic_fields:[{tenant_id:T1,topic_id:'topic-hours',field_key:'opening_hours',required:true}],
  sima_topic_outcomes:outcomes,
  crm_field_definitions:[{id:'f1',tenant_id:T1,key:'opening_hours',enabled:true}],
  crm_information_states:states,
  sima_knowledge_entries:[{id:'k1',tenant_id:T1,title:'ساعت کاری',question:'ساعت کاری شما چیه',answer:HOURS_REPLY,status:'approved',revision:3,expires_at:null}],
  sima_human_review_cases:cases,crm_interactions:interactions,crm_customers:people,sima_auto_answers:[],sima_message_outbox:[],sima_topic_transitions:[],
  ...extra,
 };
 return seed;
}

// rpc handlers that behave like the database functions when nothing is wrong; tests override one at a time.
export function handlers(over={}){
 return {
  sima_prepare_auto_send:()=>({data:{outbox_id:'ob1',queued:true},error:null}),
  sima_claim_auto_send:()=>({data:{id:'ob1',account_id:ACCOUNT,conversation_id:'conv1',body:HOURS_REPLY,review_id:'r1',conversation_version:1},error:null}),
  sima_finalize_human_send:({p_status})=>({data:{status:p_status},error:null}),
  ...over,
 };
}
export function zernio(script){
 const calls=[];
 const request=async(method,path,options)=>{calls.push({method,path,options});return script?script(calls.length,method,path,options):{success:true,data:{messageId:'provider-1'}};};
 return {request,calls};
}
export const build=(seedOptions,{rpc,...rest}={})=>fakeDb(world(seedOptions),{rpc:handlers(rpc),...rest});
export const run=(db,over={})=>({db,tenantId:T1,mode:'live',now:NOW,verifySender:async()=>true,...over});

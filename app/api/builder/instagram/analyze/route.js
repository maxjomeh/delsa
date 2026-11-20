import {NextResponse} from 'next/server';
import {createClient} from '../../../../../lib/supabase/server';
import {seal,unseal,serverDatabase} from '../../../../../lib/crm/instagram';
import {loadGapGPT,gapgptChat} from '../../../../../lib/crm/cima-gapgpt.mjs';
import {fetchMediaById,InstagramError,errorMessages} from '../../../../../lib/builder-instagram';
import {loadToken,markExpired} from '../../../../../lib/builder-instagram-token';
import {suggestFor,fieldSpecs,AI_MONTHLY_CAP} from '../../../../../lib/builder-ai';
import {titleFromCaption} from '../../../../../lib/builder-instagram-import';
import {requireSiteAccount} from '../../../../../lib/builder-instagram-access';
import {graphOrigin,isUuid} from '../../../../../lib/builder-instagram-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const json=(value,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store, private'}});
const LIMIT=5;
const cap=()=>{const n=Number(process.env.BUILDER_AI_MONTHLY_CAP);return Number.isInteger(n)&&n>=1&&n<=100000?n:AI_MONTHLY_CAP};

// POST {account, site, ids:[<=5 media ids]} -> {results:[{id,source:'ai'|'rules',suggestion,fallbackTitle,caption}], ai:{state,remaining,cap}, fields, categories}
// Suggestions only: nothing is saved. The model is the admin-configured GapGPT of the CRM; every item uses one unit of a monthly
// allowance that is separate from the CRM's. When the model is off, the allowance is used up or a call fails, deterministic rules answer instead.
export async function POST(request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'forbidden'},403);
 let body;try{body=await request.json()}catch{return json({error:'invalid'},400)}
 const ids=[...new Set((Array.isArray(body.ids)?body.ids:[]).map(String))];
 if(!isUuid(body.account)||!isUuid(body.site)||!ids.length||ids.length>LIMIT||ids.some(x=>!/^[0-9]{1,40}$/.test(x)))return json({error:'invalid'},400);
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)return json({error:'unauthorized'},401);
 const checked=await requireSiteAccount({db,user,siteId:body.site,accountId:body.account,messages:errorMessages});
 if(!checked.ok)return json(checked.body,checked.status);
 const industry=checked.site.draft?.industry||'general';
 const svc=serverDatabase(),origin=graphOrigin();
 let token;
 try{({token}=await loadToken({svc,userId:user.id,accountRow:body.account,origin,seal,unseal}))}
 catch(e){const code=e instanceof InstagramError?e.code:'instagram_unavailable';if(code==='instagram_token_invalid')await markExpired(svc,user.id,body.account);return json({error:code,message:errorMessages[code]},code==='instagram_token_invalid'?401:503)}
 // Model + allowance
 let model=null,state='off',remaining=0;
 try{model=await loadGapGPT(svc)}catch{model=null}
 if(model){
  const claim=await svc.rpc('builder_ai_claim',{p_owner:user.id,p_count:ids.length,p_cap:cap()});
  if(claim.error)model=null;                                   // table not installed: rules only
  else if(claim.data<0){model=null;state='exhausted'}
  else{state='ok';remaining=claim.data}
 }
 const {data:cats}=await db.from('builder_products').select('category').eq('site_id',body.site).neq('category','').limit(300);
 const categories=[...new Set((cats||[]).map(c=>c.category))].slice(0,40);
 let failedCalls=0;
 const call=model?async messages=>{try{return (await gapgptChat({apiKey:model.apiKey,model:model.model,messages,maxTokens:450})).text}catch(e){failedCalls++;throw e}}:undefined;
 const results=new Array(ids.length);let stop=false;
 async function one(i){
  const id=ids[i];
  try{
   const media=await fetchMediaById({token,id,origin});
   const {suggestion,source}=await suggestFor({caption:media.caption,industry,categories,call});
   results[i]={id,source,suggestion,fallbackTitle:titleFromCaption(media.caption),caption:media.caption.slice(0,400)};
  }catch(e){
   const code=e instanceof InstagramError?e.code:'failed';if(code==='instagram_token_invalid')stop=true;
   results[i]={id,error:code,message:errorMessages[code]||errorMessages.instagram_unavailable};
  }
 }
 // three at a time keeps five items well inside the time limit
 for(let i=0;i<ids.length&&!stop;i+=3)await Promise.all(ids.slice(i,i+3).map((_,k)=>one(i+k)));
 for(let i=0;i<ids.length;i++)results[i]??={id:ids[i],error:'skipped',message:errorMessages.instagram_token_invalid};
 if(stop)await markExpired(svc,user.id,body.account);
 // Units that did not produce an answer (failed media read, failed model call) are given back.
 if(model){const unused=results.filter(r=>r.error).length+failedCalls;if(unused>0)await svc.rpc('builder_ai_release',{p_owner:user.id,p_count:Math.min(unused,ids.length)}).then(()=>{},()=>{})}
 return json({results,ai:{state,remaining,cap:cap()},fields:fieldSpecs(industry),categories});
}

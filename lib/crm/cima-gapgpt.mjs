// Server-only GapGPT adapter. Fixed origin: never accept an admin-entered URL.
import {unseal} from './instagram.js';

export const GAPGPT_BASE_URL='https://api.gapgpt.app/v1';
export const GAPGPT_DEFAULT_MODEL='gpt-4o-mini';
export const GAPGPT_MODELS=Object.freeze(['gpt-4o-mini']);

export async function loadGapGPT(db,{includeDisabled=false}={}){
 const {data,error}=await db.from('sima_ai_provider_settings')
  .select('credential_ciphertext,model,enabled,last_test_status,revision').eq('provider','gapgpt').maybeSingle();
 if(error)throw new Error('GAPGPT_SETTINGS_UNAVAILABLE');
 if(!data||(!includeDisabled&&(!data.enabled||data.last_test_status!=='passed')))return null;
 if(!GAPGPT_MODELS.includes(data.model))throw new Error('GAPGPT_MODEL_UNSUPPORTED');
 const apiKey=unseal(data.credential_ciphertext);
 return {apiKey,model:data.model,revision:data.revision,enabled:data.enabled};
}
export async function gapgptChat({apiKey,model=GAPGPT_DEFAULT_MODEL,messages,maxTokens=350,timeoutMs=12000}){
 if(!GAPGPT_MODELS.includes(model))throw new Error('GAPGPT_MODEL_UNSUPPORTED');
 if(typeof apiKey!=='string'||!apiKey.trim())throw new Error('GAPGPT_KEY_MISSING');
 const response=await fetch(GAPGPT_BASE_URL+'/chat/completions',{
  method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json',Accept:'application/json'},
  body:JSON.stringify({model,messages,max_tokens:Math.min(450,Math.max(5,maxTokens)),temperature:0.1,stream:false}),
  cache:'no-store',signal:AbortSignal.timeout(timeoutMs)
 });
 if(!response.ok){const e=new Error('GAPGPT_UPSTREAM_REJECTED');e.status=response.status;throw e;}
 const payload=await response.json();
 const answer=payload?.choices?.[0]?.message?.content;
 if(typeof answer!=='string'||!answer.trim()||answer.length>2400)throw new Error('GAPGPT_RESPONSE_INVALID');
 return {text:answer.trim(),model};
}
export async function verifyGapGPT(apiKey,model=GAPGPT_DEFAULT_MODEL){
 return gapgptChat({apiKey,model,messages:[
  {role:'system',content:'Reply with only OK.'},{role:'user',content:'OK'}
 ],maxTokens:8,timeoutMs:10000});
}

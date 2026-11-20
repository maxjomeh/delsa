// Site builder <-> Instagram, step 4: finds posts published after the account was connected ("product suggestions") and checks
// already imported posts for edits or deletion. Nothing here creates or changes a product: results only fill the suggestions inbox
// and a notice on imported products. Pure logic with injected dependencies so it is testable without the network or a database.
import {fetchMediaPage,fetchMediaById,InstagramError} from './builder-instagram';
import {loadToken,markExpired} from './builder-instagram-token';
export const MAX_PAGES=2;          // 2 x 24 newest posts per check (the database accepts at most 50 items per call)
export const IMPORT_CHECKS=10;     // imported posts re-read per account per run
export const MIN_USER_GAP_MS=10*60*1000; // a customer opening the panel triggers at most one check per 10 minutes

const norm=v=>String(v||'').replace(/\s+/g,' ').trim();
// Posts newer than `cutoff` (ISO string/ms). Stories never become suggestions (they expire after 24 hours).
export async function collectNew({token,account,cutoff,origin,fetchImpl,maxPages=MAX_PAGES}){
 const since=typeof cutoff==='number'?cutoff:Date.parse(cutoff);
 const found=[];let after='',newest=0;
 for(let page=0;page<maxPages;page++){
  const r=await fetchMediaPage({token,account,kind:'posts',after,origin,fetchImpl});
  let reached=false;
  for(const item of r.items){
   const t=Date.parse(item.timestamp);
   if(!Number.isFinite(t)||item.kind==='story')continue;
   if(Number.isFinite(since)&&t<=since){reached=true;continue}
   newest=Math.max(newest,t);
   found.push({id:item.id,kind:item.kind,caption:item.caption,permalink:item.permalink,posted_at:item.timestamp});
  }
  if(reached||!r.next)break;
  after=r.next;
 }
 return {items:found,newest:newest?new Date(newest).toISOString():null};
}
// Re-reads imported posts. Returns [{id,state:'ok'|'changed'|'deleted',latest}]; a failure of one post never fails the others,
// but an invalid token or rate limit stops the loop (the caller decides what to do with the error).
export async function checkImports({token,imports,origin,fetchImpl}){
 const out=[];
 for(const row of imports){
  try{
   const media=await fetchMediaById({token,id:row.media_id,origin,fetchImpl});
   // Baseline = the caption stored at import time (or the one the customer last accepted with "dismiss").
   out.push(norm(media.caption)!==norm(row.caption)?{id:row.id,state:'changed',latest:media.caption}:{id:row.id,state:'ok',latest:null});
  }catch(e){
   const code=e instanceof InstagramError?e.code:'instagram_unavailable';
   if(code==='instagram_not_found')out.push({id:row.id,state:'deleted',latest:null});
   else if(code==='instagram_token_invalid'||code==='instagram_rate_limited'||code==='instagram_permission')throw Object.assign(new InstagramError(code),{partial:out});
   // instagram_media_unusable / transient errors: leave the row untouched, it is checked again next run.
  }
 }
 return out;
}
// One account, end to end. Returns {suggested,changed,deleted,checked}. Throws InstagramError for token/rate-limit problems
// (an expired token marks the connection as expired exactly like the media route does).
export async function syncAccount({svc,userId,accountRow,origin,seal,unseal,fetchImpl,checkLimit=IMPORT_CHECKS}){
 const state=await svc.rpc('builder_instagram_sync_state',{p_owner:userId,p_account:accountRow});
 if(state.error)throw new InstagramError('instagram_unavailable');
 const st=state.data?.[0];if(!st)return {suggested:0,changed:0,deleted:0,checked:0,skipped:true};
 let token,accountId;
 try{({token,accountId}=await loadToken({svc,userId,accountRow,origin,seal,unseal,fetchImpl}))}
 catch(e){if(e instanceof InstagramError&&e.code==='instagram_token_invalid')await markExpired(svc,userId,accountRow);throw e}
 try{
  const {items,newest}=await collectNew({token,account:accountId,cutoff:st.last_seen_at||st.connected_at,origin,fetchImpl});
  const rec=await svc.rpc('builder_instagram_record_sync',{p_owner:userId,p_account:accountRow,p_seen:newest,p_items:items});
  if(rec.error)throw new InstagramError('instagram_unavailable');
  let checks=[];
  const due=await svc.rpc('builder_instagram_imports_due',{p_owner:userId,p_account:accountRow,p_limit:checkLimit});
  if(!due.error&&Array.isArray(due.data)&&due.data.length){
   try{checks=await checkImports({token,imports:due.data,origin,fetchImpl})}
   catch(e){checks=e.partial||[];if(!(e instanceof InstagramError))throw e;if(e.code==='instagram_token_invalid')throw e}
  }
  for(const c of checks)await svc.rpc('builder_instagram_record_check',{p_owner:userId,p_import:c.id,p_state:c.state,p_latest:c.latest});
  return {suggested:Number(rec.data)||0,changed:checks.filter(c=>c.state==='changed').length,deleted:checks.filter(c=>c.state==='deleted').length,checked:checks.length};
 }catch(e){
  if(e instanceof InstagramError&&e.code==='instagram_token_invalid')await markExpired(svc,userId,accountRow);
  throw e;
 }
}

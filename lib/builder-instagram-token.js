// Loads (and renews when needed) the Instagram access token of one connected account of one owner.
// Shared by the media and import routes; seal/unseal and the service database are injected by the routes.
import {refreshToken,needsRefresh,InstagramError} from './builder-instagram';
export async function loadToken({svc,userId,accountRow,origin,seal,unseal,fetchImpl}){
 const r=await svc.rpc('builder_instagram_token',{p_owner:userId,p_id:accountRow});
 if(r.error)throw new InstagramError('instagram_unavailable');
 const rec=r.data?.[0];if(!rec)throw new InstagramError('instagram_token_invalid');
 let token;try{token=unseal(rec.ciphertext)}catch{throw new InstagramError('instagram_unavailable')}
 if(needsRefresh(rec.expires_at)){
  try{
   const fresh=await refreshToken({token,origin,fetchImpl});
   const stored=await svc.rpc('builder_instagram_store_token',{p_owner:userId,p_id:accountRow,p_ciphertext:seal(fresh.token),p_expires:fresh.expires});
   if(!stored.error&&stored.data)token=fresh.token;
  }catch{
   // A failed renewal only matters once the token has really expired.
   if(Date.parse(rec.expires_at)<=Date.now())throw new InstagramError('instagram_token_invalid');
  }
 }
 return {token,accountId:rec.account_id};
}
export const markExpired=(svc,userId,accountRow)=>svc.rpc('builder_instagram_mark_expired',{p_owner:userId,p_id:accountRow}).then(()=>{},()=>{});

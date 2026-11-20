// Shared authorisation of the site-builder Instagram routes that act on one of the customer's sites with one connected account.
// `db` is the customer's own session client (RLS applies); returns {ok:true,site,row} or {ok:false,status,body}.
export async function requireSiteAccount({db,user,siteId,accountId,messages}){
 const access=await db.rpc('has_site_builder_access');
 if(access.error||!access.data)return {ok:false,status:403,body:{error:'store_access_denied',message:messages.store_access_denied}};
 const [{data:site},{data:row}]=await Promise.all([db.from('builder_sites').select('id,owner_id,draft').eq('id',siteId).maybeSingle(),db.from('builder_instagram_accounts').select('id,status').eq('id',accountId).maybeSingle()]);
 if(!site||site.owner_id!==user.id||!row)return {ok:false,status:404,body:{error:'not_found'}};
 if(row.status!=='connected')return {ok:false,status:401,body:{error:'instagram_token_invalid',message:messages.instagram_token_invalid}};
 return {ok:true,site,row};
}

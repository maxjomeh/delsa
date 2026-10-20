// Read-only, channel-agnostic identity presentation. No invented names/photos.
export function safeSocialImage(url){
 if(typeof url!=='string'||url.length>2048)return null;
 try{
  const parsed=new URL(url);
  if(parsed.protocol!=='https:'||!parsed.hostname||parsed.username||parsed.password)return null;
  return parsed.href;
 }catch{return null;}
}
export function socialProfile(customer){
 const platform=customer?.custom_fields?.social_platform|| (customer?.instagram?'instagram':null);
 const handle=String(customer?.instagram||customer?.custom_fields?.social_username||'').replace(/^@/,'');
 const valid=platform==='instagram'&&/^[A-Za-z0-9._]{1,30}$/.test(handle);
 return {
  platform,handle:handle||null,
  href:valid?'https://www.instagram.com/'+encodeURIComponent(handle)+'/':null,
  avatar:safeSocialImage(customer?.custom_fields?.social_avatar_url)
 };
}

import {createClient} from '@supabase/supabase-js';
import {fetchProduct} from './digikala.mjs';
export function database(){
 const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!key)throw Error('پیکربندی سرور دورپین کامل نشده است.');
 return createClient(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function action(db,user,id,name,body={}){
 const result=await db.rpc('dorpin_monitor_action',{p_user:user,p_id:id,p_action:name,p_body:body});
 if(result.error)throw Error(result.error.message);return result.data;
}
export async function scan(db,user,id){
 const claim=await action(db,user,id,'claim');if(claim.busy)return {busy:true};
 let product;
 try{product=await fetchProduct(claim.dkp);}catch{
  await action(db,user,id,'finish',{token:claim.token,error:'دریافت منبع ناموفق بود؛ داده‌های آخرین بررسی موفق حفظ شده‌اند.'});
  return {failed:true};
 }
 await action(db,user,id,'finish',{token:claim.token,...product});return {ok:true};
}

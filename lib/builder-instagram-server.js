// Server-side helpers shared by the site-builder Instagram routes. Never imported by client components.
import {GRAPH} from './builder-instagram';
// Same app, redirect URI and encryption as the CRM connector; the builder does not need the message webhook settings.
export function builderInstagramConfiguration(origin){
 const callback=process.env.INSTAGRAM_REDIRECT_URI||'';
 let callbackValid=false;try{const u=new URL(callback);callbackValid=u.protocol==='https:'&&u.pathname==='/api/crm/instagram/callback'&&(!origin||u.origin===origin)}catch{}
 const encryption=Buffer.from(process.env.PLATFORM_CREDENTIALS_ENCRYPTION_KEY||'','base64').length===32;
 return {ready:!!(process.env.INSTAGRAM_APP_ID&&process.env.INSTAGRAM_APP_SECRET&&callbackValid&&encryption&&(process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY))};
}
// The Graph origin can only be overridden outside production (tests against a fake Instagram).
export const graphOrigin=()=>process.env.NODE_ENV!=='production'&&process.env.INSTAGRAM_GRAPH_ORIGIN?process.env.INSTAGRAM_GRAPH_ORIGIN:GRAPH;
export const isUuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||''));
export const missingObject=e=>/PGRST202|PGRST205|42883|42P01|does not exist|Could not find/i.test(String(e?.code||'')+' '+String(e?.message||''));

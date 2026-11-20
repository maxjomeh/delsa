const ts=require('typescript'),fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..');
function load(file,mocks={},globals={}){const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{fileName:'test.tsx',compilerOptions:{esModuleInterop:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,require:n=>mocks[n]||require(n),console,String,Number,Array,Object,JSON,Set,Map,Math,RegExp,Promise,Error,Date,URL,URLSearchParams,AbortSignal,Buffer,process,encodeURIComponent,decodeURIComponent,Intl,Uint8Array,...globals},{});return module.exports}
const UID='11111111-1111-1111-1111-111111111111',ACC='33333333-3333-3333-3333-333333333333',ACC2='44444444-4444-4444-4444-444444444444';
const SECRET='s'.repeat(40);
const state={user:{id:UID},access:true,account:{id:ACC,status:'connected',last_checked_at:null},due:{data:[],error:null},syncImpl:null,updateError:null};
const calls={sync:[],updates:[],rpc:[],mark:[]};
class InstagramError extends Error{constructor(c){super(c);this.code=c}}
const json=(body,init={})=>({body,status:init.status||200});
const q=(rows)=>{const t={f:{},select(){return t},eq(k,v){t.f[k]=v;return t},in(k,v){t.f[k]=v;return t},maybeSingle:async()=>({data:rows(),error:null})};return t};
const userDb={auth:{getUser:async()=>({data:{user:state.user}})},rpc:async n=>n==='has_site_builder_access'?{data:state.access,error:null}:{data:null,error:{message:'x'}},
 from:t=>t==='builder_instagram_accounts'?q(()=>state.account):{update(v){const u={v,f:{}};calls.updates.push(u);const c={eq(k,x){u.f[k]=x;return c},in(k,x){u.f[k]=x;return c},then(res,rej){return Promise.resolve({error:state.updateError}).then(res,rej)}};return c}}};
const svc={rpc:async(n,a)=>{calls.rpc.push([n,a]);return n==='builder_instagram_due_accounts'?state.due:{data:null,error:null}}};
const lib={InstagramError,errorMessages:{store_access_denied:'x',instagram_token_invalid:'tok',instagram_unavailable:'unavail'}};
const syncLib={MIN_USER_GAP_MS:600000,syncAccount:async o=>{calls.sync.push(o.accountRow);if(state.syncImpl)return state.syncImpl(o);return {suggested:1,changed:0,deleted:0,checked:0}}};
const mocks={'next/server':{NextResponse:{json}},'node:crypto':crypto,'../../../../../lib/supabase/server':{createClient:async()=>userDb},'../../../../../lib/crm/instagram':{seal:v=>v,unseal:v=>v,serverDatabase:()=>svc},'../../../../../lib/builder-instagram':lib,'../../../../../lib/builder-instagram-sync':syncLib,'../../../../../lib/builder-instagram-server':{graphOrigin:()=>'https://graph.instagram.com',isUuid:v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||'')),missingObject:e=>/does not exist/.test(String(e?.message))}};
const env={};const route=load('app/api/builder/instagram/sync/route.js',mocks,{process:{env}});
const O='https://delsaai.ir';
const get=auth=>({url:O+'/api/builder/instagram/sync',headers:{get:h=>h.toLowerCase()==='authorization'?auth:null}});
const post=(body,origin=O)=>({url:O+'/api/builder/instagram/sync',headers:{get:h=>h.toLowerCase()==='origin'?origin:null},json:async()=>body});
const reset=()=>{for(const k of Object.keys(calls))calls[k].length=0;state.user={id:UID};state.access=true;state.account={id:ACC,status:'connected',last_checked_at:null};state.due={data:[],error:null};state.syncImpl=null;state.updateError=null;env.BUILDER_INSTAGRAM_CRON_SECRET=SECRET};

(async()=>{
 // ---- scheduled run: secret required, constant-time, never open when unset
 reset();delete env.BUILDER_INSTAGRAM_CRON_SECRET;assert.equal((await route.GET(get('Bearer '+SECRET))).status,503,'without a configured secret the endpoint stays closed');
 reset();for(const bad of [null,'','Bearer','Bearer wrong','Bearer '+SECRET.slice(1),'Bearer '+SECRET+'x',SECRET.toUpperCase()])assert.equal((await route.GET(get(bad))).status,401);
 env.BUILDER_INSTAGRAM_CRON_SECRET='short';assert.equal((await route.GET(get('Bearer short'))).status,401,'a short secret is never accepted');
 reset();assert.equal(calls.rpc.length,0);
 // ---- walks the due accounts, aggregates, survives one failing account
 reset();state.due={data:[{id:ACC,owner_id:UID},{id:ACC2,owner_id:'55555555-5555-5555-5555-555555555555'},{id:'66666666-6666-6666-6666-666666666666',owner_id:UID}],error:null};
 state.syncImpl=async o=>{if(o.accountRow===ACC2)throw new InstagramError('instagram_unavailable');return {suggested:2,changed:1,deleted:0,checked:1}};
 let res=await route.GET(get('Bearer '+SECRET));assert.equal(res.status,200);assert.deepEqual(JSON.parse(JSON.stringify(res.body)),{ok:true,accounts:2,suggested:4,changed:2,deleted:0,failed:1});assert.deepEqual(calls.sync.length,3);
 // rate limit stops the run
 reset();state.due={data:[{id:ACC,owner_id:UID},{id:ACC2,owner_id:UID}],error:null};state.syncImpl=async()=>{throw new InstagramError('instagram_rate_limited')};res=await route.GET(get('Bearer '+SECRET));assert.equal(calls.sync.length,1,'stops after Instagram asks to slow down');assert.equal(res.body.failed,1);
 // tables missing -> quiet no-op, other DB errors -> 503
 reset();state.due={data:null,error:{message:'function does not exist'}};res=await route.GET(get('Bearer '+SECRET));assert.deepEqual([res.status,res.body.installed],[200,false]);
 reset();state.due={data:null,error:{message:'boom'}};assert.equal((await route.GET(get('Bearer '+SECRET))).status,503);

 // ---- customer-triggered check
 reset();assert.equal((await route.POST(post({account:ACC},'https://evil.com'))).status,403);
 state.user=null;assert.equal((await route.POST(post({account:ACC}))).status,401);reset();
 state.access=false;assert.equal((await route.POST(post({account:ACC}))).status,403);reset();
 assert.equal((await route.POST(post({account:'nope'}))).status,400);
 state.account=null;assert.equal((await route.POST(post({account:ACC}))).status,404,'RLS hides other owners accounts');reset();
 state.account={id:ACC,status:'expired',last_checked_at:null};assert.equal((await route.POST(post({account:ACC}))).status,401);reset();
 assert.equal(calls.sync.length,0,'nothing ran for rejected requests');
 res=await route.POST(post({account:ACC}));assert.deepEqual(JSON.parse(JSON.stringify(res.body)),{suggested:1,changed:0,deleted:0,checked:0});assert.equal(calls.sync.length,1);
 reset();state.account={id:ACC,status:'connected',last_checked_at:new Date(Date.now()-60000).toISOString()};res=await route.POST(post({account:ACC}));assert.equal(res.body.skipped,true);assert.equal(calls.sync.length,0,'checked a minute ago -> not again');
 reset();state.account={id:ACC,status:'connected',last_checked_at:new Date(Date.now()-3600000).toISOString()};res=await route.POST(post({account:ACC}));assert.equal(calls.sync.length,1);
 reset();state.syncImpl=async()=>{throw new InstagramError('instagram_token_invalid')};res=await route.POST(post({account:ACC}));assert.deepEqual([res.status,res.body.error],[401,'instagram_token_invalid']);
 reset();state.syncImpl=async()=>{throw new Error('weird internals with TOKEN')};res=await route.POST(post({account:ACC}));assert.equal(res.status,502);assert(!JSON.stringify(res.body).includes('TOKEN'),'unexpected errors never leak details');

 // ---- dismissing suggestions
 reset();res=await route.POST(post({action:'dismiss',account:ACC,ids:['18000000000001','18000000000002']}));assert.equal(res.status,200);
 assert.deepEqual(JSON.parse(JSON.stringify(calls.updates[0])),{v:{status:'dismissed'},f:{account_row:ACC,media_id:['18000000000001','18000000000002'],status:'new'}},'only new->dismissed on the given account');
 for(const bad of [{ids:[]},{ids:['x']},{ids:['1'],account:'zzz'},{ids:Array.from({length:101},(_,i)=>String(i+1))},{ids:'1'}])assert.equal((await route.POST(post({action:'dismiss',account:ACC,...bad}))).status,400);
 reset();state.updateError={message:'x'};assert.equal((await route.POST(post({action:'dismiss',account:ACC,ids:['1']}))).status,503);
 console.log('PASS: Instagram sync route (cron secret, rate limits, owner isolation, dismiss, no leaks)');
})().catch(e=>{console.error(e);process.exit(1)});

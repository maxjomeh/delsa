const ts=require('typescript'),fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'../..');
function load(file,mocks={},globals={}){const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{fileName:'test.tsx',compilerOptions:{esModuleInterop:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,require:n=>mocks[n]||require(n),console,String,Number,Array,Object,JSON,Set,Map,Math,RegExp,Promise,Error,Date,URL,URLSearchParams,AbortSignal,Buffer,process,encodeURIComponent,decodeURIComponent,Intl,Uint8Array,...globals},{});return module.exports}
const UID='11111111-1111-1111-1111-111111111111',ACC='33333333-3333-3333-3333-333333333333',SITE='22222222-2222-2222-2222-222222222222';
const CDN='https://scontent.cdninstagram.com/x.jpg';
const state={suggestions:[],graphError:null,imports:[],suggestError:null,expires:new Date(Date.now()+50*86400000).toISOString()};
const calls={updates:[],fetches:[]};
const fakeFetch=async url=>{const u=new URL(String(url));calls.fetches.push(u.pathname);if(u.pathname==='/refresh_access_token')return {ok:true,status:200,json:async()=>({access_token:'F',expires_in:5184000})};
 if(state.graphError)return {ok:false,status:400,json:async()=>({error:state.graphError})};
 const id=u.pathname.slice(1);if(id==='18000000000003')return {ok:false,status:400,json:async()=>({error:{code:100,error_subcode:33,message:'does not exist'}})};
 return {ok:true,status:200,json:async()=>({id,caption:'کپشن '+id,media_type:'IMAGE',media_url:CDN,permalink:'https://www.instagram.com/p/'+id+'/',timestamp:id.endsWith('1')?'2026-11-01T10:00:00+0000':'2026-11-05T10:00:00+0000'})}};
const lib=load('lib/builder-instagram.js',{},{fetch:fakeFetch});
const tokenLib=load('lib/builder-instagram-token.js',{'./builder-instagram':lib},{fetch:fakeFetch});
const svc={rpc:async n=>n==='builder_instagram_token'?{data:[{account_id:'1784',username:'s',ciphertext:'enc:TOK',expires_at:state.expires}],error:null}:{data:null,error:null}};
const json=(body,init={})=>({body,status:init.status||200,headers:{}});
const db={auth:{getUser:async()=>({data:{user:{id:UID}}})},rpc:async()=>({data:true,error:null}),from:t=>{const q={f:{},select(){return q},eq(k,v){q.f[k]=v;return q},in(k,v){q.f[k]=v;return q},order(){return q},limit(){return Promise.resolve(t==='builder_instagram_suggestions'?(state.suggestError?{data:null,error:state.suggestError}:{data:state.suggestions,error:null}):{data:null,error:null})},maybeSingle:async()=>({data:t==='builder_instagram_accounts'?{id:ACC,username:'s',status:'connected'}:null}),
 update(v){const u={t,v,f:{}};calls.updates.push(u);const c={eq(k,x){u.f[k]=x;return c},in(k,x){u.f[k]=x;return c},then(res,rej){return Promise.resolve({error:null}).then(res,rej)}};return c},
 then(res,rej){return Promise.resolve({data:t==='builder_instagram_imports'?state.imports:[],error:null}).then(res,rej)}};return q}};
const mocks={'next/server':{NextResponse:{json}},'../../../../../lib/supabase/server':{createClient:async()=>db},'../../../../../lib/crm/instagram':{seal:v=>v,unseal:v=>String(v).replace(/^enc:/,''),serverDatabase:()=>svc},'../../../../../lib/builder-instagram':lib,'../../../../../lib/builder-instagram-token':tokenLib,'../../../../../lib/builder-instagram-server':{graphOrigin:()=>'https://graph.instagram.com',isUuid:v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||'')),missingObject:e=>/PGRST205/.test(String(e?.code))}};
const route=load('app/api/builder/instagram/media/route.js',mocks);
const get=q=>route.GET({url:'https://delsaai.ir/api/builder/instagram/media?'+q,headers:{get:()=>null}});
const reset=()=>{calls.updates.length=0;calls.fetches.length=0;state.suggestions=[{media_id:'18000000000001'},{media_id:'18000000000002'},{media_id:'18000000000003'}];state.graphError=null;state.imports=[];state.suggestError=null};
(async()=>{
 reset();let res=await get(`account=${ACC}&kind=new&site=${SITE}`);
 assert.equal(res.status,200);assert.deepEqual(res.body.items.map(i=>i.id),['18000000000002','18000000000001'],'fresh thumbnails by id, newest first, deleted one dropped');assert.equal(res.body.next,null);
 assert.deepEqual(JSON.parse(JSON.stringify(calls.updates)),[{t:'builder_instagram_suggestions',v:{status:'dismissed'},f:{account_row:ACC,media_id:['18000000000003'],status:'new'}}],'a post deleted on Instagram leaves the inbox');
 assert(res.body.items.every(i=>i.thumbnail.startsWith('https://')&&!JSON.stringify(i).includes('TOK')));
 // already imported into this site -> marked
 reset();state.imports=[{media_id:'18000000000001',product_id:'p1'}];res=await get(`account=${ACC}&kind=new&site=${SITE}`);assert.deepEqual(res.body.items.map(i=>[i.id,!!i.imported]),[['18000000000002',false],['18000000000001',true]]);
 // empty inbox -> no Instagram calls beyond token
 reset();state.suggestions=[];res=await get(`account=${ACC}&kind=new`);assert.deepEqual([res.status,res.body.items.length],[200,0]);assert(!calls.fetches.some(p=>/^\/\d+$/.test(p)));
 // token/rate-limit problems surface as errors instead of silently dropping the inbox
 reset();state.graphError={code:190};res=await get(`account=${ACC}&kind=new`);assert.equal(res.status,401);assert.equal(calls.updates.filter(u=>u.t==='builder_instagram_suggestions').length,0,'nothing dismissed on token errors');
 reset();state.graphError={code:4};res=await get(`account=${ACC}&kind=new`);assert.equal(res.status,429);
 // missing sync migration
 reset();state.suggestError={code:'PGRST205',message:'x'};res=await get(`account=${ACC}&kind=new`);assert.equal(res.status,503);
 // other kinds still read the regular media list
 reset();res=await get(`account=${ACC}&kind=posts`);assert.equal(res.status,200);assert(calls.fetches.includes('/me/media'));
 console.log('PASS: Instagram new-posts listing (fresh thumbnails, deleted posts dropped, imported marked, error handling)');
})().catch(e=>{console.error(e);process.exit(1)});

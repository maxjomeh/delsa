const ts=require('typescript'),fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'../..');
function load(file,mocks={},globals={}){const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{fileName:'test.tsx',compilerOptions:{esModuleInterop:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,require:n=>mocks[n]||require(n),console,String,Number,Array,Object,JSON,Set,Map,Math,RegExp,Promise,Error,Date,URL,URLSearchParams,AbortSignal,Buffer,process,encodeURIComponent,decodeURIComponent,Intl,Uint8Array,...globals},{});return module.exports}
const cdn='https://scontent.cdninstagram.com/';
const jpeg=()=>Buffer.concat([Buffer.from([0xff,0xd8,0xff,0xe0]),Buffer.alloc(64,1)]);
const mp4=()=>Buffer.concat([Buffer.alloc(4),Buffer.from('ftypisom'),Buffer.alloc(64)]);
const UID='11111111-1111-1111-1111-111111111111',SITE='22222222-2222-2222-2222-222222222222',ACC='33333333-3333-3333-3333-333333333333';
const state={user:{id:UID},access:true,site:{id:SITE,owner_id:UID},account:{id:ACC,status:'connected'},imports:[],quota:0,expires:new Date(Date.now()+50*86400000).toISOString(),tokenRow:true,saveError:null,recordError:null};
const calls={rpc:[],uploads:[],removed:[],deleted:[],saved:[],fetches:[]};
const media={'17900000000001':{id:'17900000000001',caption:'کیف چرم #چرم\nقیمت ۹۸۰ هزار تومان',media_type:'IMAGE',media_url:cdn+'a.jpg',permalink:'https://www.instagram.com/p/A/',timestamp:'2026-11-01T10:00:00+0000'},
 '17900000000002':{id:'17900000000002',caption:'ریلز',media_type:'VIDEO',media_product_type:'REELS',media_url:cdn+'v.mp4',thumbnail_url:cdn+'t.jpg',permalink:'https://www.instagram.com/reel/B/',timestamp:'2026-11-02T10:00:00+0000'},
 '17900000000003':{id:'17900000000003',caption:'خراب',media_type:'IMAGE',media_url:cdn+'broken.jpg',permalink:'https://www.instagram.com/p/C/',timestamp:'2026-11-03T10:00:00+0000'}};
const fakeFetch=async(url,opts={})=>{
 const u=new URL(String(url));calls.fetches.push(String(url));
 if(u.hostname==='graph.instagram.com'){
  if(u.pathname==='/refresh_access_token')return {ok:true,status:200,json:async()=>({access_token:'FRESH',expires_in:5184000})};
  const id=u.pathname.slice(1);if(state.graphError)return {ok:false,status:400,json:async()=>({error:{code:state.graphError}})};
  return media[id]?{ok:true,status:200,json:async()=>media[id]}:{ok:false,status:400,json:async()=>({error:{code:100,message:'Unsupported get request'}})};
 }
 if(u.hostname.endsWith('cdninstagram.com')){if(u.pathname==='/broken.jpg')return {ok:false,status:404,headers:{get:()=>null}};const b=u.pathname.endsWith('.mp4')?mp4():jpeg();return {ok:true,status:200,headers:{get:()=>String(b.length)},arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)}}
 throw new Error('unexpected host '+u.hostname);
};
const libNet=load('lib/builder-instagram.js',{},{fetch:fakeFetch});
const tokenLib=load('lib/builder-instagram-token.js',{'./builder-instagram':libNet},{fetch:fakeFetch});
const importLib=load('lib/builder-instagram-import.js',{'./builder-instagram':libNet},{fetch:fakeFetch});
const json=(body,init={})=>({body,status:init.status||200,headers:init.headers||{}});
const query=(rows)=>{const q={f:{},select(){return q},eq(k,v){q.f[k]=v;return q},in(k,v){q.f[k]=v;return q},maybeSingle:async()=>({data:rows(q.f)}),then(res,rej){return Promise.resolve({data:rows(q.f)||[],error:null}).then(res,rej)}};return q};
const userDb={auth:{getUser:async()=>({data:{user:state.user}})},
 rpc:async(n,a)=>{if(n==='has_site_builder_access')return {data:state.access,error:null};if(n==='save_builder_product'){calls.saved.push(a);return state.saveError?{data:null,error:state.saveError}:{data:'prod-'+a.p_document.slug,error:null}}return {data:null,error:{message:'x'}}},
 from:t=>t==='builder_sites'?query(()=>state.site):t==='builder_instagram_accounts'?query(()=>state.account):query(f=>state.imports.filter(i=>(f.media_id||[]).includes(i.media_id)))};
const svc={rpc:async(n,a)=>{calls.rpc.push([n,a]);
  if(n==='builder_instagram_token')return {data:state.tokenRow?[{account_id:'1784',username:'shop',ciphertext:'enc:TOK',expires_at:state.expires}]:[],error:null};
  if(n==='builder_site_media_bytes')return {data:state.quota,error:null};
  if(n==='builder_instagram_record_import')return state.recordError?{data:null,error:state.recordError}:{data:'rec',error:null};
  if(n==='builder_instagram_store_token')return {data:true,error:null};return {data:null,error:null}},
 storage:{from:b=>({upload:async(p,buf,o)=>{calls.uploads.push([b,p,o.contentType,buf.length]);return {error:null}},getPublicUrl:p=>({data:{publicUrl:'https://store.example/'+b+'/'+p}}),remove:async paths=>{calls.removed.push([b,paths]);return {}}})},
 from:t=>({delete:()=>({eq:(k,v)=>({eq:(k2,v2)=>{calls.deleted.push([t,v,v2]);return Promise.resolve({})}})})})};
const server={seal:v=>'enc:'+v,unseal:v=>String(v).replace(/^enc:/,''),serverDatabase:()=>svc};
const cfg={graphOrigin:()=>'https://graph.instagram.com',isUuid:v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||''))};
const mocks={'next/server':{NextResponse:{json}},'../../../../../lib/supabase/server':{createClient:async()=>userDb},'../../../../../lib/crm/instagram':server,'../../../../../lib/builder-instagram':libNet,'../../../../../lib/builder-instagram-token':tokenLib,'../../../../../lib/builder-instagram-import':importLib,'../../../../../lib/builder-instagram-server':cfg};
const route=load('app/api/builder/instagram/import/route.js',mocks);
const O='https://delsaai.ir';
const req=(body,origin=O)=>({url:O+'/api/builder/instagram/import',headers:{get:h=>h.toLowerCase()==='origin'?origin:null},json:async()=>body});
const reset=()=>{for(const k of Object.keys(calls))calls[k].length=0;state.user={id:UID};state.access=true;state.site={id:SITE,owner_id:UID};state.account={id:ACC,status:'connected'};state.imports=[];state.quota=0;state.expires=new Date(Date.now()+50*86400000).toISOString();state.tokenRow=true;state.saveError=null;state.recordError=null;state.graphError=null};
const post=(ids,over={})=>route.POST(req({account:ACC,site:SITE,ids,...over}));

(async()=>{
 // ---- request validation and authorisation
 reset();
 assert.equal((await route.POST(req({account:ACC,site:SITE,ids:['17900000000001']},'https://evil.com'))).status,403,'same-origin only');
 assert.equal((await post(['17900000000001'],{account:'nope'})).status,400);assert.equal((await post(['17900000000001'],{site:'nope'})).status,400);
 assert.equal((await post([])).status,400);assert.equal((await post(['abc'])).status,400,'ids must be numeric');assert.equal((await post(['1','2','3','4'])).status,400,'at most 3 per request');
 state.user=null;assert.equal((await post(['17900000000001'])).status,401);reset();
 state.access=false;assert.equal((await post(['17900000000001'])).status,403);reset();
 state.site={id:SITE,owner_id:'99999999-9999-9999-9999-999999999999'};assert.equal((await post(['17900000000001'])).status,404,'only the owner of the site can import into it');reset();
 state.site=null;assert.equal((await post(['17900000000001'])).status,404);reset();
 state.account=null;assert.equal((await post(['17900000000001'])).status,404,'another owner\'s Instagram account is invisible');reset();
 state.account={id:ACC,status:'expired'};let res=await post(['17900000000001']);assert.equal(res.status,401);assert.equal(res.body.error,'instagram_token_invalid');reset();
 state.quota=1024*1024*1024;res=await post(['17900000000001']);assert.equal(res.status,409);assert.equal(res.body.error,'storage_full');assert.equal(calls.uploads.length,0,'a full site stores nothing');reset();
 state.tokenRow=false;res=await post(['17900000000001']);assert.equal(res.status,401);assert(calls.rpc.some(c=>c[0]==='builder_instagram_mark_expired'),'a missing token marks the account expired');reset();

 // ---- a normal import: image + reel, creates draft products through the owner's session
 res=await post(['17900000000001','17900000000002']);
 assert.equal(res.status,200);assert.deepEqual(res.body.results.map(r=>[r.id,r.status]),[['17900000000001','created'],['17900000000002','created']]);
 assert.deepEqual([res.body.results[0].images,res.body.results[0].videos,res.body.results[1].images,res.body.results[1].videos],[1,0,1,1]);
 assert.equal(calls.saved.length,2);assert.equal(calls.saved[0].p_site,SITE);assert.equal(calls.saved[0].p_product,null);assert.equal(calls.saved[0].p_document.status,'draft');assert.equal(calls.saved[0].p_document.title,'کیف چرم');assert.equal(calls.saved[0].p_variants[0].price,0);
 assert.deepEqual(calls.uploads.map(u=>u[0]+'/'+u[1].replace(SITE,'<site>')),['builder-product-images/<site>/ig-17900000000001-0.jpg','builder-product-images/<site>/ig-17900000000002-0.jpg','builder-product-videos/<site>/ig-17900000000002-v0.mp4']);
 assert(calls.uploads.every(u=>u[2]==='image/jpeg'||u[2]==='video/mp4'),'content types come from the file bytes');
 const rec=calls.rpc.filter(c=>c[0]==='builder_instagram_record_import');assert.equal(rec.length,2);assert.equal(rec[0][1].p_owner,UID);assert.equal(rec[0][1].p_account,ACC);assert.equal(rec[0][1].p_media,'17900000000001');assert.equal(rec[0][1].p_kind,'image');assert.equal(rec[1][1].p_kind,'reel');assert.equal(rec[1][1].p_videos.length,1);assert.equal(rec[0][1].p_permalink,'https://www.instagram.com/p/A/');
 assert(!JSON.stringify(res.body).includes('TOK'),'tokens never reach the browser');
 assert(calls.fetches.every(u=>!u.includes('TOK')),'the token is never put in a URL');

 // ---- duplicates are skipped without touching Instagram or storage
 reset();state.imports=[{media_id:'17900000000001',product_id:'old-prod'}];res=await post(['17900000000001','17900000000002']);
 assert.deepEqual(res.body.results.map(r=>[r.id,r.status,r.productId||'']),[['17900000000001','duplicate','old-prod'],['17900000000002','created','prod-ig-17900000000002']]);assert(!calls.fetches.some(u=>u.includes('/17900000000001')),'an imported item is not read again');

 // ---- partial failures stay per item
 reset();res=await post(['17900000000003','17900000000001']);
 assert.deepEqual(res.body.results.map(r=>[r.id,r.status,r.error||'']),[['17900000000003','failed','no_image'],['17900000000001','created','']],'one broken item does not stop the batch');assert.equal(calls.saved.length,1,'nothing is saved for the broken item');
 reset();res=await post(['99999999999999']);assert.equal(res.body.results[0].status,'failed','unknown media ids fail cleanly');
 reset();state.saveError={code:'23505',message:'duplicate key'};res=await post(['17900000000001']);assert.equal(res.body.results[0].status,'duplicate','a slug collision is reported as already imported');assert(calls.removed.length>0,'files of a failed save are removed');
 reset();state.saveError={code:'P0001',message:'store_access_denied'};res=await post(['17900000000001']);assert.equal(res.body.results[0].error,'save_failed');
 reset();state.recordError={message:'builder_instagram_duplicate'};res=await post(['17900000000001']);assert.equal(res.body.results[0].status,'duplicate');assert.deepEqual(calls.deleted.map(d=>d[0]),['builder_products'],'the product is removed when it cannot be recorded');
 // Instagram rejects the token: the account is marked expired and the rest of the batch is not attempted
 reset();state.graphError=190;res=await post(['17900000000001','17900000000002']);assert.deepEqual(res.body.results.map(r=>r.status),['failed','failed']);assert(calls.rpc.some(c=>c[0]==='builder_instagram_mark_expired'));assert.equal(calls.saved.length,0);
 console.log('PASS: Instagram import route (authorisation, quota, duplicates, per-item failures, cleanup, token secrecy)');
})().catch(e=>{console.error(e);process.exit(1)});

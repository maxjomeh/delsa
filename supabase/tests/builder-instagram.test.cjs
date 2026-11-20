const ts=require('typescript'),fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'../..');
function load(file,mocks={},globals={}){const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{fileName:'test.tsx',compilerOptions:{esModuleInterop:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,require:n=>mocks[n]||require(n),console,String,Number,Array,Object,JSON,Set,Map,Math,RegExp,Promise,Error,Date,URL,URLSearchParams,AbortSignal,Buffer,process,encodeURIComponent,decodeURIComponent,Intl,...globals},{});return module.exports}
const lib=load('lib/builder-instagram.js');
const ok=(v,m)=>assert(v,m);

(async()=>{
 // ---- safe URLs: only https on Instagram/Facebook CDNs
 ok(lib.safeMediaUrl('https://scontent-fra5-1.cdninstagram.com/v/t51/a.jpg?x=1').startsWith('https://scontent'),'cdninstagram accepted');
 ok(lib.safeMediaUrl('https://scontent.xx.fbcdn.net/a.jpg'),'fbcdn accepted');
 for(const bad of ['http://scontent.cdninstagram.com/a.jpg','https://evil.com/a.jpg','https://cdninstagram.com.evil.com/a.jpg','https://u:p@scontent.cdninstagram.com/a.jpg','javascript:alert(1)','','//cdninstagram.com/a.jpg',null])assert.equal(lib.safeMediaUrl(bad),'',String(bad));
 assert.equal(lib.safePermalink('https://www.instagram.com/p/ABC123/?utm=1'),'https://www.instagram.com/p/ABC123/');assert.equal(lib.safePermalink('https://evil.com/p/x'),'');assert.equal(lib.safePermalink('http://instagram.com/p/x'),'');

 // ---- classification and normalisation
 assert.equal(lib.mediaKind({media_type:'IMAGE'}),'image');assert.equal(lib.mediaKind({media_type:'VIDEO'}),'video');assert.equal(lib.mediaKind({media_type:'VIDEO',media_product_type:'REELS'}),'reel');assert.equal(lib.mediaKind({media_type:'CAROUSEL_ALBUM'}),'carousel');assert.equal(lib.mediaKind({media_type:'IMAGE'},{story:true}),'story');
 const cdn='https://scontent.cdninstagram.com/';
 const img=lib.normalizeMedia({id:'1789',caption:'کیف چرم\nقیمت ۹۸۰ هزار تومان #کیف',media_type:'IMAGE',media_url:cdn+'a.jpg',permalink:'https://www.instagram.com/p/AAA/',timestamp:'2026-11-01T10:00:00+0000'});
 assert.equal(img.kind,'image');assert.equal(img.thumbnail,cdn+'a.jpg');assert.equal(img.videoUrl,'');assert.equal(img.permalink,'https://www.instagram.com/p/AAA/');assert.equal(img.timestamp,'2026-11-01T10:00:00.000Z');assert.match(img.caption,/کیف چرم/);
 const reel=lib.normalizeMedia({id:'2',media_type:'VIDEO',media_product_type:'REELS',media_url:cdn+'v.mp4',thumbnail_url:cdn+'t.jpg',permalink:'https://instagram.com/reel/R/'});
 assert.equal(reel.kind,'reel');assert.equal(reel.video,true);assert.equal(reel.videoUrl,cdn+'v.mp4');assert.equal(reel.thumbnail,cdn+'t.jpg');
 const car=lib.normalizeMedia({id:'3',media_type:'CAROUSEL_ALBUM',media_url:cdn+'c0.jpg',children:{data:[{id:'31',media_type:'IMAGE',media_url:cdn+'c1.jpg'},{id:'32',media_type:'VIDEO',media_url:cdn+'c2.mp4',thumbnail_url:cdn+'c2.jpg'},{id:'bad id',media_type:'IMAGE',media_url:cdn+'x.jpg'},{id:'33',media_type:'IMAGE',media_url:'https://evil.com/x.jpg'}]}});
 assert.equal(car.kind,'carousel');assert.deepEqual(car.children.map(c=>[c.id,c.type]),[['31','image'],['32','video']],'invalid ids and foreign hosts are dropped');assert.equal(car.children[1].thumbnail,cdn+'c2.jpg');
 assert.equal(lib.normalizeMedia({id:'4',media_type:'VIDEO',media_url:cdn+'v.mp4'}),null,'a video without any safe thumbnail is unusable');
 assert.equal(lib.normalizeMedia({id:'x',media_type:'IMAGE',media_url:cdn+'a.jpg'}),null,'ids must be numeric');assert.equal(lib.normalizeMedia(null),null);assert.equal(lib.normalizeMedia({id:'5',media_type:'IMAGE',media_url:'https://evil.com/a.jpg'}),null);
 assert.equal(lib.normalizeMedia({id:'6',media_type:'IMAGE',media_url:cdn+'a.jpg',caption:'x'.repeat(5000)}).caption.length,2200,'captions are bounded');
 assert.equal(lib.normalizeMedia({id:'7',media_type:'IMAGE',media_url:cdn+'a.jpg'},{story:true}).kind,'story');

 // ---- fetching a page: request shape, cursor, stories, errors
 const calls=[];
 const fetchOk=(body,status=200)=>async(url,opts)=>{calls.push({url:String(url),opts});return {ok:status<400,status,json:async()=>body}};
 let page=await lib.fetchMediaPage({token:'TOK',account:'1784',fetchImpl:fetchOk({data:[{id:'1',media_type:'IMAGE',media_url:cdn+'a.jpg'},{id:'x'},{id:'2',media_type:'IMAGE',media_url:'https://evil.com/a'}],paging:{cursors:{after:'CUR1'},next:'https://graph.instagram.com/next'}})});
 const u=new URL(calls[0].url);assert.equal(u.origin+u.pathname,'https://graph.instagram.com/me/media');assert.equal(u.searchParams.get('limit'),'24');assert.match(u.searchParams.get('fields'),/media_product_type/);assert.equal(calls[0].opts.headers.Authorization,'Bearer TOK');assert(!calls[0].url.includes('TOK'),'the token travels in a header, never in the URL');
 assert.deepEqual(page.items.map(i=>i.id),['1']);assert.equal(page.next,'CUR1');
 page=await lib.fetchMediaPage({token:'T',account:'1784',after:'CUR1',limit:500,fetchImpl:fetchOk({data:[],paging:{cursors:{after:'C'}}})});
 assert.equal(new URL(calls[1].url).searchParams.get('after'),'CUR1');assert.equal(new URL(calls[1].url).searchParams.get('limit'),'50','limit is capped');assert.equal(page.next,null,'no next link -> no cursor');
 await lib.fetchMediaPage({token:'T',account:'1784',after:'../../etc',fetchImpl:fetchOk({data:[]})});assert(!new URL(calls[2].url).searchParams.has('after'),'malformed cursors are ignored');
 page=await lib.fetchMediaPage({token:'T',account:'1784',kind:'stories',fetchImpl:fetchOk({data:[{id:'9',media_type:'IMAGE',media_url:cdn+'s.jpg'}],paging:{cursors:{after:'X'},next:'y'}})});
 assert.equal(new URL(calls[3].url).pathname,'/1784/stories');assert.equal(page.items[0].kind,'story');assert.equal(page.next,null,'stories are not paged');
 const code=async(body,status)=>{try{await lib.fetchMediaPage({token:'T',account:'1',fetchImpl:fetchOk(body,status)});return 'none'}catch(e){return e.code}};
 assert.equal(await code({error:{code:190,message:'Invalid OAuth access token'}},400),'instagram_token_invalid');assert.equal(await code({error:{code:10}},400),'instagram_permission');assert.equal(await code({error:{code:4}},400),'instagram_rate_limited');assert.equal(await code({error:{code:2}},500),'instagram_unavailable');assert.equal(await code({},429),'instagram_rate_limited');
 try{await lib.fetchMediaPage({token:'T',account:'1',fetchImpl:async()=>{throw new Error('offline')}});assert.fail('x')}catch(e){assert.equal(e.code,'instagram_unavailable')}
 try{await lib.fetchMediaPage({token:'',account:'1'});assert.fail('x')}catch(e){assert.equal(e.code,'instagram_token_invalid')}

 // ---- token renewal
 const now=Date.parse('2026-11-20T00:00:00Z');
 assert.equal(lib.needsRefresh('2026-12-30T00:00:00Z',now),false);assert.equal(lib.needsRefresh('2026-12-05T00:00:00Z',now),true);assert.equal(lib.needsRefresh('2026-11-01T00:00:00Z',now),true);assert.equal(lib.needsRefresh('garbage',now),false);
 let r=await lib.refreshToken({token:'OLD',fetchImpl:fetchOk({access_token:'NEW',expires_in:5184000})});assert.equal(r.token,'NEW');assert(Date.parse(r.expires)>Date.now()+50*86400000);
 for(const bad of [{error:{code:190}},{access_token:'N'},{access_token:'N',expires_in:0}]){try{await lib.refreshToken({token:'T',fetchImpl:fetchOk(bad)});assert.fail('x')}catch(e){assert(e.code,'refresh failure carries a code')}}

 // ---- route handlers (mocked session, database and Instagram)
 const json=(body,init={})=>({body,status:init.status||200,headers:init.headers||{},cookies:{set(n,v,o){this.last={n,v,o}}}});
 const NextResponse={json,redirect:u=>({redirect:String(u),cookies:{set(){}},headers:{set(){}}})};
 const sealed=v=>'enc:'+v;const server={seal:sealed,unseal:v=>String(v).replace(/^enc:/,''),serverDatabase:()=>svc,instagramAuthorization:(s,scope)=>'https://www.instagram.com/oauth/authorize?scope='+scope+'&state='+s,instagramConfiguration:()=>({ready:true})};
 const state={user:{id:'11111111-1111-1111-1111-111111111111'},access:true,rows:[{id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',username:'shop',status:'connected',expires_at:'2027-01-01T00:00:00Z'}],token:{account_id:'1784',username:'shop',ciphertext:'enc:TOK',expires_at:'2027-01-01T00:00:00Z'},tableMissing:false};
 const svcCalls=[];const svc={rpc:async(name,args)=>{svcCalls.push([name,args]);if(name==='builder_instagram_token')return {data:state.token?[state.token]:[],error:null};if(name==='builder_instagram_store_token')return {data:true,error:null};return {data:null,error:null}}};
 const userDb=()=>({auth:{getUser:async()=>({data:{user:state.user}})},rpc:async n=>n==='has_site_builder_access'?{data:state.access,error:null}:{data:null,error:{message:'x'}},
  from:()=>{const q={filters:{},select(){return q},neq(){return q},order(){return Promise.resolve(state.tableMissing?{data:null,error:{code:'PGRST205',message:'Could not find the table'}}:{data:state.rows,error:null})},eq(k,v){q.filters[k]=v;return q},limit(){return Promise.resolve(state.noSuggestions?{data:null,error:{code:'PGRST205',message:'Could not find the table'}}:{data:state.suggestions||[],error:null})},maybeSingle:async()=>({data:state.rows.find(r=>r.id===q.filters.id)||null})};return q}});
 const cfg={builderInstagramConfiguration:()=>({ready:true}),isUuid:v=>/^[0-9a-f-]{36}$/i.test(String(v||'')),missingObject:e=>/PGRST205|42P01/.test(String(e?.code||'')),graphOrigin:()=>'https://graph.instagram.com'};
 const igFetch={fn:fetchOk({data:[]})};const libNet=load('lib/builder-instagram.js',{},{fetch:(...a)=>igFetch.fn(...a)});
 const tokenLib=load('lib/builder-instagram-token.js',{'./builder-instagram':libNet},{fetch:(...a)=>igFetch.fn(...a)});
 const mocks={'../../../../../lib/builder-instagram-token':tokenLib,'next/server':{NextResponse},'../../../../lib/supabase/server':{createClient:async()=>userDb()},'../../../../../lib/supabase/server':{createClient:async()=>userDb()},'../../../../lib/crm/instagram':server,'../../../../../lib/crm/instagram':server,'../../../../lib/builder-instagram':libNet,'../../../../../lib/builder-instagram':libNet,'../../../../lib/builder-instagram-server':cfg,'../../../../../lib/builder-instagram-server':cfg};
 const base=load('app/api/builder/instagram/route.js',mocks),media=load('app/api/builder/instagram/media/route.js',mocks);
 const req=(url,init={})=>({url,headers:{get:h=>(init.headers||{})[h.toLowerCase()]||null},json:async()=>init.body});
 const O='https://delsaai.ir',ID=state.rows[0].id;

 // status
 let res=await base.GET(req(O+'/api/builder/instagram'));assert.equal(res.status,200);assert.equal(res.body.installed,true);assert.equal(res.body.accounts.length,1);assert(!JSON.stringify(res.body).includes('TOK')&&!('ciphertext' in res.body.accounts[0]),'status never exposes tokens');assert.equal(res.headers['Cache-Control'],'no-store, private');
 assert.equal(res.body.sync,true);assert.equal(res.body.accounts[0].fresh,0,'no suggestions -> fresh 0');
 state.suggestions=[{account_row:ID},{account_row:ID},{account_row:'99999999-9999-9999-9999-999999999999'}];res=await base.GET(req(O+'/api/builder/instagram'));assert.equal(res.body.accounts[0].fresh,2,'fresh counts new suggestions of that account only');
 state.noSuggestions=true;res=await base.GET(req(O+'/api/builder/instagram'));assert.deepEqual([res.status,res.body.installed,res.body.sync,res.body.accounts[0].fresh],[200,true,false,0],'without the sync migration the feature still works, just without the inbox');state.noSuggestions=false;state.suggestions=[];
 state.tableMissing=true;res=await base.GET(req(O+'/api/builder/instagram'));assert.deepEqual([res.status,res.body.installed,res.body.accounts.length],[200,false,0],'before the migration the feature reports "not installed"');state.tableMissing=false;
 state.user=null;assert.equal((await base.GET(req(O+'/api/builder/instagram'))).status,401);assert.equal((await media.GET(req(O+'/api/builder/instagram/media?account='+ID))).status,401);state.user={id:'11111111-1111-1111-1111-111111111111'};
 // connect: same-origin only, needs builder access, only the read scope, purpose cookie
 assert.equal((await base.POST(req(O+'/api/builder/instagram',{headers:{origin:'https://evil.com'},body:{action:'connect'}}))).status,403);
 state.access=false;assert.equal((await base.POST(req(O+'/api/builder/instagram',{headers:{origin:O},body:{action:'connect'}}))).status,403);state.access=true;
 res=await base.POST(req(O+'/api/builder/instagram',{headers:{origin:O},body:{action:'connect'}}));assert.equal(res.status,200);
 assert.match(res.body.url,/scope=instagram_business_basic&/,'the builder asks only for the read scope');assert(!res.body.url.includes('manage_messages'));
 const cookie=JSON.parse(res.cookies.last.v.replace(/^enc:/,''));assert.equal(cookie.purpose,'builder');assert.equal(cookie.userId,state.user.id);assert.equal(res.cookies.last.o.path,'/api/crm/instagram');assert(res.cookies.last.o.httpOnly&&res.cookies.last.o.secure);
 // disconnect
 res=await base.POST(req(O+'/api/builder/instagram',{headers:{origin:O},body:{action:'disconnect',id:'not-a-uuid'}}));assert.equal(res.status,400);
 res=await base.POST(req(O+'/api/builder/instagram',{headers:{origin:O},body:{action:'disconnect',id:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'}}));assert.equal(res.status,404,'RLS hides other owners\' rows');
 res=await base.POST(req(O+'/api/builder/instagram',{headers:{origin:O},body:{action:'disconnect',id:ID}}));assert.deepEqual([res.status,svcCalls.at(-1)[0],svcCalls.at(-1)[1].p_owner],[200,'builder_instagram_disconnect'.replace('disconnect','disconnect'),state.user.id].map((x,i)=>i===1?'builder_disconnect_instagram':x));

 // media
 const cdnItem={id:'1',media_type:'IMAGE',media_url:cdn+'a.jpg',caption:'c'};
 igFetch.fn=fetchOk({data:[cdnItem],paging:{cursors:{after:'N'},next:'x'}});
 res=await media.GET(req(O+'/api/builder/instagram/media?account='+ID));assert.equal(res.status,200);assert.equal(res.body.items.length,1);assert.equal(res.body.next,'N');assert.equal(res.body.account.username,'shop');assert(!JSON.stringify(res.body).includes('TOK'),'tokens never reach the browser');
 assert.equal((await media.GET(req(O+'/api/builder/instagram/media?account=nope'))).status,400);
 assert.equal((await media.GET(req(O+'/api/builder/instagram/media?account=cccccccc-cccc-cccc-cccc-cccccccccccc'))).status,404,'another owner\'s account is invisible');
 state.access=false;assert.equal((await media.GET(req(O+'/api/builder/instagram/media?account='+ID))).status,403);state.access=true;
 state.rows[0].status='expired';res=await media.GET(req(O+'/api/builder/instagram/media?account='+ID));assert.equal(res.status,401);assert.equal(res.body.error,'instagram_token_invalid');state.rows[0].status='connected';
 // Instagram rejects the token -> the account is marked expired and the customer is told to reconnect
 svcCalls.length=0;igFetch.fn=fetchOk({error:{code:190}},400);res=await media.GET(req(O+'/api/builder/instagram/media?account='+ID));assert.equal(res.status,401);assert(svcCalls.some(c=>c[0]==='builder_instagram_mark_expired'&&c[1].p_owner===state.user.id),'an invalid token marks the account expired');assert.match(res.body.message,/دوباره وصل/);
 igFetch.fn=fetchOk({error:{code:4}},400);assert.equal((await media.GET(req(O+'/api/builder/instagram/media?account='+ID))).status,429);
 igFetch.fn=fetchOk({error:{code:10}},400);assert.equal((await media.GET(req(O+'/api/builder/instagram/media?account='+ID))).status,403);
 // a token that is about to expire is renewed, stored sealed, and used for the request
 svcCalls.length=0;state.token={...state.token,expires_at:new Date(Date.now()+5*86400000).toISOString()};
 const seen=[];igFetch.fn=async(url,opts)=>{seen.push([String(url),opts?.headers?.Authorization]);if(String(url).includes('refresh_access_token'))return {ok:true,status:200,json:async()=>({access_token:'FRESH',expires_in:5184000})};return {ok:true,status:200,json:async()=>({data:[cdnItem]})}};
 res=await media.GET(req(O+'/api/builder/instagram/media?account='+ID+'&kind=stories'));assert.equal(res.status,200);
 const stored=svcCalls.find(c=>c[0]==='builder_instagram_store_token');assert(stored&&stored[1].p_ciphertext==='enc:FRESH'&&Date.parse(stored[1].p_expires)>Date.now()+50*86400000,'renewed token stored sealed');
 assert.equal(seen.at(-1)[1],'Bearer FRESH','the renewed token is used');assert(seen.at(-1)[0].includes('/1784/stories'),'stories kind reads the stories edge');
 // a failed renewal of a still-valid token is ignored; of an expired one it is fatal
 igFetch.fn=async(url)=>String(url).includes('refresh_access_token')?{ok:false,status:400,json:async()=>({error:{code:1}})}:{ok:true,status:200,json:async()=>({data:[cdnItem]})};
 assert.equal((await media.GET(req(O+'/api/builder/instagram/media?account='+ID))).status,200);
 state.token={...state.token,expires_at:new Date(Date.now()-86400000).toISOString()};svcCalls.length=0;res=await media.GET(req(O+'/api/builder/instagram/media?account='+ID));assert.equal(res.status,401);assert(svcCalls.some(c=>c[0]==='builder_instagram_mark_expired'));
 console.log('PASS: Instagram media parsing, safe URLs, paging, errors, token renewal and route isolation');
})().catch(e=>{console.error(e);process.exit(1)});

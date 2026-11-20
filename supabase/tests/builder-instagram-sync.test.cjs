const ts=require('typescript'),fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'../..');
function load(file,mocks={},globals={}){const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{fileName:'test.tsx',compilerOptions:{esModuleInterop:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,require:n=>mocks[n]||require(n),console,String,Number,Array,Object,JSON,Set,Map,Math,RegExp,Promise,Error,Date,URL,URLSearchParams,AbortSignal,Buffer,process,encodeURIComponent,decodeURIComponent,Intl,Uint8Array,...globals},{});return module.exports}
const UID='11111111-1111-1111-1111-111111111111',ACC='33333333-3333-3333-3333-333333333333';
const CDN='https://scontent.cdninstagram.com/x.jpg';
const post=(id,iso,extra={})=>({id,caption:'کپشن '+id,media_type:'IMAGE',media_url:CDN,permalink:`https://www.instagram.com/p/${id}/`,timestamp:iso,...extra});
const state={media:{},list:[],graphError:null,pageSize:2,expires:new Date(Date.now()+50*86400000).toISOString(),sync:{connected_at:'2026-11-01T00:00:00+00:00',last_checked_at:null,last_seen_at:null},due:[],recSync:{data:2,error:null},failId:null};
const calls={fetches:[],rpc:[]};
const fakeFetch=async(url)=>{
 const u=new URL(String(url));calls.fetches.push(String(url));
 if(u.hostname!=='graph.instagram.com')throw new Error('unexpected host '+u.hostname);
 if(u.pathname==='/refresh_access_token')return {ok:true,status:200,json:async()=>({access_token:'F',expires_in:5184000})};
 if(state.graphError)return {ok:false,status:state.graphError.status||400,json:async()=>({error:state.graphError.error})};
 if(u.pathname==='/me/media'){const after=Number(u.searchParams.get('after')||0),size=state.pageSize,slice=state.list.slice(after,after+size);
  return {ok:true,status:200,json:async()=>({data:slice,paging:after+size<state.list.length?{cursors:{after:String(after+size)},next:'https://x'}:{}})}}
 const id=u.pathname.slice(1);
 if(id===state.failId)return {ok:false,status:500,json:async()=>({error:{code:2}})};
 const m=state.media[id];
 return m?{ok:true,status:200,json:async()=>m}:{ok:false,status:400,json:async()=>({error:{code:100,error_subcode:33,message:'Unsupported get request. Object with ID does not exist'}})};
};
const lib=load('lib/builder-instagram.js',{},{fetch:fakeFetch});
const tokenLib=load('lib/builder-instagram-token.js',{'./builder-instagram':lib},{fetch:fakeFetch});
const sync=load('lib/builder-instagram-sync.js',{'./builder-instagram':lib,'./builder-instagram-token':tokenLib});
const svc={rpc:async(n,a)=>{calls.rpc.push([n,JSON.parse(JSON.stringify(a))]);
 if(n==='builder_instagram_token')return {data:[{account_id:'1784',username:'s',ciphertext:'enc:TOK',expires_at:state.expires}],error:null};
 if(n==='builder_instagram_sync_state')return {data:state.sync?[state.sync]:[],error:null};
 if(n==='builder_instagram_record_sync')return state.recSync;
 if(n==='builder_instagram_imports_due')return {data:state.due,error:null};
 return {data:null,error:null}}};
const reset=()=>{calls.fetches.length=0;calls.rpc.length=0;state.graphError=null;state.failId=null;state.sync={connected_at:'2026-11-01T00:00:00+00:00',last_checked_at:null,last_seen_at:null};state.due=[];state.recSync={data:2,error:null};state.pageSize=2;
 state.list=[post('18000000000005','2026-11-05T10:00:00+0000'),post('18000000000004','2026-11-04T10:00:00+0000',{media_type:'VIDEO',media_product_type:'REELS',media_url:'https://video.cdninstagram.com/v.mp4',thumbnail_url:CDN}),post('18000000000003','2026-11-03T10:00:00+0000'),post('18000000000002','2026-10-30T10:00:00+0000'),post('18000000000001','2026-10-01T10:00:00+0000')];
 state.media={};for(const p of state.list)state.media[p.id]=p};
const ctx={svc,userId:UID,accountRow:ACC,origin:'https://graph.instagram.com',seal:v=>'enc:'+v,unseal:v=>String(v).replace(/^enc:/,''),fetchImpl:fakeFetch};
const rpc=n=>calls.rpc.filter(c=>c[0]===n);

(async()=>{
 // ---- collectNew: only posts newer than the cutoff, newest first, stops once it reaches older ones, pages bounded
 reset();let r=await sync.collectNew({token:'T',account:'1784',cutoff:'2026-11-01T00:00:00+00:00',origin:ctx.origin,fetchImpl:fakeFetch});
 assert.deepEqual(r.items.map(i=>i.id),['18000000000005','18000000000004','18000000000003'],'three posts are newer than the cutoff');
 assert.equal(r.newest,'2026-11-05T10:00:00.000Z');assert.equal(calls.fetches.length,2,'stops after the page holding older posts');
 assert.deepEqual(r.items[1].kind,'reel');assert(r.items.every(i=>!('thumbnail' in i)&&!('videoUrl' in i)),'only text fields are stored for suggestions');
 reset();state.pageSize=1;r=await sync.collectNew({token:'T',account:'1784',cutoff:'2000-01-01',origin:ctx.origin,fetchImpl:fakeFetch,maxPages:2});assert.equal(r.items.length,2,'at most maxPages pages');
 reset();r=await sync.collectNew({token:'T',account:'1784',cutoff:'2027-01-01',origin:ctx.origin,fetchImpl:fakeFetch});assert.equal(r.items.length,0);assert.equal(r.newest,null);
 reset();state.list=[{...post('18000000000009','2026-11-09T10:00:00+0000'),media_product_type:'STORY'}];r=await sync.collectNew({token:'T',account:'1784',cutoff:'2026-11-01',origin:ctx.origin,fetchImpl:fakeFetch});assert.equal(r.items.length,0,'stories never become suggestions');

 // ---- checkImports: unchanged / changed / deleted; whitespace-only edits are ignored; one broken post does not stop the rest
 reset();state.media['18000000000005']={...state.media['18000000000005'],caption:'کپشن   18000000000005\n'};state.media['18000000000004']={...state.media['18000000000004'],caption:'کپشن جدید با قیمت ۱۰۰'};delete state.media['18000000000003'];state.failId='18000000000002';
 const imports=[['i5','18000000000005','کپشن 18000000000005'],['i4','18000000000004','کپشن 18000000000004'],['i3','18000000000003','x'],['i2','18000000000002','y'],['i1','18000000000001','کپشن 18000000000001']].map(([id,media_id,caption])=>({id,media_id,caption,source_state:'ok',latest_caption:null}));
 let out=await sync.checkImports({token:'T',imports,origin:ctx.origin,fetchImpl:fakeFetch});
 assert.deepEqual(JSON.parse(JSON.stringify(out)),[{id:'i5',state:'ok',latest:null},{id:'i4',state:'changed',latest:'کپشن جدید با قیمت ۱۰۰'},{id:'i3',state:'deleted',latest:null},{id:'i1',state:'ok',latest:null}],'transient failure of i2 leaves it unchecked');
 reset();state.graphError={error:{code:190,message:'expired'}};try{await sync.checkImports({token:'T',imports,origin:ctx.origin,fetchImpl:fakeFetch});assert.fail('x')}catch(e){assert.equal(e.code,'instagram_token_invalid')}
 reset();state.graphError={error:{code:4}};try{await sync.checkImports({token:'T',imports,origin:ctx.origin,fetchImpl:fakeFetch});assert.fail('x')}catch(e){assert.equal(e.code,'instagram_rate_limited')}

 // ---- syncAccount: end to end, nothing about products is ever written
 reset();state.due=[{id:'i4',media_id:'18000000000004',caption:'کپشن قدیمی',source_state:'ok',latest_caption:null},{id:'i3',media_id:'18000000000099',caption:'z',source_state:'ok',latest_caption:null}];
 let res=await sync.syncAccount(ctx);assert.deepEqual(JSON.parse(JSON.stringify(res)),{suggested:2,changed:1,deleted:1,checked:2});
 const rec=rpc('builder_instagram_record_sync')[0][1];assert.deepEqual([rec.p_owner,rec.p_account,rec.p_seen,rec.p_items.length],[UID,ACC,'2026-11-05T10:00:00.000Z',3]);
 assert.deepEqual(rpc('builder_instagram_record_check').map(c=>[c[1].p_import,c[1].p_state]),[['i4','changed'],['i3','deleted']]);
 assert(calls.rpc.every(c=>/^builder_instagram_/.test(c[0])),'only Instagram bookkeeping calls, no product writes');
 assert(calls.fetches.every(u=>!u.includes('TOK')),'token only travels in the Authorization header');
 // the cutoff follows the newest post already seen
 reset();state.sync={connected_at:'2026-11-01T00:00:00+00:00',last_checked_at:'2026-11-04T11:00:00+00:00',last_seen_at:'2026-11-04T10:00:00+00:00'};res=await sync.syncAccount(ctx);assert.deepEqual(rpc('builder_instagram_record_sync')[0][1].p_items.map(i=>i.id),['18000000000005'],'posts at or before last_seen_at are not suggested again');
 // account missing / not connected -> skipped quietly
 reset();state.sync=null;res=await sync.syncAccount(ctx);assert.equal(res.skipped,true);assert.equal(calls.fetches.length,0);
 // expired token marks the connection and throws
 reset();state.graphError={error:{code:190}};try{await sync.syncAccount(ctx);assert.fail('x')}catch(e){assert.equal(e.code,'instagram_token_invalid')}assert(rpc('builder_instagram_mark_expired').length>=1,'connection marked expired');
 // a failing check does not record a sync (the account is retried next run)
 reset();state.graphError={error:{code:2},status:500};try{await sync.syncAccount(ctx);assert.fail('x')}catch(e){assert.equal(e.code,'instagram_unavailable')}assert.equal(rpc('builder_instagram_record_sync').length,0);
 // a failing record call is an error, not a silent success
 reset();state.recSync={data:null,error:{message:'x'}};try{await sync.syncAccount(ctx);assert.fail('x')}catch(e){assert.equal(e.code,'instagram_unavailable')}
 // errorMessages has the new code
 assert(lib.errorMessages.instagram_not_found);
 console.log('PASS: Instagram sync (new-post detection, cutoff, edit/delete detection, error handling, no product writes)');
})().catch(e=>{console.error(e);process.exit(1)});

const ts=require('typescript'),fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'../..');
function load(file,mocks={},globals={}){const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{fileName:'test.tsx',compilerOptions:{esModuleInterop:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,require:n=>mocks[n]||require(n),console,String,Number,Array,Object,JSON,Set,Map,Math,RegExp,Promise,Error,Date,URL,URLSearchParams,AbortSignal,Buffer,process,encodeURIComponent,decodeURIComponent,Intl,Uint8Array,...globals},{});return module.exports}
const base=load('lib/builder-instagram.js');
const isbnLib=load('lib/book-isbn.js'),indLib=load('lib/builder-industries.js',{'./book-isbn':isbnLib}),aiLib=load('lib/builder-ai.js',{'./builder-industries':indLib});
const imp=load('lib/builder-instagram-import.js',{'./builder-instagram':base,'./builder-ai':aiLib});
const cdn='https://scontent.cdninstagram.com/';
const jpeg=()=>Buffer.concat([Buffer.from([0xff,0xd8,0xff,0xe0]),Buffer.alloc(64,1)]);
const png=()=>Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),Buffer.alloc(64)]);
const mp4=()=>Buffer.concat([Buffer.alloc(4),Buffer.from('ftypisom'),Buffer.alloc(64)]);

(async()=>{
 // ---- caption rules
 assert.equal(imp.titleFromCaption('کیف چرم دست‌دوز ✨ #کیف #چرم\nقیمت ۹۸۰ هزار تومان'),'کیف چرم دست‌دوز ✨');
 assert.equal(imp.titleFromCaption('#فقط #هشتگ'),'محصول اینستاگرام');assert.equal(imp.titleFromCaption(''),'محصول اینستاگرام');assert.equal(imp.titleFromCaption('x'),'محصول اینستاگرام');
 assert.equal(imp.titleFromCaption('\n\n  عنوان دوم  \nبعدی'),'عنوان دوم');
 const long='کلمه '.repeat(60);const t=imp.titleFromCaption(long);assert(t.length<=100&&!t.endsWith(' '),'long titles are cut at a word');
 assert.equal(imp.titleFromCaption('نگاه کنید https://example.com/x سلام'),'نگاه کنید سلام','links are dropped from titles');
 const cap='کیف چرم #کیف_چرم #چرم\n\nقیمت ۹۸۰ هزار تومان\nسایز ۳۰\n#فروش #چرم';
 assert.equal(imp.descriptionFromCaption(cap),'کیف چرم\n\nقیمت ۹۸۰ هزار تومان\nسایز ۳۰');
 assert.deepEqual(imp.tagsFromCaption(cap),['کیف چرم','چرم','فروش'],'hashtags become unique tags; underscores become spaces');
 assert.equal(imp.tagsFromCaption(Array.from({length:30},(_,i)=>'#tag'+i).join(' ')).length,10);assert.deepEqual(imp.tagsFromCaption('#a #bb'),['bb'],'one-letter tags are dropped');
 assert.equal(imp.summaryFrom('کوتاه','عنوان'),'کوتاه');assert.equal(imp.summaryFrom('عنوان','عنوان'),'');assert(imp.summaryFrom('کلمه '.repeat(100),'x').length<=201&&imp.summaryFrom('کلمه '.repeat(100),'x').endsWith('…'));
 assert.equal(imp.slugForMedia('17900000000001'),'ig-17900000000001');assert.match(imp.slugForMedia('17900000000001'),/^[a-z0-9][a-z0-9-]{1,79}$/);assert.equal(imp.skuForMedia('17900000000001'),'IG-17900000000001');

 // ---- which files are copied
 const img={id:'1',kind:'image',video:false,thumbnail:cdn+'a.jpg',videoUrl:'',children:[],caption:'c'};
 assert.deepEqual(imp.planAssets(img),{images:[cdn+'a.jpg'],videos:[]});
 assert.deepEqual(imp.planAssets({id:'2',kind:'reel',video:true,thumbnail:cdn+'t.jpg',videoUrl:cdn+'v.mp4',children:[]}),{images:[cdn+'t.jpg'],videos:[{url:cdn+'v.mp4',poster:cdn+'t.jpg'}]},'a reel keeps its cover and the video');
 const car={id:'3',kind:'carousel',children:[{type:'image',url:cdn+'1.jpg',thumbnail:cdn+'1.jpg'},{type:'video',url:cdn+'2.mp4',thumbnail:cdn+'2.jpg'},{type:'image',url:cdn+'3.jpg',thumbnail:cdn+'3.jpg'}]};
 assert.deepEqual(imp.planAssets(car),{images:[cdn+'1.jpg',cdn+'2.jpg',cdn+'3.jpg'],videos:[{url:cdn+'2.mp4',poster:cdn+'2.jpg'}]});
 assert.equal(imp.planAssets({id:'4',kind:'carousel',children:Array.from({length:10},(_,i)=>({type:'image',url:cdn+i+'.jpg',thumbnail:cdn+i+'.jpg'}))}).images.length,10);
 assert.equal(imp.planAssets({id:'5',kind:'carousel',children:Array.from({length:5},(_,i)=>({type:'video',url:cdn+i+'.mp4',thumbnail:cdn+i+'.jpg'}))}).videos.length,2,'at most two videos');
 assert.deepEqual(imp.planAssets({id:'6',thumbnail:'https://evil.com/a.jpg',children:[]}).images,[],'foreign hosts never enter the plan');

 // ---- file sniffing
 assert.equal(imp.sniffType(jpeg()),'image/jpeg');assert.equal(imp.sniffType(png()),'image/png');assert.equal(imp.sniffType(Buffer.concat([Buffer.from('RIFF'),Buffer.alloc(4),Buffer.from('WEBP'),Buffer.alloc(8)])),'image/webp');assert.equal(imp.sniffType(mp4()),'video/mp4');assert.equal(imp.sniffType(Buffer.concat([Buffer.alloc(4),Buffer.from('ftypqt  '),Buffer.alloc(8)])),'video/quicktime');
 for(const bad of [Buffer.from('<html>not an image</html>'),Buffer.alloc(3),Buffer.alloc(64)])assert.equal(imp.sniffType(bad),'');

 // ---- downloading: hosts, redirects, size caps, real type
 const body=b=>({ok:true,status:200,headers:{get:()=>String(b.length)},arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)});
 const seen=[];const dl=(b,over={})=>imp.downloadAsset(over.url||cdn+'a.jpg',{maxBytes:over.max||1000,kinds:over.kinds||['image'],fetchImpl:async(u,o)=>{seen.push(o);return over.res||body(b)}});
 let f=await dl(jpeg());assert.equal(f.type,'image/jpeg');assert.equal(f.bytes,68);assert.equal(seen[0].redirect,'error','redirects are refused');
 const code=async p=>{try{await p;return 'none'}catch(e){return e.code}};
 assert.equal(await code(dl(jpeg(),{url:'https://evil.com/a.jpg'})),'asset_blocked');assert.equal(await code(dl(jpeg(),{url:'http://scontent.cdninstagram.com/a.jpg'})),'asset_blocked');
 assert.equal(await code(dl(jpeg(),{max:10})),'asset_too_large','size cap');assert.equal(await code(dl(Buffer.from('<html>x</html>........'))),'asset_type','html is not an image');
 assert.equal(await code(dl(mp4())),'asset_type','a video where an image is expected');assert.equal((await dl(mp4(),{kinds:['video']})).type,'video/mp4');
 assert.equal(await code(dl(jpeg(),{res:{ok:false,status:404,headers:{get:()=>null}}})),'asset_unreachable');
 assert.equal(await code(dl(jpeg(),{res:{ok:true,status:200,headers:{get:()=>'99999999'},arrayBuffer:async()=>new ArrayBuffer(8)}})),'asset_too_large','declared length is checked before reading');
 const streamed=(chunks)=>({ok:true,status:200,headers:{get:()=>null},body:{getReader:()=>{let i=0;return {read:async()=>i<chunks.length?{done:false,value:chunks[i++]}:{done:true},cancel:async()=>{}}}}});
 assert.equal((await dl(null,{res:streamed([jpeg().subarray(0,30),jpeg().subarray(30)])})).bytes,68,'streamed bodies are reassembled');
 assert.equal(await code(dl(null,{res:streamed([Buffer.alloc(600,1),Buffer.alloc(600,1)])})),'asset_too_large','streams are cut at the cap');
 assert.equal(await code(imp.downloadAsset(cdn+'a.jpg',{maxBytes:9,kinds:['image'],fetchImpl:async()=>{throw new Error('boom')}})),'asset_unreachable');

 // ---- product document
 const media={id:'17900000000001',kind:'reel',video:true,caption:'کیف چرم #چرم',thumbnail:cdn+'t.jpg',videoUrl:cdn+'v.mp4',children:[],permalink:'https://www.instagram.com/reel/R/',timestamp:'2026-11-01T10:00:00.000Z'};
 const doc=imp.productDocument(media,{images:['https://x/1.jpg']});
 assert.deepEqual([doc.title,doc.slug,doc.kind,doc.status,doc.tags,doc.images],['کیف چرم','ig-17900000000001','simple','draft',['چرم'],['https://x/1.jpg']]);assert.equal(doc.description,'کیف چرم');
 assert.deepEqual(JSON.parse(JSON.stringify(imp.draftVariant(media))),{label:'پیش‌فرض',sku:'IG-17900000000001',price:0,sale_price:null,stock:0,manage_stock:false,attributes:{}});

 // ---- the whole flow with fake dependencies
 const mk=(over={})=>{const log={uploads:[],removed:[],saved:[],recorded:[],deleted:[]};
  const deps={download:async(url,o)=>{if(over.fail&&over.fail(url))throw Object.assign(new Error('x'),{code:over.failCode||'asset_unreachable'});return url.endsWith('.mp4')?{buffer:mp4(),type:'video/mp4',bytes:over.videoBytes||1000}:{buffer:jpeg(),type:'image/jpeg',bytes:68}},
   upload:async(bucket,p,buf,type)=>{log.uploads.push([bucket,p,type]);return 'https://store.example/'+bucket+'/'+p},remove:async(b,paths)=>{log.removed.push([b,paths])},
   saveProduct:async(d,v)=>{if(over.saveFails)throw Object.assign(new Error('save'),{code:'save_failed'});log.saved.push([d,v]);return 'prod-1'},
   record:async a=>{if(over.recordFails)throw Object.assign(new Error('dup'),{code:'duplicate'});log.recorded.push(a)},deleteProduct:async id=>{log.deleted.push(id)}};return {deps,log}};
 let {deps,log}=mk();
 let r=await imp.importMedia({media,site:'site-1',deps});
 assert.deepEqual([r.productId,r.images,r.videos,r.skipped.length],['prod-1',1,1,0]);
 assert.deepEqual(log.uploads.map(u=>[u[0],u[1]]),[['builder-product-images','site-1/ig-17900000000001-0.jpg'],['builder-product-videos','site-1/ig-17900000000001-v0.mp4']],'files go under <site>/ in their bucket');
 assert.equal(log.saved[0][0].images[0],'https://store.example/builder-product-images/site-1/ig-17900000000001-0.jpg');assert.equal(log.saved[0][0].status,'draft');assert.equal(log.saved[0][1].length,1);
 assert.deepEqual(JSON.parse(JSON.stringify(log.recorded[0])),{productId:'prod-1',videos:[{url:'https://store.example/builder-product-videos/site-1/ig-17900000000001-v0.mp4',poster:'https://store.example/builder-product-images/site-1/ig-17900000000001-0.jpg',bytes:1000}]},'the video keeps our copy of its cover as poster');
 // a failing video only skips the video
 ({deps,log}=mk({fail:u=>u.endsWith('.mp4'),failCode:'asset_too_large'}));r=await imp.importMedia({media,site:'s',deps});assert.deepEqual([r.images,r.videos,r.skipped],[1,0,['asset_too_large']]);assert.equal(log.recorded[0].videos.length,0);
 // no image -> nothing is created
 ({deps,log}=mk({fail:()=>true}));assert.equal(await code(imp.importMedia({media,site:'s',deps})),'no_image');assert.equal(log.saved.length,0);
 // saving fails -> uploaded files are removed again
 ({deps,log}=mk({saveFails:true}));assert.equal(await code(imp.importMedia({media,site:'s',deps})),'save_failed');assert.deepEqual(log.removed.map(x=>x[0]).sort(),['builder-product-images','builder-product-videos'],'orphans are cleaned up');
 // recording fails (duplicate) -> product and files are removed
 ({deps,log}=mk({recordFails:true}));assert.equal(await code(imp.importMedia({media,site:'s',deps})),'duplicate');assert.deepEqual(log.deleted,['prod-1']);assert(log.removed.length>0);
 // carousel: several pictures and a video
 ({deps,log}=mk());r=await imp.importMedia({media:{id:'3',kind:'carousel',caption:'',children:car.children,thumbnail:cdn+'1.jpg'},site:'s',deps});assert.deepEqual([r.images,r.videos],[3,1]);assert.equal(log.saved[0][0].title,'محصول اینستاگرام');

 // ---- step 3: confirmed fields (price -> published, options -> variants, plan limit -> draft)
 const over=aiLib.normalizeOverrides({title:'کیف چرم قرمز',summary:'خلاصه',price:'۹۸۰۰۰۰',sale_price:850000,availability:'in_stock',options:[{name:'رنگ',values:['قرمز','مشکی']}],category:'کیف',tags:['چرم','دست‌دوز'],attributes:{}},{industry:'general'});
 ({deps,log}=mk());r=await imp.importMedia({media,site:'s',deps,options:{over}});
 let [d0,vs]=log.saved[0];
 assert.deepEqual([d0.title,d0.status,d0.kind,d0.summary,d0.category,d0.tags],['کیف چرم قرمز','published','variable','خلاصه','کیف',['چرم','دست‌دوز']]);assert.equal(vs.length,2);assert.deepEqual([vs[0].label,vs[0].price,vs[0].sale_price,vs[0].manage_stock],['قرمز',980000,850000,false]);assert.deepEqual([r.productStatus,r.downgraded],['published',false]);
 // no price -> draft, even with confirmed fields
 ({deps,log}=mk());r=await imp.importMedia({media,site:'s',deps,options:{over:aiLib.normalizeOverrides({title:'بدون قیمت'},{industry:'general'})}});assert.deepEqual([log.saved[0][0].status,log.saved[0][0].title,r.productStatus],['draft','بدون قیمت','draft']);
 // empty confirmed title/tags fall back to the caption rules
 ({deps,log}=mk());await imp.importMedia({media,site:'s',deps,options:{over:aiLib.normalizeOverrides({price:500000},{industry:'general'})}});assert.deepEqual([log.saved[0][0].title,log.saved[0][0].tags],['کیف چرم',['چرم']]);
 // out of stock confirmed -> tracked stock of zero
 ({deps,log}=mk());await imp.importMedia({media,site:'s',deps,options:{over:aiLib.normalizeOverrides({price:500000,availability:'out_of_stock'},{industry:'general'})}});assert.deepEqual([log.saved[0][1][0].manage_stock,log.saved[0][1][0].stock],[true,0]);
 // free plan limit: the published save is refused once, the product is kept as a draft
 ({deps,log}=mk());let tries=0;const orig=deps.saveProduct;deps.saveProduct=async(d,v)=>{tries++;if(d.status==='published')throw Object.assign(new Error('limit'),{code:'plan_limit'});return orig(d,v)};
 r=await imp.importMedia({media,site:'s',deps,options:{over}});assert.deepEqual([tries,r.productStatus,r.downgraded,log.saved[0][0].status],[2,'draft',true,'draft']);
 // a plan-limit error for a draft is not retried forever
 ({deps,log}=mk());deps.saveProduct=async()=>{throw Object.assign(new Error('limit'),{code:'plan_limit'})};assert.equal(await code(imp.importMedia({media,site:'s',deps})),'plan_limit');assert(log.removed.length>0);

 console.log('PASS: Instagram import (caption rules, asset plan, safe downloads, orphan cleanup, full flow)');
})().catch(e=>{console.error(e);process.exit(1)});

const ts=require('typescript'),fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'../..');
function load(file,mocks={}){const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{fileName:'test.tsx',compilerOptions:{esModuleInterop:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,require:n=>mocks[n]||require(n),console,String,Number,Array,Object,JSON,Set,Map,encodeURIComponent,decodeURIComponent,Math,RegExp,Promise,Error,globalThis:{}},{});return module.exports}
const isbn=load('lib/book-isbn.js'),seo=load('lib/book-seo.js',{'./book-isbn':isbn}),ind=load('lib/builder-industries.js',{'./book-isbn':isbn});
const cli=load('lib/book-catalog-client.js',{'./book-isbn':isbn,'./book-seo':seo,'./builder-industries':ind});

(async()=>{
 // ---- lookupBook: messages for every failure mode
 const res=(status,body)=>({ok:status>=200&&status<300,status,json:async()=>body});
 assert.match((await cli.lookupBook('123')).message,/شابک معتبر/);
 let url;const ok=await cli.lookupBook('0-306-40615-2',{fetchImpl:async u=>{url=u;return res(200,{source:'none'})}});
 assert.equal(url,'/api/builder/books/lookup?isbn=9780306406157','the normalised ISBN-13 is sent');assert.deepEqual(ok,{ok:true,data:{source:'none'}});
 for(const [st,re] of [[400,/معتبر نیست/],[401,/وارد حساب/],[403,/دسترسی/],[429,/ساعت/],[502,/دستی/],[500,/دستی/]])assert.match((await cli.lookupBook('9780306406157',{fetchImpl:async()=>res(st,{})})).message,re,String(st));
 assert.match((await cli.lookupBook('9780306406157',{fetchImpl:async()=>{throw new Error('offline')}})).message,/دستی/);

 // ---- candidates
 const ol={source:'open_library',isbn13:'9780140449136',suggestion:{isbn:'9780140449136',title:'The Odyssey',authors:['Homer'],publisher:'Penguin',publish_year:1996,year_calendar:'gregorian',pages:541,cover_image_url:'https://covers.openlibrary.org/b/id/1-L.jpg',source_ref:'/books/OL1M',field_sources:{title:'open_library'}}};
 const c=cli.candidateFrom(ol);assert.equal(c.origin,'open_library');assert.equal(c.author,'Homer');assert.equal(c.pages,'541');assert.equal(c.year_calendar,'gregorian');
 const cat=cli.candidateFrom({source:'catalog',edition:{isbn13:'9786001234569',title:'کتاب',authors:['الف','ب'],translators:['م'],publisher:'نشر',publish_year:1403,year_calendar:'jalali',pages:200,edition_label:'چاپ دوم',language:'فارسی',cover:'شومیز',verified:true,source:'manual',other_editions:[{id:'x'}]}});
 assert.equal(cat.author,'الف، ب');assert.match(cat.label,/تأییدشده/);assert.equal(cat.otherEditions.length,1);
 assert.equal(cli.candidateFrom({source:'none'}),null);assert.equal(cli.candidateFrom(undefined),null);

 // ---- applying a candidate: only valid values, Gregorian years are not copied, existing images are kept
 let r=cli.applyCandidate({title:'',values:{author:'قدیمی'},imageInput:''},c);
 assert.equal(r.title,'The Odyssey');assert.equal(r.values.author,'Homer');assert.equal(r.values.isbn,'9780140449136');assert.equal(r.values.pages,'541');assert.equal('publish_year' in r.values,false);
 assert.equal(r.imageInput,'https://covers.openlibrary.org/b/id/1-L.jpg');assert.match(r.notes[0],/1996/);
 r=cli.applyCandidate({title:'عنوان من',values:{author:'قدیمی'},imageInput:'https://mine.test/a.jpg'},{...cat,title:''});
 assert.equal(r.title,'عنوان من','an empty candidate title keeps the typed title');assert.equal(r.imageInput,'https://mine.test/a.jpg','existing images are not replaced');
 assert.equal(r.values.publish_year,'1403');assert.equal(r.values.language,'فارسی');assert.equal(r.values.cover,'شومیز');assert.deepEqual(r.notes,[]);
 r=cli.applyCandidate({title:'x',values:{},imageInput:''},{...cat,language:'کلینگون',cover:'نامعتبر',pages:'abc'});
 assert.equal('language' in r.values,false);assert.equal('cover' in r.values,false);assert.equal('pages' in r.values,false,'invalid select/number values are not copied');

 // ---- contribution payload
 const meta={source:'open_library',source_ref:'/books/OL1M',field_sources:{title:'open_library'}};
 const p=cli.editionPayload({title:' کتاب ',values:{isbn:'9780306406157',author:'الف، ب',translator:'م',publisher:'نشر',language:'فارسی',edition:'چاپ دوم',cover:'شومیز',publish_year:'1403',pages:'200'},images:['http://x/a.jpg','https://x/b.jpg'],meta});
 assert.deepEqual(p,{isbn:'9780306406157',title:'کتاب',authors:['الف','ب'],translators:['م'],source:'open_library',publisher:'نشر',language:'فارسی',edition_label:'چاپ دوم',cover:'شومیز',publish_year:1403,year_calendar:'jalali',pages:200,cover_image_url:'https://x/b.jpg',source_ref:'/books/OL1M',field_sources:{title:'open_library'}});
 assert.equal(cli.editionPayload({title:'x',values:{isbn:'9780306406157',publish_year:'1999'},images:[]}).year_calendar,'gregorian');
 assert.equal(cli.editionPayload({title:'x',values:{isbn:'9780306406157'}}).source,'manual');
 assert.equal(cli.editionPayload({title:'x',values:{isbn:'bad'}}),null);assert.equal(cli.editionPayload({title:'  ',values:{isbn:'9780306406157'}}),null);

 // ---- contributeEdition never throws and reports what happened
 const calls=[];
 const fake=({rpc={data:{id:'e1',created:true},error:null},del={error:null},ins={error:null},boom=false}={})=>({
  rpc:async(name,args)=>{calls.push(['rpc',name,args]);if(boom)throw new Error('network');return rpc},
  from:t=>({delete:()=>({eq:async(c,v)=>{calls.push(['delete',t,c,v]);return del}}),insert:async row=>{calls.push(['insert',t,row]);return ins}})
 });
 let out=await cli.contributeEdition(fake(),'site1','prod1',p);
 assert.deepEqual(out,{status:'saved',created:true});
 assert.deepEqual(calls.map(x=>x.slice(0,2).join(':')),['rpc:catalog_upsert_edition','delete:builder_product_books','insert:builder_product_books']);
 assert.deepEqual(calls[0][2],{p_site:'site1',p});assert.deepEqual(calls[2][2],{product_id:'prod1',site_id:'site1',edition_id:'e1'});
 assert.deepEqual(await cli.contributeEdition(fake(),'s','p',null),{status:'skipped'});assert.deepEqual(await cli.contributeEdition(fake(),'s',null,p),{status:'skipped'});
 for(const error of [{code:'PGRST202',message:'Could not find the function public.catalog_upsert_edition'},{code:'42883',message:'function does not exist'}])
  assert.deepEqual(await cli.contributeEdition(fake({rpc:{data:null,error}}),'s','p',p),{status:'skipped'},'catalog not installed is not an error');
 assert.deepEqual(await cli.contributeEdition(fake({rpc:{data:null,error:{code:'P0001',message:'catalog_rate_limited'}}}),'s','p',p),{status:'failed'});
 assert.deepEqual(await cli.contributeEdition(fake({boom:true}),'s','p',p),{status:'failed'},'network errors are swallowed');
 assert.deepEqual(await cli.contributeEdition(fake({ins:{error:{code:'42501',message:'rls'}}}),'s','p',p),{status:'failed'});
 assert.deepEqual(await cli.contributeEdition(fake({del:{error:{code:'42P01',message:'relation "builder_product_books" does not exist'}}}),'s','p',p),{status:'skipped'});
 console.log('PASS: ISBN lookup messages, candidate mapping, form application, catalog payload and graceful contribution');
})().catch(e=>{console.error(e);process.exit(1)});

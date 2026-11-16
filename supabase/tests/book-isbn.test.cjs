const ts=require('typescript'),fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'../..');
function load(file,mocks={}){const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{fileName:'test.tsx',compilerOptions:{esModuleInterop:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,require:n=>mocks[n]||require(n),AbortController,setTimeout,clearTimeout,URL,Number,String,Array,Object,JSON,Error,Promise,Math,console});return module.exports}
const isbn=load('lib/book-isbn.js'),lookup=load('lib/book-lookup.js',{'./book-isbn':isbn});

// ---- ISBN: same vectors as supabase/tests/book-catalog.sql
assert.equal(isbn.isbn13('9780306406157'),'9780306406157');
for(const v of ['0306406152','0-306-40615-2','978-0-306-40615-7',' 978 0306406157 ','978‐0306406157'])assert.equal(isbn.isbn13(v),'9780306406157',v);
assert.equal(isbn.isbn13('080442957X'),'9780804429573');assert.equal(isbn.isbn13('0-8044-2957-x'),'9780804429573');
assert.equal(isbn.isbn13('۹۷۸۶۰۰۱۲۳۴۵۶۹'),'9786001234569');assert.equal(isbn.isbn13('٩٧٨٦٠٠١٢٣٤٥٦٩'),'9786001234569');
assert.equal(isbn.isbn13('979-10-90636-07-1'),'9791090636071');assert.equal(isbn.isbn13('9780140449136'),'9780140449136');
for(const v of ['9786001234567','0306406153','123','abcdefghij','',null,undefined,'97803064061570','9770306406157'])assert.equal(isbn.isbn13(v),null,String(v));
assert.equal(isbn.formatIsbn13('0306406152'),'978-0-30640-615-7');
assert.equal(isbn.formatIsbn13('nope'),'');

// ---- Persian normalisation: same vectors as the SQL test
assert.equal(isbn.faNorm('كتاب علي'),'کتاب علی');assert.equal(isbn.faNorm('۱۲۳٤٥'),'12345');
assert.equal(isbn.faNorm('می‌خواهم  کِتاب'),'می خواهم کتاب');assert.equal(isbn.faNorm(null),'');assert.equal(isbn.faNorm('  Ab  C '),'ab c');
assert.equal(isbn.faNorm('صادق  هدایت'),isbn.faNorm('صادق هدایت'));assert.equal(isbn.faNorm('نشر نگاه'),'نشر نگاه');

// ---- Open Library mapping (fixture shaped like the real jscmd=data response)
const olData={title:'The Odyssey',subtitle:'a new translation',authors:[{name:'Homer'},{name:'  Robert   Fagles '}],publishers:[{name:'Penguin Classics'}],publish_date:'November 1, 1996',number_of_pages:541,key:'/books/OL1M',cover:{large:'https://covers.openlibrary.org/b/id/1-L.jpg'}};
const s=lookup.mapOpenLibrary('9780140449136',olData);
assert.equal(s.title,'The Odyssey: a new translation');assert.deepEqual(s.authors,['Homer','Robert Fagles']);assert.equal(s.publisher,'Penguin Classics');
assert.equal(s.publish_year,1996);assert.equal(s.year_calendar,'gregorian');assert.equal(s.pages,541);assert.equal(s.source,'open_library');assert.equal(s.source_ref,'/books/OL1M');
assert.equal(s.cover_image_url,'https://covers.openlibrary.org/b/id/1-L.jpg');
assert.deepEqual(Object.keys(s.field_sources).sort(),['authors','cover_image_url','pages','publish_year','publisher','title']);
assert.equal(lookup.mapOpenLibrary('9780140449136',{}),null);assert.equal(lookup.mapOpenLibrary('9780140449136',undefined),null);
// untrusted input is bounded and unsafe URLs are dropped
const evil=lookup.mapOpenLibrary('9780140449136',{title:'T'.repeat(500),authors:Array.from({length:30},(_,i)=>({name:'A'+i})),publish_date:'sometime',number_of_pages:'abc',pagination:'x',cover:{large:'http://covers.openlibrary.org/x.jpg',medium:'https://evil.example/x.jpg',small:'javascript:alert(1)'}});
assert.equal(evil.title.length,300);assert.equal(evil.authors.length,10);assert.equal('cover_image_url' in evil,false);assert.equal('pages' in evil,false);assert.equal('publish_year' in evil,false);
assert.equal(lookup.mapOpenLibrary('9780140449136',{title:'x',pagination:'240 p.'}).pages,240);

// ---- fetch wrapper
const resp=(body,ok=true,status=200)=>({ok,status,text:async()=>typeof body==='string'?body:JSON.stringify(body)});
(async()=>{
 let seen;const good=async(url,opts)=>{seen={url,opts};return resp({'ISBN:9780140449136':olData})};
 assert.equal((await lookup.fetchOpenLibrary('9780140449136',{fetchImpl:good})).title,'The Odyssey: a new translation');
 assert(seen.url.startsWith('https://openlibrary.org/api/books?bibkeys=ISBN:9780140449136')&&seen.opts.signal,'fixed https origin, with abort signal');
 assert.equal(await lookup.fetchOpenLibrary('9780140449136',{fetchImpl:async()=>resp({})}),null,'unknown ISBN -> null');
 for(const [name,impl] of [['network',async()=>{throw new Error('down')}],['http',async()=>resp('',false,503)],['html',async()=>resp('<html>')],['huge',async()=>resp('{"a":"'+'x'.repeat(250000)+'"}')]])
  await assert.rejects(lookup.fetchOpenLibrary('9780140449136',{fetchImpl:impl}),/lookup_unavailable/,name);
 await assert.rejects(lookup.fetchOpenLibrary('9780140449136',{timeoutMs:20,fetchImpl:(u,o)=>new Promise((_,rej)=>o.signal.addEventListener('abort',()=>rej(new Error('aborted'))))}),/lookup_unavailable/,'timeout');

 // ---- orchestration
 let registered=0,external=0;
 const ext=async()=>{external++;return resp({'ISBN:9780140449136':olData})};
 const base={catalogLookup:async()=>null,register:async()=>{registered++},fetchImpl:ext};
 assert.equal((await lookup.lookupIsbn({...base,isbn:'0140449132'})).source,'open_library','isbn-10 input is normalised and looked up');
 assert.equal(registered,1);assert.equal(external,1);
 const hit=await lookup.lookupIsbn({...base,isbn:'9780140449136',catalogLookup:async c=>({id:'e1',isbn13:c})});
 assert.equal(hit.source,'catalog');assert.equal(registered,1,'catalog hits do not use the external quota');assert.equal(external,1,'catalog hits skip the external source');
 await assert.rejects(lookup.lookupIsbn({...base,isbn:'123'}),e=>e.code==='invalid_isbn');
 await assert.rejects(lookup.lookupIsbn({...base,isbn:'9780140449136',register:async()=>{throw new Error('lookup_rate_limited')}}),/lookup_rate_limited/);
 assert.deepEqual(await lookup.lookupIsbn({...base,isbn:'9780140449136',fetchImpl:async()=>resp({})}),{isbn13:'9780140449136',source:'none'});
 assert.deepEqual(await lookup.lookupIsbn({...base,isbn:'9780140449136',fetchImpl:async()=>{throw new Error('x')}}),{isbn13:'9780140449136',source:'none',error:'lookup_unavailable'});
 console.log('PASS: ISBN normalisation (parity vectors), Persian normalisation, Open Library mapping, bounds, fetch failures and lookup orchestration');
})().catch(e=>{console.error(e);process.exit(1)});

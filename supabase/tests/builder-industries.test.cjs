const ts=require('typescript'),fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'../..');
function load(file,mocks={}){const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{fileName:'test.tsx',compilerOptions:{esModuleInterop:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,require:n=>mocks[n]||require(n),React:require('react'),globalThis:{crypto:require('crypto').webcrypto},console});return module.exports}
const design=load('lib/builder-design.js'),ind=load('lib/builder-industries.js'),site=load('lib/site-builder.js',{'./builder-design':design,'./builder-industries':ind});

// Registry is internally consistent and only references existing templates and block types.
assert.deepEqual(ind.validateRegistry(site.templates.map(t=>t.id),Object.keys(site.blockLabels)),[]);
assert.deepEqual(ind.industries.map(i=>i.id),['general','books','apparel','digital','auto']);

// Legacy and unknown industries resolve to "general".
assert.equal(ind.normalizeIndustry(undefined),'general');assert.equal(ind.normalizeIndustry('<script>'),'general');assert.equal(ind.industryById('nope').id,'general');
assert.equal(site.normalizeDocument({template:'studio'}).industry,'general');
assert.equal(site.normalizeDocument({template:'studio',industry:'books'}).industry,'books');
assert.equal(site.normalizeDocument({template:'studio',industry:'x'.repeat(50)}).industry,'general');

// Industry is independent of the template: changing the template never touches the industry.
const d=site.normalizeDocument(site.starter('studio','کتاب‌فروشی من','books'));
assert.equal(d.industry,'books');assert.equal(site.normalizeDocument({...d,template:'tech'}).industry,'books');

// Starter applies industry copy and blocks, keeps the products block, and never duplicates a block type.
for(const i of ind.industries)for(const t of site.templates){
 const doc=site.normalizeDocument(site.starter(t.id,'آزمون',i.id)),types=doc.pages[0].blocks.map(b=>b.type);
 assert.equal(doc.industry,i.id);assert(types.includes('products'),t.id+'/'+i.id);
 assert.equal(types.filter(x=>x==='faq').length<=1,true,'faq duplicated '+t.id+'/'+i.id);
 assert.equal(types[types.length-1],'contact');
}
const books=site.normalizeDocument(site.starter('studio','x','books')).pages[0].blocks;
assert(books.find(b=>b.type==='products').title==='کتاب‌های منتخب');
assert.equal(site.normalizeDocument(site.starter('catalog','x')).industry,'general');

// Attributes: split/merge keeps free-form data and other industries' data, validates typed values.
const attrs={isbn:'978-600-123-456-7',author:'نویسنده',pages:'۲۴۰',language:'فارسی','جنس':'کاغذ',vehicle_brand:'پژو'};
const {values,rest}=ind.splitAttributes('books',attrs);
assert.deepEqual(Object.keys(values).sort(),['author','isbn','language','pages']);
assert.deepEqual(rest,{'جنس':'کاغذ',vehicle_brand:'پژو'});
const merged=ind.mergeAttributes('books',{...values,pages:'۲۴۰',language:'کلینگون',isbn:'abc',author:'  علی  '},rest);
assert.equal(merged.pages,'240');assert.equal(merged.author,'علی');
assert(!('language' in merged)&&!('isbn' in merged),'invalid select/pattern values are dropped');
assert.equal(merged.vehicle_brand,'پژو');assert.equal(merged['جنس'],'کاغذ');
assert.equal(ind.cleanFieldValue({type:'number',max:100},'101'),'');assert.equal(ind.cleanFieldValue({type:'text',max:3},'abcdef'),'abc');
assert.equal(ind.cleanFieldValue(ind.industryById('books').fields.find(f=>f.key==='isbn'),'978-600-123-456-7'),'978-600-123-456-7');
const unchanged=ind.mergeAttributes('general',{},{x:'1'});assert.deepEqual(unchanged,{x:'1'});

// Storefront helpers.
assert.equal(ind.attributeLabel('books','author'),'نویسنده');assert.equal(ind.attributeLabel('books','custom'),'custom');
assert.equal(ind.cardLine('books',{author:'الف',publisher:'ب'}),'الف · ب');
assert(ind.searchText('books',{isbn:'123',language:'فارسی'}).includes('123')&&!ind.searchText('books',{language:'فارسی'}).includes('فارسی'));
const products=[{attributes:{author:'الف',language:'فارسی'}},{attributes:{author:'ب',language:'فارسی'}},{attributes:{author:'الف',language:'انگلیسی'}},{attributes:{}}];
const f=ind.filterOptions('books',products);
assert.deepEqual(f.map(x=>x.key),['author','language']);assert.deepEqual(f.find(x=>x.key==='language').options,['فارسی','انگلیسی']);
assert.deepEqual(ind.filterOptions('books',[{attributes:{author:'الف'}}]),[],'single-value filters are hidden');
assert.deepEqual(ind.filterOptions('general',products),[]);
console.log('PASS: industry registry, document independence, starter blocks, attribute validation and storefront helpers');

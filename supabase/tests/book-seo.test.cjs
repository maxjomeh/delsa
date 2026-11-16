const ts=require('typescript'),fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'../..');
function load(file,mocks={}){const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{fileName:'test.tsx',compilerOptions:{esModuleInterop:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,require:n=>mocks[n]||require(n),console,String,Number,Array,Object,JSON,Set,Map,encodeURIComponent,decodeURIComponent,Math,RegExp},{});return module.exports}
const isbn=load('lib/book-isbn.js'),seo=load('lib/book-seo.js',{'./book-isbn':isbn});

// ---- slugs and people
assert.equal(seo.nameSlug('صادق  هدایت'),'صادق-هدایت');assert.equal(seo.nameSlug('صادق هدایت'),seo.nameSlug('صادق هدايت'),'arabic yeh');
assert.equal(seo.nameSlug('  علی‌اکبر  دهخدا '),'علی-اکبر-دهخدا','zwnj becomes a separator');assert.equal(seo.nameSlug('A. B!'),'a-b');assert.equal(seo.nameSlug('---'),'');assert.equal(seo.nameSlug(null),'');
assert.deepEqual(seo.peopleOf('الف، ب; ج , الف'),['الف','ب','ج']);assert.deepEqual(seo.peopleOf(''),[]);assert.deepEqual(seo.peopleOf(undefined),[]);
assert.equal(seo.peopleOf(Array.from({length:30},(_,i)=>'n'+i).join('،')).length,10);
assert.equal(seo.safeDecode('%D8%B5%D8%A7'),'صا');assert.equal(seo.safeDecode('%E0%A4%A'),'','malformed escapes are rejected');
assert.equal(seo.listingPath('author','صادق هدایت'),'/author/'+encodeURIComponent('صادق-هدایت'));

// ---- listings
const prod=(id,title,a,extra={})=>({id,slug:id,title,images:['https://img.test/'+id+'.jpg'],summary:'خلاصه',attributes:a,variants:[{enabled:true,price:100000,sale_price:null,manage_stock:true,stock:3,sku:'S'+id}],...extra});
const products=[prod('p1','جنایت و مکافات',{author:'داستایفسکی',publisher:'نشر الف',translator:'مترجم یک',publish_year:'1403',edition:'چاپ دوم',pages:'600',language:'فارسی',cover:'شومیز',isbn:'9780306406157'}),
 prod('p2','جنایت  و مکافات',{author:'داستایفسکی',publisher:'نشر ب',translator:'مترجم دو'}),
 prod('p3','جنایت و مکافات',{author:'نویسنده دیگر',publisher:'نشر الف'}),
 prod('p4','قمارباز',{author:'داستایفسکی، مترجم‌نویس',publisher:'نشر  الف'}),prod('p5','بی‌نویسنده',{})];
let l=seo.listingFor(products,'author','داستایفسکی');assert.equal(l.name,'داستایفسکی');assert.deepEqual(l.products.map(p=>p.id),['p1','p2','p4']);
l=seo.listingFor(products,'publisher',seo.nameSlug('نشر الف'));assert.deepEqual(l.products.map(p=>p.id),['p1','p3','p4'],'publisher spelling variants collapse');
assert.equal(seo.listingFor(products,'author','مترجم-نویس').products.length,1,'every author of a multi-author product has a page');
assert.equal(seo.listingFor(products,'author','ناشناس'),null);assert.equal(seo.listingFor(products,'colour','x'),null);assert.equal(seo.listingFor(products,'author',''),null);
const idx=seo.listingIndex(products,'author');assert.deepEqual(idx.map(e=>e.slug).sort(),['داستایفسکی','مترجم-نویس','نویسنده-دیگر'].sort());assert.equal(idx.find(e=>e.slug==='داستایفسکی').count,3);

// ---- editions of the same book
assert.deepEqual(seo.editionsOf(products,products[0]).map(p=>p.id),['p2'],'same title (spacing-insensitive) and first author, other products only');
assert.deepEqual(seo.editionsOf(products,products[3]),[]);

// ---- JSON-LD
const b=seo.safeJson({x:'</script><script>alert(1)</script>& '});
assert(!b.includes('<')&&!b.includes('>')&&!b.includes(' ')&&JSON.parse(b).x.startsWith('</script>'),'script-safe JSON round-trips');
const ld=seo.productJsonLd({origin:'https://www.delsaai.ir',base:'/s/shop',product:products[0],siteName:'فروشگاه'});
assert.deepEqual(ld['@type'],['Product','Book']);assert.equal(ld.isbn,'9780306406157');assert.equal(ld.url,'https://www.delsaai.ir/s/shop/product/p1');
assert.deepEqual(ld.author,[{'@type':'Person',name:'داستایفسکی'}]);assert.equal(ld.translator[0].name,'مترجم یک');assert.equal(ld.publisher.name,'نشر الف');
assert.equal(ld.numberOfPages,600);assert.equal(ld.inLanguage,'fa');assert.equal(ld.bookEdition,'چاپ دوم');assert.equal(ld.bookFormat,'https://schema.org/Paperback');
assert.equal('datePublished' in ld,false,'Jalali years are not sent as ISO dates');
assert.equal(ld.offers.priceCurrency,'IRR');assert.equal(ld.offers.price,'1000000','toman -> rial');assert.equal(ld.offers.availability,'https://schema.org/InStock');assert.equal(ld.sku,'Sp1');
assert(!JSON.stringify(ld).includes('undefined'));
const sold=seo.productJsonLd({origin:'https://x.test',base:'/s/a',product:prod('z','ز',{publish_year:'1999',language:'کلینگون'},{variants:[{enabled:true,price:50000,sale_price:40000,manage_stock:true,stock:0}]})});
assert.equal(sold.offers.availability,'https://schema.org/OutOfStock');assert.equal(sold.offers.price,'400000','sale price wins');assert.equal(sold.datePublished,'1999');assert.equal('inLanguage' in sold,false);
assert.equal('offers' in seo.productJsonLd({origin:'https://x.test',base:'/s/a',product:prod('n','ن',{},{variants:[]})}),false);
const cl=seo.listingJsonLd({origin:'https://x.test',base:'/s/a',listing:seo.listingFor(products,'author','داستایفسکی')});
assert.equal(cl['@type'],'CollectionPage');assert.equal(cl.about['@type'],'Person');assert.equal(cl.mainEntity.numberOfItems,3);assert.equal(cl.mainEntity.itemListElement[0].url,'https://x.test/s/a/product/p1');
assert.equal(seo.listingJsonLd({origin:'https://x.test',base:'/s/a',listing:seo.listingFor(products,'publisher','نشر-الف')}).about['@type'],'Organization');
console.log('PASS: author/publisher listings, edition grouping, script-safe JSON-LD for books');

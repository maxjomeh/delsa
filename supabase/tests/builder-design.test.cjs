const ts=require('typescript'),fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'../..');
function load(file,mocks={}){const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{fileName:'test.tsx',compilerOptions:{esModuleInterop:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,require:n=>mocks[n]||require(n),React:require('react'),globalThis:{crypto:require('crypto').webcrypto},console});return module.exports}
const design=load('lib/builder-design.js');const industriesLib=load('lib/builder-industries.js');const commerceLib=load('lib/builder-commerce.js');const site=load('lib/site-builder.js',{'./builder-design':design,'./builder-industries':industriesLib});
const old={template:'studio',color:'#ff642d',pages:[{id:'home',slug:'',title:'خانه',blocks:[{id:'a',type:'text',title:'متن قدیمی',text:'محتوای محفوظ',items:[]}]}]};
const normalized=site.normalizeDocument(old);assert.equal(normalized.pages[0].columns,1);assert.equal(normalized.pages[0].gap,0);assert.equal(normalized.pages[0].blocks[0].text,'محتوای محفوظ');assert.deepEqual(JSON.parse(JSON.stringify(normalized.pages[0].blocks[0].style)),{});
const custom={...old,pages:[{...old.pages[0],columns:3,gap:16,blocks:[{...old.pages[0].blocks[0],style:{paddingTop:80,span:2,background:'#ffffff',titleSize:42},mobileStyle:{titleSize:24,paddingTop:20}}]}]};const result=site.normalizeDocument(JSON.parse(JSON.stringify(site.normalizeDocument(custom))));assert.equal(result.pages[0].columns,3);assert.equal(result.pages[0].blocks[0].mobileStyle.titleSize,24);assert.equal(result.pages[0].blocks[0].style.span,2);
const bounded=design.normalizeDesign({paddingTop:99999,titleSize:-10,background:'url(javascript:alert(1))',textColor:'#fff',position:'fixed',span:9,hiddenDesktop:true});assert.equal(bounded.paddingTop,240);assert.equal(bounded.titleSize,16);assert.equal(bounded.span,4);assert.equal(bounded.hiddenDesktop,true);assert.equal(bounded.background,undefined);assert.equal(bounded.position,undefined);
const blocks=[{id:'a'},{id:'b'},{id:'c'}];assert.equal(design.reorderBlock(blocks,'c','a').map(b=>b.id).join(','),'c,a,b');assert.equal(blocks.map(b=>b.id).join(','),'a,b,c');assert.equal(design.reorderBlock(blocks,'unknown','a'),blocks);
for(const type of ['heading','button','divider','spacer'])assert.equal(site.normalizeDocument({pages:[{blocks:[site.newBlock(type)]}]}).pages[0].blocks[0].type,type);
const React=require('react'),render=require('react-dom/server').renderToStaticMarkup;const extra=load('components/BuilderExtraElements.js',{'../lib/site-builder':site,'./BuilderExtraElements.module.css':new Proxy({},{get:(_,k)=>String(k)})});const view=load('components/BuilderSiteView.js',{'../lib/site-builder':site,'../lib/builder-design':design,'./BuilderTemplateArt':()=>null,'./BuilderMotion':()=>null,'./BuilderFloatingCover':()=>null,'../lib/builder-industries':industriesLib,'../lib/builder-commerce':commerceLib,'./builder-design-system.css':{},'./builder-templates.css':{},'./BuilderExtraElements':extra,'./SiteBuilder.module.css':new Proxy({},{get:(_,k)=>String(k)}),'next/link':({children,...props})=>React.createElement('a',props,children)}).default;const html=render(React.createElement(view,{name:'آزمون',document:result}));assert(html.includes('--block-mobile-title:24px'));assert(html.includes('data-design-background'));assert(html.includes('محتوای محفوظ'));assert(!html.includes('designSelectable'));
assert.equal(Object.keys(site.blockLabels).length,28);
for(const type of extra.extraElementTypes){const b=site.newBlock(type);const d=site.normalizeDocument({pages:[{blocks:[b]}]});assert.equal(d.pages[0].blocks[0].type,type);assert(render(React.createElement(view,{name:'آزمون',document:d})).includes(b.title));}
const longFAQ={...site.newBlock('faq'),items:['س'.repeat(600)+'|'+'پ'.repeat(600)]};assert.equal(site.normalizeDocument({pages:[{blocks:[longFAQ]}]}).pages[0].blocks[0].items[0].length,1201);
const injected={...site.newBlock('links'),items:['ناامن | javascript:alert(1)','امن | https://example.com']};const secure=render(React.createElement(extra.default,{block:injected}));assert(!secure.includes('javascript:'));assert(secure.includes('https://example.com'));
const faq=render(React.createElement(extra.default,{block:site.newBlock('faq')}));assert(faq.includes('<details>')&&faq.includes('<summary>'));
const progress=render(React.createElement(extra.default,{block:{...site.newBlock('progress'),items:['فارسی | ۸۰','بیش از سقف | 999','منفی | -2']}}));assert(progress.includes('value="80"'));assert(progress.includes('value="100"'));assert(progress.includes('value="0"'));
console.log('PASS: legacy compatibility, saved/mobile design round trip, safe CSS bounds, new elements and immutable reorder');

for(const t of site.templates){const d=site.normalizeDocument(site.starter(t.id,"آزمون فروشگاه"));assert.equal(d.template,t.id);assert(d.pages[0].blocks.some(b=>b.type==="products"));assert(render(React.createElement(view,{name:"آزمون فروشگاه",document:d})).includes("آزمون فروشگاه"));}
assert.equal(site.templates.length,12);

// Motion intensity: legacy documents stay gentle, unknown values are rejected, new sites are balanced.
assert.equal(site.normalizeDocument({template:'studio'}).motion,'simple');
assert.equal(site.normalizeDocument({template:'studio',motion:'cinematic'}).motion,'cinematic');
assert.equal(site.normalizeDocument({template:'studio',motion:'url(javascript:alert(1))'}).motion,'simple');
assert.equal(site.normalizeDocument(site.starter('studio','x')).motion,'balanced');
assert.deepEqual(site.motionLevels.map(m=>m.id),['simple','balanced','cinematic']);
console.log('PASS: motion intensity normalization');
const motionHtml=render(React.createElement(view,{name:'x',document:{...result,motion:'cinematic'}}));
assert(motionHtml.includes('data-delsa-site')&&motionHtml.includes('data-motion="cinematic"'));
assert(/<section[^>]*data-reveal=""/.test(motionHtml)||motionHtml.includes('data-reveal=""'));
const editorHtml=render(React.createElement(view,{name:'x',document:result,editor:{selectedId:null,dropId:null,onSelect(){},onDragOver(){},onDrop(){},controls:()=>null}}));
assert(!editorHtml.includes('data-motion=')&&!editorHtml.includes('data-reveal'));
console.log('PASS: motion attributes on published sites, none in the editor canvas');

// Phase 3 templates (editorial / commerce / cinematic) and the book spotlight blocks.
for(const id of ['editorial','commerce','cinematic']){
 assert(site.templates.some(t=>t.id===id),id+' is registered');
 const d=site.normalizeDocument(site.starter(id,'کتاب‌فروشی','books')),types=d.pages[0].blocks.map(b=>b.type);
 assert.equal(d.template,id);assert(types.includes('products')&&types.includes('hero'),id);
}
assert(site.normalizeDocument(site.starter('editorial','x')).pages[0].blocks.some(b=>b.type==='bookSpotlight'&&b.items.length===0));
assert.equal(site.normalizeDocument({pages:[{blocks:[{type:'bookSpotlight',title:'x'},{type:'authorSpotlight',title:'y',image:'http://insecure/a.png'}]}]}).pages[0].blocks.length,2);
assert.equal(site.normalizeDocument({pages:[{blocks:[{type:'authorSpotlight',image:'http://insecure/a.png'}]}]}).pages[0].blocks[0].image,'','non-HTTPS author photos are dropped');
const prod=(id,title,author,featured=false,img='https://img.test/'+id+'.jpg')=>({id,slug:id,title,featured,images:[img],attributes:{author},variants:[{enabled:true,price:100000,sale_price:null}]});
const spotDoc=site.normalizeDocument(site.starter('editorial','x','books'));
const spotHtml=render(React.createElement(view,{name:'x',document:spotDoc,base:'/s/x',products:[prod('a','کتاب الف','نویسنده یک'),prod('b','کتاب هفتهٔ ما','نویسنده دو',true)]}));
assert(spotHtml.includes('data-block="bookSpotlight"')&&spotHtml.includes('کتاب هفتهٔ ما'),'book of the week uses the featured product');
assert(spotHtml.includes('/s/x/product/b'),'book of the week links to the product page');
assert.equal(/\/s\/x\/product\/a/.test(spotHtml.split('data-block="bookSpotlight"')[1].split('</section>')[0]),false,'spotlight shows only the featured book');
const authorDoc=site.normalizeDocument({template:'editorial',industry:'books',pages:[{id:'h',slug:'',blocks:[{...site.newBlock('authorSpotlight'),title:'نویسنده دو',text:'زندگی‌نامه'}]}]});
const authorHtml=render(React.createElement(view,{name:'x',document:authorDoc,base:'/s/x',products:[prod('a','کتاب الف','نویسنده یک'),prod('b','کتاب ب','نویسنده دو'),prod('c','کتاب ج','نویسنده  دو')]}));
assert(authorHtml.includes('کتاب ب')&&authorHtml.includes('کتاب ج')&&!authorHtml.includes('کتاب الف'),'author spotlight lists only that author\'s books');
assert(render(React.createElement(view,{name:'x',document:spotDoc,preview:true})).includes('عنوان کتاب هفته'),'spotlights render placeholders without products (editor / preview)');
assert(spotHtml.includes('data-template="editorial"'));
console.log('PASS: new templates, spotlight blocks and HTTPS-only author photos');

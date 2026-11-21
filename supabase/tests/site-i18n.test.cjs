// Every template (12), industry (5) and language (en, ar, tr) must produce fully translated starter content,
// and a site's language must survive normalizeDocument.
const ts=require('typescript'),fs=require('fs'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'../..');
const cache=new Map();
function resolve(from,spec){
 const base=path.resolve(path.dirname(from),spec);
 for(const ext of ['','.js','/index.js'])if(fs.existsSync(base+ext)&&fs.statSync(base+ext).isFile())return base+ext;
 throw new Error('cannot resolve '+spec+' from '+from);
}
// Minimal loader: transpiles the project's ESM-style files and resolves relative imports itself.
function load(file){
 if(cache.has(file))return cache.get(file).exports;
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const mod={exports:{}};cache.set(file,mod);
 new Function('require','module','exports',code)(spec=>spec.startsWith('.')?load(resolve(file,spec)):require(spec),mod,mod.exports);
 return mod.exports;
}
const lib=name=>load(path.join(root,'lib',name+'.js'));
const site=lib('site-builder'),config=lib('i18n/config'),industries=lib('builder-industries').industries;
const dict={en:lib('i18n/messages/site-en').default,ar:lib('i18n/messages/site-ar').default,tr:lib('i18n/messages/site-tr').default};

assert.deepEqual([...config.LOCALES],['fa','en','ar','tr'],'languages changed: update SITE_LANGS in lib/site-builder.js');
for(const code of config.LOCALES)assert.equal(site.normalizeLang(code),code);
assert.equal(site.normalizeLang('de'),'fa');assert.equal(site.normalizeDocument({}).lang,'fa');assert.equal(site.normalizeDocument({lang:'tr'}).lang,'tr');
assert.equal(site.templates.length,12);

// Persian-only letters (p, ch, zh, g, k, y): Arabic text must not contain them; en/tr must contain no Arabic script at all.
const leftover={en:/[؀-ۿ]/,tr:/[؀-ۿ]/,ar:/[پچژگکی]/};
const NAME='⁣BRAND⁣';
const strings=document=>document.pages.flatMap(p=>[p.title,...p.blocks.flatMap(b=>[b.title,b.text,b.button,...b.items])]);
for(const lang of ['en','ar','tr'])for(const tpl of site.templates)for(const ind of industries){
 const doc=site.starter(tpl.id,NAME,ind.id,lang,dict[lang]);
 assert.equal(doc.lang,lang);
 for(const s of strings(doc).map(x=>String(x).replace(NAME,''))){
  // "Zarnegar" is a brand name that stays Persian in Arabic; everything else must be translated.
  assert(!leftover[lang].test(s.replace(/زرنگار/g,'')),`${lang}/${tpl.id}/${ind.id}: untranslated "${s}"`);
 }
}
// Persian stays the source language: no dictionary, no change.
const fa=site.starter('zarrin','x','general');assert.equal(fa.lang,'fa');assert.equal(fa.pages[0].title,'خانه');
// Template metadata (name, description, tagline, signature) exists in every language.
for(const lang of ['en','ar','tr'])for(const tpl of site.templates)for(const k of ['name','description','tagline','signature'])assert(tpl[k] in dict[lang],`${lang}: missing ${tpl.id}.${k}`);
// Elements added in the editor start with default copy in the site's language (newBlock), for every element type.
for(const lang of ['en','ar','tr']){
 const tr=s=>Object.prototype.hasOwnProperty.call(dict[lang],s)?dict[lang][s]:s;
 for(const type of Object.keys(site.blockLabels)){
  const b=site.newBlock(type,tr);
  for(const s of [b.title,b.text,b.button,...b.items])assert(!leftover[lang].test(String(s)),`${lang}/newBlock(${type}): untranslated "${s}"`);
 }
}
console.log('PASS: 12 templates x 5 industries x 3 languages have fully translated starter content and metadata');

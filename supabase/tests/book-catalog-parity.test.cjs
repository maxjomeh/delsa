// JS <-> SQL parity: lib/book-isbn.js must agree with public.book_isbn13() and public.fa_norm() on the same inputs.
// Run through supabase/tests/local-postgres/run.sh (it provides PGHOST/PGPORT/PGUSER/PGDATABASE).
const ts=require('typescript'),fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path'),{execFileSync}=require('child_process');
const root=path.resolve(__dirname,'../..');
function load(file){const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{fileName:'t.js',compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,require,console,String,Number});return module.exports}
const lib=load('lib/book-isbn.js');
// Deterministic pseudo-random generator so failures are reproducible.
let seed=20261116;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32};const pick=a=>a[Math.floor(rnd()*a.length)];
const digits=n=>Array.from({length:n},()=>Math.floor(rnd()*10)).join('');
const fa=s=>s.replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]),ar=s=>s.replace(/\d/g,d=>'٠١٢٣٤٥٦٧٨٩'[d]);
const c13=core=>{let t=0;for(let i=0;i<12;i++)t+=Number(core[i])*(i%2?3:1);return (10-t%10)%10};
const c10=core=>{let t=0;for(let i=0;i<9;i++)t+=Number(core[i])*(10-i);const r=(11-t%11)%11;return r===10?'X':String(r)};
const cases=[];
for(let i=0;i<150;i++){const core=pick(['978','979'])+digits(9),v13=core+c13(core),v10c=digits(9),v10=v10c+c10(v10c);cases.push(v13,v10);
 cases.push(v13.slice(0,3)+'-'+v13.slice(3,4)+'-'+v13.slice(4,8)+' '+v13.slice(8));cases.push(fa(v13));cases.push(ar(v10));cases.push(v10.toLowerCase());
 const bad=v13.slice(0,12)+String((Number(v13[12])+1+Math.floor(rnd()*8))%10);cases.push(bad);cases.push(v13.slice(0,6)+digits(1)+v13.slice(7));cases.push(digits(pick([9,10,11,12,13,14])));}
cases.push('','   ','abc','978-','X123456789','ISBN 9780306406157','9780306406157\n','0-306-40615-2','978‐030‐6406157','979-10-90636-07-1');
const faCases=['كتاب علي','کتاب علی','می‌خواهم  کِتاب','  A  B ','۱۲۳٤٥۶','صادق  هدایت','نشر نگاه','مدرسه ة ۀ أ إ','ـــکشیده','Hello  WORLD','','x','ی‌ك','کتابِ «شب» ۱۴۰۳','ABC۱۲۳def'];
for(let i=0;i<300;i++)faCases.push(Array.from({length:1+Math.floor(rnd()*6)},()=>pick(['كتاب','کتاب','علي','علی','ك','ک','می‌','‌های','  ',' ','۱۴۰۳','١٤٠٣','nashr','NASHR','ِ','ّ','ـ','ة','ۀ','أ','إ','آ','ا'])).join(pick(['',' ','‌','  '])));
const sql=(fn,inputs)=>{
 const json=JSON.stringify(inputs);assert(!json.includes('$j$'));
 const out=execFileSync('psql',['-X','-At','-F','\t','-c',`select ord-1, ${fn}(v) from jsonb_array_elements_text($j$${json}$j$::jsonb) with ordinality as t(v,ord) order by ord`],{encoding:'utf8',maxBuffer:1<<26});
 const rows=out.split('\n').filter(l=>l!=='').map(l=>{const i=l.indexOf('\t');return [Number(l.slice(0,i)),l.slice(i+1)]});
 return rows;
};
const check=(name,fn,jsFn,inputs)=>{
 const rows=sql(fn,inputs);assert.equal(rows.length,inputs.length,name+': row count');
 let bad=[];for(const [i,v] of rows){const js=jsFn(inputs[i])??'';if(js!==v)bad.push({input:inputs[i],js,sql:v});}
 assert.equal(bad.length,0,name+' mismatches: '+JSON.stringify(bad.slice(0,5)));
 return rows.length;
};
const n1=check('book_isbn13','public.book_isbn13',lib.isbn13,cases);
const n2=check('fa_norm','public.fa_norm',lib.faNorm,faCases);
console.log(`PASS: JS and SQL agree on ${n1} ISBN inputs and ${n2} Persian-normalisation inputs`);

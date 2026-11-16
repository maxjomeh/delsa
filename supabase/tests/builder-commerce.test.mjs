import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
// The lib files import each other with extension-less relative paths; chain them through data: URLs.
const dataUrl=src=>'data:text/javascript;charset=utf-8,'+encodeURIComponent(src);
const read=name=>readFile(new URL('../../lib/'+name,import.meta.url),'utf8');
const isbnUrl=dataUrl(await read('book-isbn.js'));
const industriesUrl=dataUrl((await read('builder-industries.js')).replace("'./book-isbn'",JSON.stringify(isbnUrl)));
const source=(await read('builder-commerce.js')).replace("'./builder-industries'",JSON.stringify(industriesUrl));
const {parseCSV,importProductRows,productRows,blankProduct,blankVariant,effectivePrice,normalizeText}=await import(dataUrl(source));
assert.deepEqual(parseCSV('\ufeffa,b\r\n"line1\nline2","quote ""ok"""'),[['a','b'],['line1\nline2','quote "ok"']]);
assert.throws(()=>parseCSV('a\n"unclosed'));
assert.equal(effectivePrice({price:150,sale_price:0}),0);
assert.equal(normalizeText('يک ۱۲٣'),'یک 123');
const product={...blankProduct(),title:'قطعه آزمایشی',slug:'sample-part',images:['https://example.com/part.webp'],variants:[{...blankVariant(),sku:'PART-1',price:100000,sale_price:90000,stock:3}]};
const rows=productRows([product]);const imported=importProductRows(rows.map(r=>r.map(x=>String(x))));assert.equal(imported[0].variants[0].price,100000);assert.equal(imported[0].images[0],product.images[0]);
const invalid=structuredClone(rows).map(r=>r.map(String));invalid[1][8]='-1';assert.throws(()=>importProductRows(invalid));
const duplicate=structuredClone(rows).map(r=>r.map(String));duplicate.push([...duplicate[1]]);assert.throws(()=>importProductRows(duplicate));
const image=structuredClone(rows).map(r=>r.map(String));image[1][14]='javascript:alert(1)';assert.throws(()=>importProductRows(image));
console.log('PASS: CSV quoting, multiline import, numeric validation, duplicate SKU, safe image URLs, Persian digits, zero-priced promotion');
const {productSlug}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(source));
assert.match(productSlug('کفش ورزشی ۱۲'),/^[a-z0-9][a-z0-9-]+$/);
const simple=importProductRows([['نام محصول','قیمت','موجودی'],['کفش ورزشی','۲۵۰٬۰۰۰','۳']]);
assert.equal(simple[0].status,'published');assert.equal(simple[0].autoSlug,true);assert.equal(simple[0].variants[0].sku,'');assert.equal(simple[0].variants[0].price,250000);
assert.throws(()=>importProductRows([['نام محصول','قیمت'],['کفش','']]),/ردیف 2/);
assert.deepEqual(parseCSV('نام محصول;قیمت\r\nکفش;100'),[['نام محصول','قیمت'],['کفش','100']]);
console.log('PASS: simple Persian CSV, automatic slug, published default, row errors, Excel separators');

// Industry columns (books): Persian labels or keys as headers, validation, blank cells ignored, export round trip.
{
 const head=['نام محصول','قیمت','نویسنده','شابک (ISBN)','تعداد صفحه','نوع جلد','ناشر'];
 const [p]=importProductRows([head,['کتاب الف','100000','صادق هدایت','0-306-40615-2','۲۴۰','شومیز','نشر نگاه']],'books');
 assert.deepEqual(p.industryValues,{author:'صادق هدایت',isbn:'9780306406157',pages:'240',cover:'شومیز',publisher:'نشر نگاه'});
 assert.deepEqual(importProductRows([head,['کتاب الف','1','صادق هدایت','','','','']],{id:'books'})[0].industryValues,{author:'صادق هدایت'},'an industry object works like an id (the UI passes the object)');
 assert.equal(productRows([blankProduct()],{id:'books'})[0].includes('نویسنده'),true);
 assert.deepEqual(importProductRows([head,['کتاب ب','5','','','','','']],'books')[0].industryValues,{},'blank industry cells are ignored');
 assert.throws(()=>importProductRows([head,['کتاب ب','1','','978-600-123-456-7','','','']],'books'),/ردیف 2: شابک/,'bad ISBN checksum');
 assert.throws(()=>importProductRows([head,['کتاب ب','1','','','','کلینگون','']],'books'),/ردیف 2: نوع جلد/,'unknown select option');
 assert.deepEqual(importProductRows([['title','price','ISBN','Author'],['کتاب','1','9780306406157','هدایت']],'books')[0].industryValues,{isbn:'9780306406157',author:'هدایت'},'keys and any letter case work as headers');
 assert.equal(importProductRows([head,['کتاب','1','کس','','','','']]).length,1,'no industry: extra columns are ignored');
 assert.deepEqual(importProductRows([head,['کتاب','1','کس','','','','']])[0].industryValues,{});
 const variable=importProductRows([['title','slug','kind','variant','price','isbn'],['کتاب','book-1','variable','شومیز','1','9780306406157'],['کتاب','book-1','variable','گالینگور','2','']],'books');
 assert.equal(variable.length,1);assert.equal(variable[0].variants.length,2);assert.equal(variable[0].industryValues.isbn,'9780306406157','variants share the industry values');
 assert.throws(()=>importProductRows([['title','slug','kind','variant','price','isbn'],['کتاب','book-1','variable','a','1','9780306406157'],['کتاب','book-1','variable','b','2','9786001234569']],'books'),/یکسان نیست/);
 const out=productRows([{...blankProduct(),title:'کتاب',slug:'k',attributes:{author:'هدایت',isbn:'9780306406157'},variants:[{...blankVariant(),sku:'S',price:1,stock:1}]}],'books');
 assert.deepEqual(out[0].slice(-9),['نویسنده','مترجم','ناشر','شابک (ISBN)','تعداد صفحه','سال انتشار','نوبت چاپ','زبان','نوع جلد']);
 assert.equal(out[1][out[0].indexOf('نویسنده')],'هدایت');assert.equal(out[1][out[0].indexOf('شابک (ISBN)')],'9780306406157');
 assert.equal(productRows([{...blankProduct(),variants:[{...blankVariant()}]}])[0].length,15,'no industry: the original 15 columns');
 console.log('PASS: industry CSV columns (labels/keys, validation, blank cells, variants, export)');
}

// ISBN and Persian-text helpers for the book catalog. They mirror public.book_isbn13() and public.fa_norm()
// in supabase/book-catalog.sql; both sides are tested with the same vectors.

const toLatinDigits=s=>String(s??'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const checkDigit13=core=>{let t=0;for(let i=0;i<12;i++)t+=Number(core[i])*(i%2===0?1:3);return (10-t%10)%10};

// Normalises an ISBN-10 or ISBN-13 (hyphens, spaces and Persian/Arabic digits allowed) to a valid ISBN-13, else null.
export function isbn13(input){
 const s=toLatinDigits(input).replace(/[\s‐-―-]/g,'').toUpperCase();
 if(/^97[89]\d{10}$/.test(s))return checkDigit13(s)===Number(s[12])?s:null;
 if(/^\d{9}[\dX]$/.test(s)){
  let t=0;for(let i=0;i<9;i++)t+=Number(s[i])*(10-i);
  const d=s[9]==='X'?10:Number(s[9]);
  if((t+d)%11!==0)return null;
  const core='978'+s.slice(0,9);
  return core+checkDigit13(core);
 }
 return null;
}

// "978-964-123-456-7" style display; falls back to the plain digits when the prefix group is unknown.
export function formatIsbn13(value){
 const s=isbn13(value);
 return s?`${s.slice(0,3)}-${s.slice(3,4)}-${s.slice(4,9)}-${s.slice(9,12)}-${s.slice(12)}`:'';
}

const FA_FROM='يىكةۀأإ٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',FA_TO='ییکههاا01234567890123456789';
// Matching key for titles, people and publishers: unifies Arabic/Persian letter variants and digits, drops
// diacritics and tatweel, turns ZWNJ/NBSP/whitespace into single spaces and lower-cases.
export function faNorm(value){
 return String(value??'').toLowerCase()
  .replace(/[يىكةۀأإ٠-٩۰-۹]/g,c=>FA_TO[FA_FROM.indexOf(c)])
  .replace(/[ً-ٰٟـ]/g,'')
  .replace(/[​-‍ \s]+/g,' ')
  .trim();
}

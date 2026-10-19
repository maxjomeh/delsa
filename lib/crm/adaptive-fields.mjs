// Incremental unsupervised question clustering for SIMA. No external data
// transfer, prompt execution, invented values, or demographic profiling.
// Builds local TF-IDF vectors from the business's own outgoing questions.
const stop=new Set('سلام وقت بخیر لطفا لطفاً میشه می‌شه میشه شما شماها تون تونه تون رو را در از به با برای و یا اگر هست است چه چی چیه چطور کدام کدوم چند دارید دارین بفرمایید ممنون سپاس عزیز من این اون یک روی لطف میخواستم می‌خواستم آیا میتونید می‌تونید بگید'.split(/\s+/));
const normalize=value=>String(value||'').replace(/[ي]/g,'ی').replace(/[ك]/g,'ک').replace(/\u200c/g,' ').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim().toLocaleLowerCase('fa-IR');
const words=value=>normalize(value).split(' ').filter(x=>x.length>=2&&!stop.has(x)).slice(0,30);
const vector=(w,idf)=>new Map([...new Set(w)].map(t=>[t,(w.filter(x=>x===t).length)*(idf.get(t)||1)]));
const cosine=(a,b)=>{
 let dot=0,A=0,B=0;for(const [t,v] of a){A+=v*v;dot+=v*(b.get(t)||0);}for(const v of b.values())B+=v*v;
 return dot/(Math.sqrt(A*B)||1);
};
const labelFor=(samples,keywords)=>{
 const joined=samples.join(' ');
 if(/کشنده/.test(joined)&&/(نام|اسم|نوع|مدل|ماشین)/.test(joined))return 'نام کشنده';
 if(/(شماره تماس|شماره موبایل|شماره تلفن)/.test(joined))return 'شماره تماس';
 if(/سایز/.test(joined))return 'سایز';
 if(/رنگ/.test(joined))return 'رنگ مورد نیاز';
 if(/برند/.test(joined))return 'برند مورد نظر';
 const keys=keywords.filter(x=>!['مدل','نام','اسم','نوع','مورد','دارید','مشتری'].includes(x));
 return keys.length?('اطلاعات '+keys.slice(0,2).join(' ')).slice(0,110):null;
};
const keyFor=label=>'learned_'+Array.from(label).map(ch=>ch.codePointAt(0).toString(16)).join('_').slice(0,88);
const questionLike=body=>/[؟?]|(اسم|نوع|مدل|شماره|سایز|رنگ|برند).{0,35}(چیه|چی|چند|بفرمایید)|چه\s+(مدل|نوع)/u.test(String(body||''));
export function discoverFields(interactions=[],{minOccurrences=3,minCustomers=2,similarity=.39}={}){
 const questions=interactions.filter(x=>x.direction==='outbound'&&x.kind==='message'&&questionLike(x.body)&&x.customer_id).map(x=>({...x,terms:words(x.body)})).filter(x=>x.terms.length>=1);
 const df=new Map();
 for(const q of questions)for(const term of new Set(q.terms))df.set(term,(df.get(term)||0)+1);
 const idf=new Map([...df].map(([t,n])=>[t,Math.log(1+(questions.length+1)/(n+1))]));
 const clusters=[];
 for(const q of questions){
  const vec=vector(q.terms,idf);
  let group=null,best=0;
  for(const g of clusters){const sim=cosine(vec,g.centroid);if(sim>best){best=sim;group=g;}}
  if(group&&best>=similarity){group.members.push(q);const bag=group.members.flatMap(m=>m.terms);group.centroid=vector(bag,idf);}
  else clusters.push({members:[q],centroid:vec});
 }
 return clusters.filter(g=>g.members.length>=minOccurrences&&new Set(g.members.map(m=>m.customer_id)).size>=minCustomers)
 .map(g=>{
   const wordsCount=new Map();for(const m of g.members)for(const w of m.terms)wordsCount.set(w,(wordsCount.get(w)||0)+1);
   const common=[...wordsCount].sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
   const examples=g.members.slice(0,3).map(m=>String(m.body).slice(0,200));
   const label=labelFor(examples,common);
   return label?{key:keyFor(label),label,question:examples[0],occurrences:g.members.length,distinctCustomers:new Set(g.members.map(m=>m.customer_id)).size,examples,sourceInteractions:g.members}:null;
 }).filter(Boolean).filter(x=>x.label!=='شماره تماس') // dedicated phone extraction
 .sort((a,b)=>b.occurrences-a.occurrences).slice(0,12);
}
const digits=value=>String(value||'').replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
export function explicitPhone(message){
 const t=digits(message);
 // Deliberate self-identification only. Unlabeled numbers and quoted third parties are ignored.
 const matches=[...t.matchAll(/(?:شماره\s*(?:تماس|موبایل|من|م)|موبایل\s*(?:من|م)|با\s*این\s*شماره)[^\n\d]{0,22}((?:\+98|0098|98|0)?9\d{9})/gu)]
  .map(m=>m[1].replace(/^(?:\+98|0098|98)/,'0')).filter(x=>/^09\d{9}$/.test(x));
 return new Set(matches).size===1?matches[0]:null;
}
export function candidateAnswer(question,reply){
 const body=String(reply||'').trim();
 if(!body||body.length>95||/[؟?]/.test(body)||/https?:\/\//i.test(body)||/(فاکتور|قیمت|هزینه|موجودی|تخفیف|سفارش|پرداخت)/.test(body))return null;
 if(/شماره تماس/.test(question))return null;
 // A short directly adjacent answer; never treat it as verified without a source.
 return body;
}
export function fieldCandidates(interactions=[],field){
 const items=[...interactions].filter(x=>x.customer_id).sort((a,b)=>Date.parse(a.occurred_at||a.created_at)-Date.parse(b.occurred_at||b.created_at));
 const byCustomer=new Map();for(const i of items){const rows=byCustomer.get(i.customer_id)||[];rows.push(i);byCustomer.set(i.customer_id,rows);}
 const tokens=words(field.question);
 const found=[];
 for(const [customerId,rows] of byCustomer){
  for(let i=0;i<rows.length-1;i++){
   const q=rows[i],a=rows[i+1];
   if(q.direction!=='outbound'||a.direction!=='inbound'||a.kind!=='message')continue;
   if(!questionLike(q.body))continue;
   if(cosine(vector(words(q.body),new Map()),vector(tokens,new Map()))<.48)continue;
   const dt=Date.parse(a.occurred_at||a.created_at)-Date.parse(q.occurred_at||q.created_at);
   if(dt<0||dt>1000*60*60*24*3)continue;
   const value=candidateAnswer(q.body,a.body);
   if(value){found.push({customerId,value,interactionId:a.id,quote:a.body,confidence:.78});break;}
  }
 }
 return found;
}

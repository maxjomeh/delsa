// Conservative evidence detectors. These are explainable heuristics, NOT an
// independently trained semantic ML model. Owner feedback is retained for future training.
const faDigits='۰۱۲۳۴۵۶۷۸۹';
const arDigits='٠١٢٣٤٥٦٧٨٩';
const latin=s=>String(s||'').replace(/[۰-۹]/g,c=>faDigits.indexOf(c)).replace(/[٠-٩]/g,c=>arDigits.indexOf(c));
const tidy=s=>String(s||'').replace(/[\u200c]/g,' ').trim();
const fieldPatterns=[
 {key:'truck_model',label:'مدل کشنده',question:/(کشنده|تریلی|ماشین سنگین).{0,35}(مدل|چی|نوع|چیه)|(چه|کدام).{0,24}(کشنده|ماشین)/iu,reply:/(?:ولوو|volvo|اسکانیا|scania|داف|daf|مان|man|بنز|actros|اکتروس|فوتون|دانگ ?فنگ|دایما|ایویکو|iveco|شاکمن)(?:[\s\-\w\dآ-ی]{0,24})/iu}
];
export function discoverFieldPatterns(interactions,threshold=3){
 const suggestions=[];
 for(const f of fieldPatterns){
  const examples=(interactions||[]).filter(i=>i.direction==='outbound'&&i.kind==='message'&&f.question.test(tidy(i.body))&&i.customer_id);
  const unique=new Set(examples.map(i=>i.customer_id));
  if(unique.size>=threshold){
   suggestions.push({kind:'new_field',key:f.key,label:f.label,confidence:Math.min(.96,.72+unique.size*.04),support_count:unique.size,quote:tidy(examples[0].body).slice(0,500),interaction_id:examples[0].id});
  }
 }
 return suggestions;
}
export function extractEvidence(interactions){
 const result=[];
 for(const i of interactions||[]){
  if(i.direction!=='inbound'||i.kind!=='message'||!i.customer_id||!i.body)continue;
  const text=tidy(i.body);
  const match=latin(text).match(/(?:^|[^0-9])((?:\+98|0098|0)?9\d{9})(?!\d)/);
  if(match){
   const ph=match[1].replace(/^(?:\+98|0098|98)/,'0');
   if(/^09\d{9}$/.test(ph)){
    const claimed=/(شماره|تماس|موبایل|تلفن|واتساپ|بهم زنگ|این شمار)/iu.test(text);
    result.push({customer_id:i.customer_id,kind:'phone',key:'phone',value:ph,confidence:claimed?.96:.72,quote:text.slice(0,500),interaction_id:i.id});
   }
  }
  for(const rule of fieldPatterns){
   const m=text.match(rule.reply);
   if(m&&/(کشنده|ماشین|تریلی|راننده|مدل)/iu.test(text)){
    result.push({customer_id:i.customer_id,kind:'truck_model',key:rule.key,value:tidy(m[0]).slice(0,100),confidence:.78,quote:text.slice(0,500),interaction_id:i.id});
   }
  }
 }
 return result;
}

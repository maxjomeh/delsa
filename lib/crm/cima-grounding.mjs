// SIMA intelligence: interpretable baseline, not a calibrated ML probability.
// Conversation messages/knowledge text are DATA, never privileged instructions.
const stop=new Set('سلام در از به را رو برای و یا هست است بود با من شما این آن که چه چطور چگونه کدام لطفا لطفاً بفرمایید لطف پیام ممنون خوب وقت میشه می‌شه آیا درباره دارین دارید کنید کنم کنیم میخوام می خواهم می‌توانم'.split(/\s+/));
export function tokens(input){
 return String(input||'').replace(/[ي]/g,'ی').replace(/[ك]/g,'ک').replace(/\u200c/g,' ').toLocaleLowerCase('fa-IR')
 .replace(/[^\p{L}\p{N}\s]/gu,' ').split(/\s+/).filter(x=>x.length>1&&!stop.has(x)).slice(0,80);
}
export function assessRisk(message,{doNotContact=false}={}){
 const raw=String(message||'');
 const blocks=[];
 if(doNotContact)blocks.push('CONTACT_OPTED_OUT');
 const rules=[
  [/قیمت|فی|نرخ|دلار|تومان|ریال|تخفیف|ارزون|گران|هزینه|قسط|اعتبار/u,'LIVE_PRICE_UNVERIFIED'],
  [/موجود|انبار|تمام شد|ناموجود|تعداد|رزرو/u,'LIVE_STOCK_UNVERIFIED'],
  [/سازگار|مناسب|میخوره|می خورد|می‌خورد|نصب|ایمنی|ترمز|بوستر|سایز دقیق|کد فنی/u,'TECHNICAL_FIT_UNVERIFIED'],
  [/پرداخت|فاکتور|بازگشت وجه|عودت|مرجوع|ضمانت|گارانتی|تعهد|ثبت سفارش/u,'FINANCIAL_COMMITMENT'],
  [/بیماری|دارو|سلامتی|پزشکی|مسائل حقوقی|وکالت|اتهام/u,'SENSITIVE_DOMAIN'],
  [/کد ملی|رمز|کارت بانکی|cvv|پسورد|password/u,'PRIVATE_DATA_REQUEST']
 ];
 for(const [test,label] of rules)if(test.test(raw))blocks.push(label);
 if(!raw.trim())blocks.push('EMPTY_CUSTOMER_MESSAGE');
 return {riskLevel:blocks.length?'high':'low',blocks};
}
export function rankKnowledge(question,entries=[],limit=3){
 const query=new Set(tokens(question));
 if(query.size===0)return [];
 const out=[];
 for(const item of entries){
  if(item?.status!=='approved'||!item.question||!item.answer)continue;
  if(item.expires_at&&Date.parse(item.expires_at)<=Date.now())continue;
  const terms=new Set(tokens(item.question+' '+item.title));
  if(!terms.size)continue;
  const shared=[...query].filter(x=>terms.has(x)).length;
  const precision=shared/query.size;
  const coverage=shared/Math.min(Math.max(terms.size,1),query.size);
  // Do not match a generic single shared word for complex queries.
  if(shared<Math.min(2,query.size)||precision<.6||coverage<.6)continue;
  out.push({entry:item,matchScore:Math.round(100*(precision+coverage)/2)});
 }
 return out.sort((a,b)=>b.matchScore-a.matchScore||String(a.entry.id).localeCompare(String(b.entry.id))).slice(0,limit);
}
export function decideGroundedDraft(question,entries=[],options={}){
 const risk=assessRisk(question,options);
 const matching=rankKnowledge(question,entries);
 if(risk.blocks.length)return {kind:'blocked',suggestion:null,citations:matching.slice(0,3).map(x=>({id:x.entry.id,revision:x.entry.revision,title:x.entry.title})),
  reasonCodes:risk.blocks,riskLevel:'high',confidence:null,confidenceStatus:'uncalibrated',matchScore:matching[0]?.matchScore||0};
 if(!matching.length)return {kind:'no_knowledge',suggestion:null,citations:[],reasonCodes:['MISSING_APPROVED_KNOWLEDGE'],
  riskLevel:'medium',confidence:null,confidenceStatus:'uncalibrated',matchScore:0};
 const top=matching[0];
 return {kind:'approved_faq',suggestion:top.entry.answer,citations:[{id:top.entry.id,revision:top.entry.revision,title:top.entry.title}],
  reasonCodes:['HUMAN_APPROVAL_REQUIRED','UNCALIBRATED_CONFIDENCE'],riskLevel:'low',confidence:null,confidenceStatus:'uncalibrated',matchScore:top.matchScore};
}

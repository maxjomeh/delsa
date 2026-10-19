// Explainable, deterministic SIMA customer intelligence. All signals come from
// tenant-scoped CRM rows; this is not an LLM inference or a prediction of a person.
const daysSince=(value,now)=>{
 const time=Date.parse(value||'');
 return Number.isFinite(time)?Math.max(0,(now-time)/86400000):Infinity;
};
const ordered=(a,b)=>Date.parse(b?.at||'')-Date.parse(a?.at||'');
const first=(rows,fn)=>rows.find(fn);
const stageLabels={new:'فرصت جدید',qualified:'در حال بررسی',offered:'پیشنهاد ارسال‌شده',won:'فروش موفق',lost:'از دست‌رفته'};
const channels={manual:'ثبت دستی',instagram:'اینستاگرام',whatsapp:'واتساپ',telegram:'تلگرام',bale:'بله',eitaa:'ایتا',rubika:'روبیکا',soroush:'سروش',website:'وب‌سایت',phone:'تماس'};
const add=(map,items)=>{
 for(const item of items||[]){
  if(!item?.customer_id)continue;
  if(!map.has(item.customer_id))map.set(item.customer_id,[]);
  map.get(item.customer_id).push(item);
 }
 return map;
};
export function customerIntelligence(customers=[],interactions=[],orders=[],leads=[],tasks=[],informationQueue=[],now=Date.now()){
 const ir=add(new Map(),interactions),or=add(new Map(),orders),lr=add(new Map(),leads),tr=add(new Map(),tasks),qr=add(new Map(),informationQueue);
 return (customers||[]).map(customer=>{
  const messages=[...(ir.get(customer.id)||[])].sort((a,b)=>Date.parse(b.occurred_at||b.created_at)-Date.parse(a.occurred_at||a.created_at));
  const purchases=(or.get(customer.id)||[]).filter(o=>o.status==='paid');
  const spend=purchases.reduce((sum,o)=>sum+Math.max(0,Number(o.amount)||0),0);
  const opportunities=(lr.get(customer.id)||[]).filter(l=>!['lost','won'].includes(l.stage));
  const scheduled=(tr.get(customer.id)||[]).filter(t=>t.status==='scheduled').sort((a,b)=>Date.parse(a.due_at)-Date.parse(b.due_at));
  const overdue=first(scheduled,t=>Date.parse(t.due_at)<=now);
  const latest=messages[0]||null;
  const needsReply=!!latest&&latest.direction==='inbound'&&latest.kind!=='note';
  const lastContact=latest?.occurred_at||latest?.created_at||null;
  const age=daysSince(lastContact,now);
  const hasSignal=messages.length+purchases.length+opportunities.length+scheduled.length>0;
  const blocked=!!customer.do_not_contact;
  let score=null;
  const reasons=[];
  if(hasSignal&&!blocked){
   let points=25;
   if(messages.length){const boost=Math.min(20,messages.length*3);points+=boost;reasons.push({positive:true,text:messages.length+' تعامل ثبت‌شده'});}
   if(age<=7){points+=12;reasons.push({positive:true,text:'تعامل در ۷ روز اخیر'});}
   else if(age>30&&age!==Infinity){points-=8;reasons.push({positive:false,text:'بیش از ۳۰ روز بدون تعامل'});}
   if(purchases.length){points+=16;reasons.push({positive:true,text:'سابقه خرید ثبت‌شده'});}
   if(purchases.length>=2){points+=10;reasons.push({positive:true,text:'خرید تکراری'});}
   if(opportunities.length){points+=12;reasons.push({positive:true,text:'فرصت فروش باز'});}
   if(needsReply){points+=15;reasons.push({positive:true,text:'پیام دریافتی منتظر پاسخ'});}
   if(overdue){points+=12;reasons.push({positive:true,text:'پیگیری سررسیدشده'});}
   score=Math.max(0,Math.min(100,Math.round(points)));
  }
  const info=first(qr.get(customer.id)||[],q=>q?.question);
  let next={title:'اقدام فوری ثبت نشده',description:'در صورت نیاز، یک یادداشت یا پیگیری ثبت کنید.',kind:'none'};
  if(blocked)next={title:'ارتباط با مشتری متوقف شده',description:'درخواست عدم تماس ثبت شده؛ هیچ پیگیری خودکاری پیشنهاد نمی‌شود.',kind:'blocked'};
  else if(needsReply)next={title:'پاسخ به آخرین پیام مشتری',description:'آخرین تعامل ثبت‌شده، پیام دریافتی است. ابتدا درخواست مشتری را بررسی کنید.',kind:'reply'};
  else if(overdue)next={title:'پیگیری سررسیدشده',description:overdue.title||'یک پیگیری برنامه‌ریزی‌شده موعدش گذشته است.',kind:'task'};
  else if(scheduled[0])next={title:'پیگیری برنامه‌ریزی‌شده',description:scheduled[0].title||'پیگیری بعدی را در زمان مقرر انجام دهید.',kind:'task'};
  else if(opportunities.length)next={title:'بررسی فرصت فروش باز',description:opportunities[0].title||'نیاز مشتری هنوز در جریان است.',kind:'lead'};
  else if(info)next={title:'اطلاعات تکمیلی در تعامل بعدی',description:info.question,kind:'information'};
  const timeline=[
   ...messages.map(i=>({id:'i:'+i.id,type:'interaction',kind:i.kind,label:i.kind==='call'?'تماس':i.kind==='offer'?'پیشنهاد':i.kind==='note'?'یادداشت':'پیام',text:i.body,channel:channels[i.channel]||i.channel,direction:i.direction,at:i.occurred_at||i.created_at})),
   ...(or.get(customer.id)||[]).map(o=>({id:'o:'+o.id,type:'order',label:o.status==='paid'?'خرید':'سفارش',text:'سفارش '+(o.reference||'')+' · '+(o.status==='paid'?'پرداخت‌شده':o.status==='cancelled'?'لغوشده':'در انتظار'),at:o.created_at,amount:o.amount})),
   ...(lr.get(customer.id)||[]).map(l=>({id:'l:'+l.id,type:'lead',label:'فرصت فروش',text:(l.title||'')+' · '+(stageLabels[l.stage]||'در جریان'),at:l.created_at,amount:l.amount})),
   ...(tr.get(customer.id)||[]).map(t=>({id:'t:'+t.id,type:'task',label:'پیگیری',text:(t.title||'')+' · '+(t.status==='completed'?'انجام‌شده':t.status==='cancelled'?'لغوشده':'برنامه‌ریزی‌شده'),at:t.created_at}))
  ].filter(x=>Number.isFinite(Date.parse(x.at))).sort(ordered).slice(0,90);
  return {customer,score,reasons,needsReply,overdue:!!overdue,next,latest,opportunities,scheduled,purchases,spend,timeline,interactionCount:messages.length,orderCount:purchases.length,lastContact,hasSignal};
 });
}
export function rankCustomers(profiles,filter='all',query=''){
 const q=String(query).trim().toLocaleLowerCase('fa-IR');
 return profiles.filter(p=>{
  if(filter==='needs_reply'&&!p.needsReply)return false;
  if(filter==='followups'&&!p.overdue&&!p.scheduled.length)return false;
  if(filter==='buyers'&&!p.purchases.length)return false;
  if(filter==='opportunities'&&!p.opportunities.length)return false;
  if(filter==='quiet'&&p.score!==null)return false;
  const c=p.customer;
  return !q||[c.name,c.instagram,c.phone,c.city,c.tags,c.notes].some(x=>String(x||'').toLocaleLowerCase('fa-IR').includes(q));
 }).sort((a,b)=>{
  if(a.customer.do_not_contact!==b.customer.do_not_contact)return a.customer.do_not_contact?1:-1;
  if(a.score!==b.score)return (b.score??-1)-(a.score??-1);
  return (a.customer.name||'').localeCompare(b.customer.name||'','fa');
 });
}

export const STATUSES=[['idea','ایده'],['triage','در انتظار تحلیل'],['ready','آماده توسعه'],['in_progress','در حال توسعه'],['testing','در حال تست'],['preview','در Preview'],['released','منتشر شده'],['verified','تأیید عملیاتی'],['blocked','مسدود'],['cancelled','لغو شده']];
export const WORKSTREAMS=[['engineering','توسعه'],['security','امنیت'],['infra','زیرساخت'],['ui_ux','رابط کاربری'],['data','داده'],['quality','کیفیت'],['research','تحقیق'],['operations','عملیات'],['business','کسب و کار']];
export const TYPES=[['idea','ایده'],['feature','قابلیت'],['improvement','ارتقا'],['bug','باگ'],['security','امنیت'],['performance','بهینه سازی'],['infrastructure','زیرساخت'],['research','آزمایش'],['maintenance','نگهداری']];
export const SCOPES=[['product','محصول'],['platform','کل پلتفرم'],['cross_product','چند محصولی']];
export const PRIORITIES=['P0','P1','P2','P3'];
export const EVIDENCE_KINDS=[['pr','Pull Request'],['commit','Commit'],['ci','CI/Test'],['preview','Preview'],['production_deployed','انتشار Production'],['production_e2e','تست واقعی Production'],['database','دیتابیس'],['documentation','مستندات'],['manual_test','تست دستی']];
export const valid=(list,x)=>list.some(item=>Array.isArray(item)?item[0]===x:item===x);
export const nonempty=(x,n)=>typeof x==='string'&&x.trim().length>0&&x.length<=n;
export const validCriteria=a=>Array.isArray(a)&&a.length<=24&&a.every(x=>nonempty(x,400));
export const validCodes=a=>Array.isArray(a)&&a.length<=12&&a.every(x=>typeof x==='string'&&/^[a-z0-9_]{2,60}$/.test(x));
export const isUuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
export const validURL=x=>x==null||x===''||(typeof x==='string'&&x.length<=2000&&/^https:\/\/[^\s]+$/.test(x));
export const validSHA=x=>x==null||x===''||(typeof x==='string'&&/^[0-9a-f]{40}$/.test(x));
export function validTaskInput(x){
 return !!x&&nonempty(x.title,240)&&x.title.trim().length>=5&&(!x.description||typeof x.description==='string'&&x.description.length<=8000)&&
 valid(SCOPES,x.scope)&&validCodes(x.productCodes)&&
 (x.scope==='platform'||x.scope==='product'&&x.productCodes.length===1||x.scope==='cross_product'&&x.productCodes.length>=2)&&
 valid(WORKSTREAMS,x.workstream)&&valid(TYPES,x.taskType)&&valid(PRIORITIES,x.priority)&&
 valid(STATUSES,x.status)&&validCriteria(x.acceptanceCriteria)&&
 (x.phaseRef==null||/^p[0-6]f[0-9]{1,3}$/.test(x.phaseRef))&&(!x.sprintId||isUuid(x.sprintId));
}

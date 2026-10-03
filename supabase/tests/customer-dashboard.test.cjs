const ts=require('typescript');
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=require('path').resolve(__dirname,'../..')+'/';
const React=require(root+'node_modules/react'),{renderToStaticMarkup}=require(root+'node_modules/react-dom/server');
function load(path,mocks){const src=ts.transpileModule(fs.readFileSync(root+path,'utf8'),{fileName:'test.tsx',compilerOptions:{esModuleInterop:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText;const module={exports:{}};vm.runInNewContext(src,{module,exports:module.exports,require:n=>n in mocks?mocks[n]:require(n),React,process,console,setInterval,clearInterval});return module.exports;}
const icons=new Proxy({},{get:(_,key)=>key==='__esModule'?false:()=>React.createElement('svg')});
const fakeReact={...React,useEffect:()=>{},useState:v=>[typeof v==='function'?v():v,()=>{}],useMemo:f=>f(),Activity:({mode,children})=>mode==='hidden'?null:children};
const sub=code=>({id:code,product_id:code,starts_at:'2026-01-01',expires_at:'2099-01-01',store_products:{name:code==='apu'?'سیستم APU':'سایت ساز',service_code:code}});
const Overview=load('components/CustomerServiceOverview.js',{'react':fakeReact,'lucide-react':icons}).default;
const overview=subs=>renderToStaticMarkup(React.createElement(Overview,{mode:'overview',subscriptions:subs,hasApu:subs.some(s=>s.product_id==='apu'),runs:[],sources:[],rules:[],db:{},userId:'test',onOpen:()=>{}}));
assert(!overview([sub('site_builder')]).includes('منابع فعال APU'));
assert(overview([sub('site_builder')]).includes('ورود به سایت‌ساز'));
assert(overview([sub('apu')]).includes('منابع فعال APU'));
assert(!overview([sub('apu')]).includes('ورود به سایت‌ساز'));
assert(overview([]).includes('هنوز اشتراک فعالی نداری'));
const Dashboard=load('components/CustomerDashboard.js',{'react':fakeReact,'next/link':({children,...p})=>React.createElement('a',p,children),'next/dynamic':()=>()=>null,'./ChatMessage':()=>null,'./ApuWorkspace':()=>null,'./CustomerServiceOverview':Overview,'../lib/supabase/client':{createClient:()=>({})},'../lib/subscription-days':{daysRemainingIran:()=>1},'lucide-react':icons}).default;
const dash=subs=>renderToStaticMarkup(React.createElement(Dashboard,{userId:'test',name:'مشتری',hasApu:subs.some(s=>s.product_id==='apu'),subscriptions:subs,initialSources:[],initialRules:[],initialRuns:[],initialMessages:[]}));
assert(!dash([sub('site_builder')]).includes('سیستم APU'));
assert(dash([sub('apu')]).includes('سیستم APU'));
assert(!dash([sub('apu')]).includes('مدیریت منابع'));

const StoreList=load('components/StoreProductsAdmin.js',{'react':fakeReact,'lucide-react':icons}).StoreProductsList;
const productList=published=>renderToStaticMarkup(React.createElement(StoreList,{products:[{id:'p',name:'محصول',is_published:published}]}));
assert(productList(true).includes('منتشرشده'));
assert(productList(true).includes('بایگانی'));
assert(!productList(true).includes('فعال‌سازی'));
assert(productList(false).includes('فعال‌سازی'));
assert(!productList(false).includes('منتشرشده'));

async function testLogin(path,user,role,expected){
const prefix=path.startsWith('app/admin')?'../../../':'../../';
const db={auth:{getUser:async()=>({data:{user}})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{role}})})})})};
const mocks={'next/navigation':{redirect:p=>{throw Error('REDIRECT:'+p)}},react:React};
mocks[prefix+'lib/supabase/server']={createClient:async()=>db};
mocks[prefix+'lib/supabase/config']={isSupabaseConfigured:()=>true};
mocks[prefix+'components/AuthForm']=()=>null;
mocks[prefix+'components/auth.css']={};
const Page=load(path,mocks).default;
if(expected)await assert.rejects(Page(),{message:'REDIRECT:'+expected});else assert(await Page());
}
(async()=>{for(const p of ['app/login/page.js','app/admin/login/page.js']){await testLogin(p,{id:'u'},'admin','/admin');await testLogin(p,{id:'u'},'user','/dashboard');await testLogin(p,null,null,null)}console.log('PASS: service-specific overview/menu and customer/admin session return routing');})();

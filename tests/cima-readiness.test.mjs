import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {redactText,reachableStage,buildReadiness,renderMarkdown,auditExport} from '../lib/crm/readiness-report.mjs';
import {runBacktest} from '../lib/crm/backtest.mjs';
import {topicConfidence} from '../lib/crm/topic-confidence.mjs';
import {NOW,HOURS_REPLY,SHIP_REPLY,conversations,standard} from './helpers/conversations.mjs';

const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const root=new URL('..',import.meta.url).pathname;
const entry=(id,question,answer)=>({id,title:question,question,answer,status:'approved',revision:1,expires_at:null});
const hoursK=entry('k-hours','ساعت کاری شما چیه',HOURS_REPLY),shipK=entry('k-ship','ارسال به شهرستان دارید',SHIP_REPLY);
const readiness=(rows,knowledge=[])=>buildReadiness(runBacktest({interactions:rows,knowledge,now:NOW}),{knowledge});
const hash=v=>createHash('md5').update(String(v)).digest('hex');
const exportOf=(rows,knowledge=[])=>({format:'cima-readiness-export/1',interactions:rows.map(r=>({id:hash(r.id),customer_id:hash(r.customer_id),channel:r.channel,direction:r.direction,kind:r.kind,occurred_at:r.occurred_at,body:redactText(r.body)})),knowledge});

// ---------- masking ----------
test('personal data is masked; business figures and ordinary text are kept; masking is idempotent',()=>{
 const cases=[
  ['ایمیل من ali.r@example.com است','[ایمیل]'],['https://example.com/x?id=1 را ببین','[لینک]'],['www.shop.ir','[لینک]'],['آیدی من @ali_r است','@[آیدی]'],
  ['شماره ۰۹۱۲۱۱۱۰۰۰۱','[عدد بلند]'],['0912 111 0001','[عدد بلند]'],['٠٩١٢١١١٠٠٠١','[عدد بلند]'],['کارت 6037-9911-2233-4455','[عدد بلند]'],['قیمت ۴٬۵۰۰٬۰۰۰ تومان','[عدد بلند]'],
 ];
 for(const [input,mark] of cases){const out=redactText(input);assert.ok(out.includes(mark),`${input} -> ${out}`);assert.equal(redactText(out),out,'idempotent');}
 for(const keep of ['ساعت کاری ما شنبه تا چهارشنبه ۹ تا ۱۷ است','۳ عدد و ۱۲ روز','کد ۱۲۳۴','سلام @ و # خوبی؟','ساعت 9:30 تا 17:45']){assert.equal(redactText(keep),keep,keep);}
 assert.equal(redactText(null),'');assert.equal(redactText(undefined),'');assert.equal(redactText(12345),'12345');
});

// ---------- what a topic can reach ----------
test('projection: evidence and knowledge decide how far a topic could go; never-auto stops at a human',()=>{
 const strong=topicConfidence(Array.from({length:40},()=>({outcome:'accepted',source:'backtest',at:NOW})),{now:NOW});
 const medium=topicConfidence([...Array.from({length:36},()=>({outcome:'accepted',source:'backtest',at:NOW})),...Array.from({length:4},()=>({outcome:'rejected',source:'backtest',at:NOW}))],{now:NOW});
 const thin=topicConfidence(Array.from({length:8},()=>({outcome:'accepted',source:'backtest',at:NOW})),{now:NOW});
 assert.equal(reachableStage({confidence:strong,knowledgeApproved:1,neverAuto:false}).stage,'auto');
 assert.equal(reachableStage({confidence:strong,knowledgeApproved:0,neverAuto:false}).stage,'learning','no approved answer: it cannot even start');
 assert.equal(reachableStage({confidence:medium,knowledgeApproved:1,neverAuto:false}).stage,'suggest');
 assert.equal(reachableStage({confidence:thin,knowledgeApproved:1,neverAuto:false}).stage,'shadow');
 assert.equal(reachableStage({confidence:strong,knowledgeApproved:1,neverAuto:true}).stage,'suggest','the engine itself never lets a never-auto topic past suggest');
});

// ---------- the report ----------
test('the report finds the topics, keeps price human-only and tells the owner what to do, in order',()=>{
 const r=readiness(standard(),[hoursK]);
 assert.equal(r.topics.length,3);
 const price=r.topics.find(t=>t.neverAuto);assert.equal(price.pairs,6);assert.equal(price.blocked,6);assert.equal(price.reachable.reason,'NEVER_AUTO_TOPIC');
 assert.equal(r.summary.humanOnlyTopics,1);assert.equal(r.summary.pairs,22);
 const codes=r.actions.map(a=>a.code);
 assert.equal(codes[0],'HUMAN_ONLY');
 const write=r.actions.filter(a=>a.code==='WRITE_KNOWLEDGE');
 assert.equal(write.length,1,'only the shipping topic lacks an approved answer');assert.match(write[0].suggestion.answer,/پست پیشتاز/);
 assert.ok(!r.actions.some(a=>a.code==='WRITE_KNOWLEDGE'&&a.key===price.key),'never bootstrap price knowledge');
 const priorities=r.actions.map(a=>a.priority);assert.deepEqual(priorities,[...priorities].sort((a,b)=>a-b),'most important first');
 assert.deepEqual(readiness(standard(),[hoursK]).actions,r.actions,'deterministic');
});
test('actions: wrong knowledge, ambiguity, thin data, low coverage',()=>{
 const wrong=readiness(standard(),[entry('k-hours','ساعت کاری شما چیه','ساعت کاری ما ۱۰ تا ۲۰ است')]);
 assert.ok(wrong.actions.some(a=>a.code==='ANSWERS_DIFFER'&&a.rejectionRate>=0.3));
 const ambiguous=readiness(standard(),[entry('k1','ساعت کاری شما','پاسخ الف'),entry('k2','ساعت کاری','پاسخ ب')]);
 assert.ok(ambiguous.actions.some(a=>a.code==='RESOLVE_AMBIGUITY'&&a.ambiguous>0));
 assert.ok(readiness(standard(),[hoursK]).actions.some(a=>a.code==='LOW_DATA'),'8 conversations are not enough to rely on');
 const sparse=readiness(standard(),[entry('k-hours','ساعت کاری شما چیه',HOURS_REPLY),entry('k-x','ساعت کاری فروشگاه چطوریه','ساعت متفاوت دیگری')]);
 assert.ok(sparse.topics.length>0);
 const none=readiness([],[]);assert.deepEqual([none.topics,none.actions],[[],[]]);assert.equal(none.summary.pairs,0);
});
test('with enough consistent history a topic is reported as able to reach the automatic stage — as a projection, not a promise',()=>{
 const rows=conversations(Array.from({length:40},()=>['ساعت کاری شما چیه؟',HOURS_REPLY]));
 const r=readiness(rows,[hoursK]);
 assert.deepEqual(r.summary.eligibleForAuto.length,1);assert.equal(r.topics[0].reachable.stage,'auto');assert.deepEqual(r.topics[0].reachable.path,['learning','shadow','suggest','auto']);
 assert.equal(r.topics[0].confidence.status,'measured');
 const md=renderMarkdown(r,{generatedAt:NOW});
 assert.match(md,/پیش‌بینی/);assert.match(md,/شرط‌های زنده/);
});
test('Markdown report: complete, Persian numerals, masked by default, loud when masking is off',()=>{
 const rows=[...standard(),...conversations([['ساعت کاری شما چیه؟ ali@example.com ۰۹۱۲۱۱۱۰۰۰۱ @ali_r',HOURS_REPLY+' تماس ۰۹۱۲۱۱۱۰۰۰۲']],{startId:700})];
 const r=readiness(rows,[]);
 const md=renderMarkdown(r,{generatedAt:NOW});
 for(const h of ['# گزارش آمادگی سیما','## خلاصه','## موضوع‌ها','## کارهای پیشنهادی','## چطور خوانده شود'])assert.ok(md.includes(h),h);
 assert.doesNotMatch(md,/undefined|NaN|null|\[object/);
 assert.doesNotMatch(md,/\d+٪/,'percentages use Persian digits');
 assert.doesNotMatch(md,/ali@example|۰۹۱۲۱۱۱۰۰۰۲|@ali_r\b/);
 assert.match(md,/ماسک شده است/);
 const raw=renderMarkdown(r,{redact:false,generatedAt:NOW});
 assert.match(raw,/ماسک‌کردن اطلاعات شخصی خاموش است/);
 assert.ok(md.split('\n').filter(l=>l.startsWith('|')).every(l=>l.split('|').length===r.topics.length*0+10||l.startsWith('|---')),'table rows are well formed');
});

// ---------- auditing an export ----------
test('audit passes a masked export and flags anything personal without echoing it',()=>{
 const clean=exportOf([...standard(),...conversations([['ساعت کاری شما چیه؟ ali@example.com ۰۹۱۲۱۱۱۰۰۰۱ https://x.ir @ali_r',HOURS_REPLY]],{startId:800})]);
 assert.deepEqual(auditExport(clean),{ok:true,findings:[]});
 const leaky=JSON.parse(JSON.stringify(clean));
 leaky.interactions[0].body+=' ali@example.com https://x.ir @ali_r 09121110001';
 leaky.interactions[1].customer_id='c0000000-0000-0000-0000-0000000000c1';
 leaky.interactions[2].phone='09121110001';
 leaky.knowledge=[entry('k','تماس با 09121110001','پاسخ')];
 const result=auditExport(leaky);
 assert.equal(result.ok,false);
 const kinds=new Set(result.findings.map(f=>f.kind));
 for(const k of ['EMAIL','LINK','HANDLE','LONG_DIGITS','IDENTIFIER_NOT_HASHED','UNEXPECTED_FIELD','KNOWLEDGE_LONG_DIGITS'])assert.ok(kinds.has(k),k);
 assert.doesNotMatch(JSON.stringify(result),/example\.com|09121110001|ali_r/,'findings never echo the personal text');
 assert.deepEqual(auditExport(null),{ok:true,findings:[]});
});

// ---------- the command line ----------
test('CLI: report in Markdown or JSON, audit exit codes, clear errors',()=>{
 const dir=mkdtempSync(join(tmpdir(),'cima-ready-'));
 const run=(args)=>spawnSync('node',['scripts/cima-readiness.mjs',...args],{cwd:root,encoding:'utf8'});
 try{
  const file=join(dir,'export.json');
  writeFileSync(file,JSON.stringify(exportOf(standard(),[hoursK])));
  const md=run(['--input',file,'--now','2026-11-22T09:00:00Z']);
  assert.equal(md.status,0);assert.match(md.stdout,/# گزارش آمادگی سیما/);assert.match(md.stderr,/topics=3 humanOnly=1/);
  const out=join(dir,'report.md');
  assert.equal(run(['--input',file,'--now','2026-11-22T09:00:00Z','--out',out]).status,0);assert.match(readFileSync(out,'utf8'),/## کارهای پیشنهادی/);
  const json=run(['--input',file,'--format','json','--now','2026-11-22T09:00:00Z']);
  assert.equal(json.status,0);assert.equal(JSON.parse(json.stdout).topics.length,3);
  assert.equal(run(['--input',file,'--audit']).status,0);assert.match(run(['--input',file,'--audit']).stderr,/audit: ok/);
  const bad=exportOf(standard(),[hoursK]);bad.interactions[0].body+=' ali@example.com';writeFileSync(join(dir,'bad.json'),JSON.stringify(bad));
  const audited=run(['--input',join(dir,'bad.json'),'--audit']);assert.equal(audited.status,3);assert.match(audited.stderr,/EMAIL @ interactions\[0\]\.body/);assert.doesNotMatch(audited.stderr,/ali@example/);
  const generating=run(['--input',join(dir,'bad.json'),'--now','2026-11-22T09:00:00Z']);assert.equal(generating.status,0);assert.match(generating.stderr,/warning: the export contains/);assert.doesNotMatch(generating.stdout,/ali@example/,'the report itself stays masked');
  assert.equal(run([]).status,2);assert.equal(run(['--input',file,'--format','pdf']).status,2);assert.equal(run(['--input',file,'--min-occurrences','1']).status,2);assert.equal(run(['--input',join(dir,'missing.json')]).status,2);
  writeFileSync(join(dir,'nope.json'),'{"nope":1}');assert.equal(run(['--input',join(dir,'nope.json')]).status,2);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

// ---------- the SQL export (static; it was also run on a real Postgres) ----------
test('the SQL export is read-only, reads two tables of one tenant, hashes ids, masks personal data and bounds its size',()=>{
 const sql=read('../supabase/exports/cima-readiness-export.sql');
 const code=sql.split('\n').map(l=>l.replace(/--.*$/,'')).join('\n');
 assert.doesNotMatch(code,/\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|call|do\s+\$|execute)\b/i,'no statement that changes anything');
 assert.match(code,/^\s*with params as/m);assert.match(code,/\bselect\b/i);
 assert.deepEqual([...code.matchAll(/\b(?:from|join)\s+(?:public\.)?([a-z_]+)/gi)].map(m=>m[1]).filter(t=>t.startsWith('crm_')||t.startsWith('sima_')).sort(),['crm_interactions','sima_knowledge_entries']);
 assert.doesNotMatch(code,/profiles|auth\.|customer_subscriptions|crm_customers|crm_zernio|credential|token|secret/i,'no names, phones, handles, tokens');
 assert.match(code,/tenant_id = p\.tenant/);assert.equal((code.match(/tenant_id = p\.tenant/g)||[]).length,2,'both tables are filtered by the tenant');
 assert.match(code,/md5\(r\.id::text \|\| p\.tenant::text\)/);assert.match(code,/md5\(r\.customer_id::text \|\| p\.tenant::text\)/);
 for(const mask of ['[ایمیل]','[لینک]','@[آیدی]','[عدد بلند]'])assert.ok(code.includes(mask),mask);
 assert.match(code,/left\(r\.body, 600\)/);assert.match(code,/interval '180 days'/);assert.match(code,/20000/);
 assert.match(code,/k\.status = 'approved'/);assert.match(code,/i\.kind = 'message'/);
 assert.doesNotMatch(code,/external_event_id/);
 assert.match(sql,/READ ONLY/);assert.match(sql,/00000000-0000-0000-0000-000000000000/,'a placeholder, never a real tenant id');
});
test('the readiness library is pure: no network, files, environment or sending',()=>{
 const src=read('../lib/crm/readiness-report.mjs').split('\n').filter(l=>!l.trim().startsWith('//')).join('\n');
 assert.doesNotMatch(src,/\bfetch\(|zernio|supabase|createClient|process\.env|readFile|writeFile|outbox|sendMessage|child_process/i);
});

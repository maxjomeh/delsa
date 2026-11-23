import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const code=src=>src.split('\n').filter(line=>!line.trim().startsWith('//')).join('\n');
const route=code(read('../app/api/crm/topics/route.js'));
const store=code(read('../lib/crm/topic-store.mjs'));

test('topics API: authenticated, CRM-entitled, same-origin for writes, bounded body, whitelisted actions',()=>{
 assert.match(route,/auth\.auth\.getUser\(\)/);assert.match(route,/has_active_crm/);
 assert.match(route,/status:401/);assert.match(route,/status:403/);
 assert.match(route,/request\.headers\.get\('origin'\)!==new URL\(request\.url\)\.origin/);
 assert.match(route,/content-length[^;]*>20000/);
 for(const action of ['discover','replay','set_fields','rename','activate','retire','set_floor','reset_threshold'])assert.match(route,new RegExp(`'${action}'`),action);
 assert.match(route,/error:'invalid_action'/);
 assert.match(route,/uuid\(body\?\.id\)/,'ids are validated before any query');
 assert.match(route,/export async function GET/);assert.match(route,/export async function POST/);
 assert.doesNotMatch(route,/export async function (PUT|PATCH|DELETE)/);
});
test('topics API never sends, never touches the autonomy switch, and only reads tenant-scoped field definitions directly',()=>{
 assert.doesNotMatch(route,/zernio|outbox|sendMessage|\/send/i);
 assert.doesNotMatch(route,/sima_autonomy_settings|auto_enabled|paused_at/,'the tenant switch is not exposed in this phase');
 const directQueries=[...route.matchAll(/db\.from\('([a-z_]+)'\)/g)].map(m=>m[1]);
 assert.deepEqual(directQueries,['crm_field_definitions']);
 assert.match(route,/\.eq\('tenant_id',ctx\.id\)\.eq\('enabled',true\)/);
 assert.doesNotMatch(route,/\.(insert|update|delete|upsert)\(/,'all writes go through the store');
});
test('every user-facing error the store can return is mapped to a client status; the store is never handed another tenant id',()=>{
 const mapped=new Set([...route.match(/const STATUS=\{([^}]+)\}/)[1].matchAll(/(\w+):\d+/g)].map(m=>m[1]));
 const emitted=new Set([...store.matchAll(/(?:fail\('|error: ')(\w+)'/g)].map(m=>m[1]));
 const infrastructure=new Set(['topics_unavailable','interactions_unavailable','knowledge_unavailable','fields_unavailable','outcomes_unavailable']);   // 503 by default
 for(const code of emitted)if(!infrastructure.has(code))assert.ok(mapped.has(code),`${code} must map to a 4xx`);
 for(const call of route.matchAll(/(?:updateTopic|setRequiredFields|discover|replay|describeTopics|loadAutonomy)\(db,([^,)]+)/g))assert.equal(call[1],'ctx.id',call[0]);
});
test('store: every query is tenant-scoped in the source too (no .from() without a tenant filter or tenant payload)',()=>{
 const statements=store.split(/\n\s*(?=(?:const|let|return|await|if)\b)/).filter(s=>/db\.from\(/.test(s));
 assert.ok(statements.length>10);
 for(const stmt of statements)assert.match(stmt,/tenant_id|tenantId/,stmt.slice(0,120));
});
test('topic-store is the only place that writes topic tables, and it has no network or sending code',()=>{
 assert.doesNotMatch(store,/\bfetch\(|zernio|outbox|sendMessage|process\.env/i);
 assert.doesNotMatch(store,/sima_autonomy_settings'\)\.(insert|update|upsert|delete)/);
 assert.doesNotMatch(store,/\.from\('crm_(customers|interactions|leads|orders|tasks)'\)\.(insert|update|upsert|delete)/,'the CRM records themselves are never modified');
});

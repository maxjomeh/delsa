import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {safeSocialImage,socialProfile} from '../lib/crm/social-profile.mjs';
import {uniqueDisplayMessages} from '../lib/crm/dedupe-display.mjs';
import {buildConversations} from '../lib/crm/inbox.mjs';
const src=p=>readFileSync(p,'utf8');

test('real HTTPS social image with s in host/path is not rejected',()=>{
 const url='https://images.example.com/assets/instagram/avatar-abc.jpg';
 assert.equal(safeSocialImage(url),url);
 assert.equal(safeSocialImage('http://images.example.com/a.png'),null);
 assert.equal(safeSocialImage('https://secret@images.example.com/a.png'),null);
 assert.equal(safeSocialImage('javascript:alert(1)'),null);
});

test('Instagram profile link is derived only from a well-formed handle',()=>{
 const a=socialProfile({instagram:'my.store_3',custom_fields:{social_platform:'instagram',social_avatar_url:'https://images.example.com/pic.png'}});
 assert.equal(a.href,'https://www.instagram.com/my.store_3/');
 assert.equal(a.avatar,'https://images.example.com/pic.png');
 assert.equal(socialProfile({instagram:'x/../bad',custom_fields:{}}).href,null);
});

test('hide only presentation duplicates, do not delete CRM message rows',()=>{
 const row={id:'1',tenant_id:'t',customer_id:'c',channel:'instagram',kind:'message',direction:'inbound',body:'سلام',occurred_at:'2026-10-20T12:00:00Z',external_event_id:'zernio-msg:aaa'};
 const copy={...row,id:'2',external_event_id:'zernio-msg:bbb'};
 const another={...row,id:'3',direction:'outbound',external_event_id:'zernio-msg:ccc'};
 const later={...row,id:'4',occurred_at:'2026-10-20T12:00:01Z',external_event_id:'zernio-msg:ddd'};
 const raw=[row,copy,another,later];
 assert.deepEqual(uniqueDisplayMessages(raw).map(x=>x.id),['1','3','4']);
 assert.equal(raw.length,4);
 assert.equal(buildConversations([{id:'c',name:'مشتری'}],uniqueDisplayMessages(raw))[0].count,3);
});

test('main workspace has refresh isolation and independently usable sections',()=>{
 const code=src('components/crm/SimaWorkspace.js');
 assert.match(code,/const maxPages=\['inbox','customers','interactions'\]\.includes\(section\)\?8:1/);
 assert.match(code,/setInterval\(refresh,90000\)/);
 assert.match(code,/request!==loadSeq\.current/);
 assert.match(code,/results\[i\]\.error\?prev\[k\]/);
 assert.match(code,/if\(!extras\[0\]\.error\)setFields/);
 assert.doesNotMatch(code,/results\.some\(r=>r\.error\)\|\|cfg\.error\).*return/);
});

test('send diagnostics show block reasons but do not send a message during health check',()=>{
 const route=src('app/api/crm/reviews/send/route.js');
 const health=src('app/api/crm/health/route.js');
 const ui=src('components/crm/HumanReviewWorkspace.js');
 assert.match(route,/canRequestSend:reasons\.length===0/);
 assert.match(route,/already_attempted/);
 assert.match(ui,/sendEligibility/);
 assert.match(ui,/مهلت پاسخ عادی اینستاگرام تمام شده/);
 assert.match(health,/auth\.auth\.getUser\(\)/);
 assert.match(health,/has_active_crm/);
 assert.match(health,/not_configured_in_this_deployment/);
 assert.doesNotMatch(health,/zernioRequest\(|sima_prepare_human_send|sima_claim_human_send/);
});

test('inbox and review show safe platform identity and make manual logging unambiguous',()=>{
 const inbox=src('components/crm/SimaInbox.js');
 const review=src('components/crm/HumanReviewWorkspace.js');
 const profile=src('components/crm/CustomerIntelligence.js');
 assert.match(inbox,/socialProfile\(row\.customer\)\.avatar/);
 assert.match(inbox,/برای ارسال واقعی انسانی/);
 assert.match(review,/socialProfile\(customer\)\.avatar/);
 assert.match(profile,/socialProfile\(customer\)\.avatar/);
});

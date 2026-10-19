
const test=require('node:test');
const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');

const tenant='dddddddd-1111-4222-8333-444444444444';
const profile='1234567890abcdef12345678';
const otherProfile='aaaaaaaaaaaaaaaaaaaaaaaa';
const account='abcdef123456789012345678';
const eventId='eeeeeeee-1111-4222-8333-555555555555';

test('raw-body HMAC is constant-time verified and rejects invalid signature',async()=>{
 const {verifyZernioSignature}=await import('../../lib/crm/zernio.mjs');
 const raw=Buffer.from('{"event":"webhook.test"}','utf8');
 const secret='private-test-secret';
 const signature=createHmac('sha256',secret).update(raw).digest('hex');
 assert.equal(verifyZernioSignature(raw,signature,secret),true);
 assert.equal(verifyZernioSignature(Buffer.from('changed'),signature,secret),false);
 assert.equal(verifyZernioSignature(raw,'bad',secret),false);
 assert.equal(verifyZernioSignature(raw,signature,''),false);
});

test('official inbox webhook account.profileId routes using a stored profile key, not externalId',async()=>{
 const {validatedZernioEvent}=await import('../../lib/crm/zernio.mjs');
 const payload={id:eventId,event:'message.received',timestamp:'2026-10-19T07:22:01Z',
   account:{id:account,accountId:account,profileId:profile,platform:'instagram'},
   conversation:{id:'conv1'},message:{text:'سلام'}};
 assert.deepEqual(validatedZernioEvent(payload),{eventId,profileId:profile,accountId:account,eventType:'message.received'});
 assert.deepEqual(validatedZernioEvent({...payload,event:'conversation.started'}),{eventId,profileId:profile,accountId:account,eventType:'conversation.started'});
 assert.deepEqual(validatedZernioEvent({...payload,account:{id:account,profileId:profile}}),{eventId,profileId:profile,accountId:account,eventType:'message.received'});
 assert.equal(validatedZernioEvent({...payload,account:{accountId:account,profileId:'invalid'}}),null);
 assert.equal(validatedZernioEvent({...payload,profileId:otherProfile}),null);
 assert.equal(validatedZernioEvent({...payload,id:'not-a-uuid'}),null);
 assert.equal(validatedZernioEvent({...payload,event:'post.published'}),null);
});

test('unmapped profile is distinguishable from malformed event and cannot be inferred from externalId',async()=>{
 const {validatedZernioEvent}=await import('../../lib/crm/zernio.mjs');
 const payload={id:eventId,event:'message.received',account:{accountId:account}};
 assert.deepEqual(validatedZernioEvent(payload),{eventId,profileId:null,accountId:account,eventType:'message.received'});
 assert.deepEqual(validatedZernioEvent({...payload,profiles:[{id:profile,externalId:tenant}]}),
   {eventId,profileId:profile,accountId:account,eventType:'message.received'});
 assert.equal(validatedZernioEvent({...payload,profiles:[{id:profile},{id:otherProfile}]}),null);
 assert.equal(validatedZernioEvent({...payload,account:{}}),null);
});

test('publicAccount never returns an account from another Zernio profile',async()=>{
 const {publicAccount}=await import('../../lib/crm/zernio.mjs');
 assert.deepEqual(publicAccount({_id:account,profileId:profile,platform:'instagram',username:'shop',isActive:true},profile),
  {id:account,platform:'instagram',username:'shop',connected:true,needsReconnect:false});
 assert.equal(publicAccount({_id:account,profileId:otherProfile},profile),null);
});

test('all 25 selected CRM events can normalize with official account context or accountless profile',async()=>{
 const {ZERNIO_EVENTS,validatedZernioEvent}=await import('../../lib/crm/zernio.mjs');
 assert.equal(ZERNIO_EVENTS.length,25);
 assert.equal(new Set(ZERNIO_EVENTS).size,25);
 for(const event of ZERNIO_EVENTS){
  const accountless=event.startsWith('contact.')||event.startsWith('sequence.')||event.startsWith('workflow.run.');
  const payload={id:eventId,event,profileId:profile};
  if(!accountless)payload.account={accountId:account,profileId:profile};
  const mapped=validatedZernioEvent(payload);
  assert.equal(mapped?.eventType,event,event);
  assert.equal(mapped?.profileId,profile,event);
  assert.equal(mapped?.accountId,accountless?null:account,event);
  if(!accountless){
   delete payload.account;
   assert.equal(validatedZernioEvent(payload),null,event);
  }else{
   payload.account={accountId:'invalid'};
   assert.equal(validatedZernioEvent(payload),null,event);
  }
 }
});


test('customer connects Instagram in one click without supplying a profile or provider API key',()=>{
 const {readFileSync}=require('node:fs');
 const {join}=require('node:path');
 const route=readFileSync(join(process.cwd(),'app/api/crm/zernio/route.js'),'utf8');
 const screen=readFileSync(join(process.cwd(),'components/crm/ZernioConnection.js'),'utf8');
 const workspace=readFileSync(join(process.cwd(),'components/crm/SimaWorkspace.js'),'utf8');
 assert.match(route,/const profileId=await provisionProfile\(user\.id\);/);
 assert.match(route,/if\(!entitled\)return json\(/);
 assert.match(route,/body\.action==='connect'/);
 assert.match(route,/sima_section=connections/);
 assert.match(screen,/action:'connect',platform:'instagram'/);
 assert.doesNotMatch(screen,/action:'prepare'/);
 assert.match(workspace,/section==='connections'&&<ZernioConnection\/>/);
 assert.doesNotMatch(workspace,/<InstagramConnection\/>/);
});

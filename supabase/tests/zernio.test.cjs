const test=require('node:test');
const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');

const tenant='dddddddd-1111-4222-8333-444444444444';
const profile='1234567890abcdef12345678';
const account='abcdef123456789012345678';
const eventId='eeeeeeee-1111-4222-8333-555555555555';

test('Zernio HMAC signature uses raw bytes and timing-safe comparison',async()=>{
 const {verifyZernioSignature}=await import('../../lib/crm/zernio.mjs');
 const raw=Buffer.from('{"event":"webhook.test"}','utf8');
 const secret='private-test-secret';
 const signature=createHmac('sha256',secret).update(raw).digest('hex');
 assert.equal(verifyZernioSignature(raw,signature,secret),true);
 assert.equal(verifyZernioSignature(Buffer.from('changed'),signature,secret),false);
 assert.equal(verifyZernioSignature(raw,'bad',secret),false);
 assert.equal(verifyZernioSignature(raw,signature,''),false);
});

test('Zernio event projection requires one valid matching tenant and account',async()=>{
 const {validatedZernioEvent}=await import('../../lib/crm/zernio.mjs');
 const payload={id:eventId,event:'message.received',profiles:[{id:profile,externalId:tenant}],account:{accountId:account,profileId:profile},message:{text:'سلام'}};
 assert.deepEqual(validatedZernioEvent(payload),{eventId,tenantId:tenant,profileId:profile,accountId:account,eventType:'message.received'});
 assert.equal(validatedZernioEvent({...payload,profiles:[]}),null);
 assert.equal(validatedZernioEvent({...payload,profiles:[...payload.profiles,...payload.profiles]}),null);
 assert.equal(validatedZernioEvent({...payload,profiles:[{id:profile,externalId:'external-tenant'}]}),null);
 assert.equal(validatedZernioEvent({...payload,account:{accountId:account,profileId:'aaaaaaaaaaaaaaaaaaaaaaaa'}}),null);
 assert.equal(validatedZernioEvent({...payload,event:'post.published'}),null);
});

test('Zernio account is included only when it belongs to the current profile',async()=>{
 const {publicAccount}=await import('../../lib/crm/zernio.mjs');
 assert.deepEqual(publicAccount({_id:account,profileId:profile,platform:'instagram',username:'shop',isActive:true},profile),{id:account,platform:'instagram',username:'shop',connected:true,needsReconnect:false});
 assert.equal(publicAccount({_id:account,profileId:'aaaaaaaaaaaaaaaaaaaaaaaa'},profile),null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {isGrantUpdate,isUsableConnection,grantFor} from '../lib/crm/channel-hub.mjs';

const id='123e4567-e89b-42d3-a456-426614174000';
const grant={action:'set_grant',connectionId:id,serviceCode:'crm',allowed:true};
test('only CRM consent changes are accepted',()=>{
 assert.equal(isGrantUpdate(grant),true);
 assert.equal(isGrantUpdate({...grant,allowed:false}),true);
 for(const bad of [
   {...grant,serviceCode:'dorpin'}, {...grant,serviceCode:'admin'},
   {...grant,action:'connect'}, {...grant,allowed:'true'},
   {...grant,connectionId:'bad'}, {...grant,tenant_id:'other'},
   null, [], 'hello'
 ]) assert.equal(isGrantUpdate(bad),false,JSON.stringify(bad));
});
test('active Instagram connections require unexpired permissions',()=>{
 const conn={channel:'instagram',status:'connected',expires_at:'2026-10-20T12:00:00Z'};
 const now=Date.parse('2026-10-18T12:00:00Z');
 assert.equal(isUsableConnection(conn,now),true);
 assert.equal(isUsableConnection({...conn,expires_at:'2026-10-17T12:00:00Z'},now),false);
 assert.equal(isUsableConnection({...conn,channel:'whatsapp'},now),false);
 assert.equal(isUsableConnection({...conn,status:'disconnected'},now),false);
 assert.equal(isUsableConnection({...conn,expires_at:'invalid'},now),false);
});
test('grants are isolated per connection and per service',()=>{
 const grants=[
  {connection_id:id,service_code:'crm',allowed:true},
  {connection_id:'bbb',service_code:'dorpin',allowed:true},
  {connection_id:'ccc',service_code:'crm',allowed:false}
 ];
 assert.equal(grantFor(grants,id,'crm'),true);
 assert.equal(grantFor(grants,id,'dorpin'),false);
 assert.equal(grantFor(grants,'ccc','crm'),false);
 assert.equal(grantFor(grants,'bbb','crm'),false);
});

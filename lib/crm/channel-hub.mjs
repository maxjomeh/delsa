const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

// Phase 1 is CRM receive-only. Granting DorPin or outbound access is purposely
// unsupported until that product has its own subscription+message policy checks.
export function isGrantUpdate(body) {
 return !!body && typeof body==='object' && !Array.isArray(body) &&
  Object.keys(body).every(k=>['action','connectionId','serviceCode','allowed'].includes(k)) &&
  body.action==='set_grant' && typeof body.connectionId==='string' &&
  uuid.test(body.connectionId) && body.serviceCode==='crm' &&
  typeof body.allowed==='boolean';
}
export function isUsableConnection(row,now=Date.now()) {
 return !!row && row.channel==='instagram' && row.status==='connected' &&
  Number.isFinite(Date.parse(row.expires_at||'')) && Date.parse(row.expires_at)>now;
}
export function grantFor(grants=[],connectionId,service='crm') {
 return grants.some(g=>g.connection_id===connectionId && g.service_code===service && g.allowed===true);
}

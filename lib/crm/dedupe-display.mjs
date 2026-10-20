/**
 * Presentation-only collapse of exact cross-source duplicates.
 * We never delete CRM records; two separately acknowledged messages with
 * different timestamps remain distinct. This only hides exact same-content,
 * direction, channel and timestamp repeats from the same customer.
 * Source IDs remain immutable for review/audit.
 */
export function uniqueDisplayMessages(rows=[]){
 const seen=new Set();
 return rows.filter(row=>{
  if(!row||row.kind!=='message'||!row.external_event_id?.startsWith('zernio-msg:'))return true;
  const when=Date.parse(row.occurred_at||'');
  if(!Number.isFinite(when))return true;
  const key=JSON.stringify([row.tenant_id||'',row.customer_id||'',row.channel||'',
    row.direction||'',when,row.body||'']);
  if(seen.has(key))return false;
  seen.add(key);
  return true;
 });
}

// Pure and deterministic SIMA inbox projection: no channel send, no database mutation.
// The source timeline is bounded by the caller's fetch window (currently 500 records).
const moment = value => {
  const result = Date.parse(value || '');
  return Number.isFinite(result) ? result : 0;
};
const searchable = value => String(value == null ? '' : value).toLocaleLowerCase('fa-IR');

export function buildConversations(customers = [], interactions = [], options = {}) {
  const {query = '', status = 'all', channel = 'all'} = options;
  const owners = new Map(customers.filter(c => c && c.id).map(c => [c.id, c]));
  const grouped = new Map();
  for (const item of interactions) {
    if (!item || !owners.has(item.customer_id)) continue;
    const messages = grouped.get(item.customer_id) || [];
    messages.push(item);
    grouped.set(item.customer_id, messages);
  }
  const q = searchable(query.trim());
  const conversations = [];
  for (const [id, messages] of grouped) {
    messages.sort((a, b) => moment(a.occurred_at) - moment(b.occurred_at) || String(a.id).localeCompare(String(b.id)));
    const customer = owners.get(id);
    const last = messages[messages.length - 1];
    // "Needs response" is an inference from the latest *recorded* interaction,
    // NOT a platform unread receipt or proof that a message reached Instagram.
    const needsResponse = last.direction === 'inbound' && last.kind !== 'note';
    const record = {id, customer, messages, last, needsResponse, count: messages.length, lastAt: moment(last.occurred_at)};
    if (status === 'needs_response' && !needsResponse) continue;
    if (status === 'answered' && needsResponse) continue;
    if (channel !== 'all' && !messages.some(m => m.channel === channel)) continue;
    const haystack = [customer.name, customer.phone, customer.instagram, customer.city, customer.tags, ...messages.map(m => m.body)].map(searchable).join(' ');
    if (q && !haystack.includes(q)) continue;
    conversations.push(record);
  }
  return conversations.sort((a, b) => b.lastAt - a.lastAt || a.id.localeCompare(b.id));
}

export function inboxTotals(conversations) {
  return {
    conversations: conversations.length,
    needsResponse: conversations.filter(c => c.needsResponse).length,
    loggedMessages: conversations.reduce((sum, c) => sum + c.count, 0)
  };
}

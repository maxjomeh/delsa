// Pure summary behind the dashboard "Today" board. No I/O, no sending, deterministic for a given `now`.
import {buildConversations} from './inbox.mjs';

// Calendar day in Iran, so "today" matches the business owner's day, not the server's.
export const tehranDay = value => new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Tehran'}).format(new Date(value));

export function summarizeToday({customers = [], interactions = [], leads = [], orders = [], tasks = []} = {}, now = Date.now()) {
  const today = tehranDay(now);
  const byId = new Map(customers.filter(c => c && c.id).map(c => [c.id, c]));
  // "Waiting" is inferred from the latest recorded interaction being inbound (see inbox.mjs); it is not a read receipt.
  const waiting = buildConversations(customers, interactions, {status: 'needs_response'});
  const due = tasks.filter(t => t && t.status === 'scheduled' && t.due_at && Number.isFinite(Date.parse(t.due_at)) && tehranDay(t.due_at) <= today);
  const overdue = due.filter(t => tehranDay(t.due_at) < today);
  const openLeads = leads.filter(l => l && !['won', 'lost'].includes(l.stage));
  const paidToday = orders.filter(o => o && o.status === 'paid' && o.created_at && tehranDay(o.created_at) === today);
  const paidSum = paidToday.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
  const pending = orders.filter(o => o && o.status === 'pending');
  return {today, byId, waiting, due, overdue, openLeads, paidToday, paidSum, pending};
}

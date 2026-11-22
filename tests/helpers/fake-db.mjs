// A small in-memory stand-in for the subset of the Supabase client the topic store uses.
// It records every query (`db.calls`) so tests can assert that EVERY query is tenant-scoped, and it mirrors the two
// database behaviours the store relies on: unique keys (insert -> 23505, upsert+ignoreDuplicates -> skip) and the
// activation trigger. The real guards (never-auto, kill switch, floor) are verified separately against Postgres.
import {randomUUID} from 'node:crypto';

const UNIQUE = {
  sima_topics: [['tenant_id', 'topic_key']],
  sima_topic_outcomes: [['tenant_id', 'topic_id', 'source', 'interaction_id']],
  sima_topic_fields: [['topic_id', 'field_key']],
};

export function fakeDb(seed = {}, {refuse = {}} = {}) {
  const tables = new Map(Object.entries(seed).map(([name, rows]) => [name, rows.map(r => ({...r}))]));
  const rows = name => tables.get(name) || tables.set(name, []).get(name);
  const calls = [];
  const clash = (table, row, ignoreId) => (UNIQUE[table] || []).some(cols =>
    rows(table).some(existing => existing !== ignoreId && cols.every(c => existing[c] != null && existing[c] === row[c])));
  const stamp = (table, row, previous) => {
    if (table === 'sima_topics' && row.status === 'active' && previous?.status !== 'active') row.activated_at = new Date().toISOString();   // activation trigger
    return row;
  };
  const prepare = (table, row) => stamp(table, {id: randomUUID(), created_at: new Date().toISOString(), ...row});

  function builder(table) {
    const state = {op: 'select', filters: [], order: null, limit: null, payload: null, options: {}, returning: false, single: false};
    const matches = r => state.filters.every(([kind, col, val]) => kind === 'eq' ? r[col] === val : val.includes(r[col]));
    const run = () => {
      calls.push({table, op: state.op, payload: state.payload, filters: state.filters.map(([k, c, v]) => `${k}:${c}=${JSON.stringify(v)}`)});
      if (refuse[`${table}.${state.op}`]) return {data: null, error: {code: 'P0001', message: refuse[`${table}.${state.op}`]}};
      let result = [];
      if (state.op === 'select') result = rows(table).filter(matches);
      else if (state.op === 'insert' || state.op === 'upsert') {
        const input = Array.isArray(state.payload) ? state.payload : [state.payload];
        for (const raw of input) {
          const row = prepare(table, raw);
          if (clash(table, row)) {
            if (state.op === 'upsert' && state.options.ignoreDuplicates) continue;
            return {data: null, error: {code: '23505', message: 'duplicate key'}};
          }
          rows(table).push(row); result.push(row);
        }
      } else if (state.op === 'update') {
        for (const r of rows(table).filter(matches)) { const before = {...r}; Object.assign(r, state.payload); stamp(table, r, before); result.push(r); }
      } else if (state.op === 'delete') {
        result = rows(table).filter(matches);
        tables.set(table, rows(table).filter(r => !result.includes(r)));
      }
      if (state.order) result = [...result].sort((a, b) => (a[state.order.col] > b[state.order.col] ? 1 : -1) * (state.order.asc ? 1 : -1));
      if (state.limit != null) result = result.slice(state.offset || 0, (state.offset || 0) + state.limit);
      const copy = result.map(r => ({...r}));
      if (state.single) return {data: copy[0] ?? null, error: null};
      return {data: state.op === 'select' || state.returning ? copy : null, error: null};
    };
    const api = {
      select() { if (state.op !== 'select') state.returning = true; return api; },
      insert(payload) { state.op = 'insert'; state.payload = payload; return api; },
      upsert(payload, options = {}) { state.op = 'upsert'; state.payload = payload; state.options = options; return api; },
      update(payload) { state.op = 'update'; state.payload = payload; return api; },
      delete() { state.op = 'delete'; return api; },
      eq(col, val) { state.filters.push(['eq', col, val]); return api; },
      in(col, val) { state.filters.push(['in', col, val]); return api; },
      order(col, {ascending = true} = {}) { state.order = {col, asc: ascending}; return api; },
      limit(n) { state.limit = n; return api; },
      range(from, to) { state.limit = to - from + 1; state.offset = from; return api; },
      maybeSingle() { state.single = true; return api; },
      single() { state.single = true; return api; },
      then(resolve, reject) { try { resolve(run()); } catch (e) { reject?.(e); } },
    };
    return api;
  }
  return {from: builder, calls, rows, tables};
}

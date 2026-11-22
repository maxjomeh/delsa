#!/usr/bin/env node
// Offline historical replay for CIMA. Reads an export, prints a JSON report. Read-only: it never calls any service.
//   node scripts/cima-backtest.mjs --input export.json [--output report.json] [--min-occurrences 5] [--now 2026-11-22T09:00:00Z]
// export.json: {"interactions":[{id,customer_id,channel,direction,kind,body,occurred_at}], "knowledge":[{id,title,question,answer,status,revision}]}
import {readFileSync, writeFileSync} from 'node:fs';
import {runBacktest, summarizeBacktest} from '../lib/crm/backtest.mjs';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const fail = message => { process.stderr.write(`error: ${message}\n`); process.exit(2); };

const input = option('input');
if (!input) fail('missing --input <export.json>');
let data;
try { data = JSON.parse(readFileSync(input, 'utf8')); } catch (e) { fail(`cannot read ${input}: ${e.message}`); }
if (!Array.isArray(data?.interactions)) fail('export must contain an "interactions" array');
const now = option('now') ? Date.parse(option('now')) : Date.now();
if (!Number.isFinite(now)) fail('--now must be an ISO date');
const minOccurrences = option('min-occurrences') ? Number(option('min-occurrences')) : 5;
if (!Number.isInteger(minOccurrences) || minOccurrences < 2) fail('--min-occurrences must be an integer >= 2');

const report = summarizeBacktest(runBacktest({
  interactions: data.interactions, knowledge: Array.isArray(data.knowledge) ? data.knowledge : [], now, discovery: {minOccurrences},
}));
const json = JSON.stringify(report, null, 2);
if (option('output')) writeFileSync(option('output'), json); else process.stdout.write(json + '\n');
const covered = report.topics.reduce((n, t) => n + t.scored, 0), pairs = report.totals.pairs;
process.stderr.write(`topics=${report.totals.topics} pairs=${pairs} scored=${covered} unassigned=${report.totals.unassigned}\n`);

#!/usr/bin/env node
// Readiness report on YOUR real conversations, computed locally. It sends nothing and connects to nothing.
//   node scripts/cima-readiness.mjs --input export.json [--out report.md] [--format md|json] [--min-occurrences 5] [--no-redact]
//   node scripts/cima-readiness.mjs --input export.json --audit      # only check the export for unmasked personal data (exit 3 if any)
// export.json comes from supabase/exports/cima-readiness-export.sql (see docs/cima-readiness-kit.md).
// Personal data (emails, links, handles, long digit runs) is masked in the printed report unless --no-redact is given.
import {readFileSync, writeFileSync} from 'node:fs';
import {runBacktest} from '../lib/crm/backtest.mjs';
import {buildReadiness, renderMarkdown, redactText, auditExport} from '../lib/crm/readiness-report.mjs';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const flag = name => args.includes(`--${name}`);
const fail = message => { process.stderr.write(`error: ${message}\n`); process.exit(2); };

const input = option('input');
if (!input) fail('missing --input <export.json>');
let data;
try { data = JSON.parse(readFileSync(input, 'utf8')); } catch (e) { fail(`cannot read ${input}: ${e.message}`); }
if (!Array.isArray(data?.interactions)) fail('export must contain an "interactions" array');
const knowledge = Array.isArray(data.knowledge) ? data.knowledge : [];
const format = option('format') || 'md';
if (!['md', 'json'].includes(format)) fail('--format must be md or json');
const now = option('now') ? Date.parse(option('now')) : Date.now();
if (!Number.isFinite(now)) fail('--now must be an ISO date');
const minOccurrences = option('min-occurrences') ? Number(option('min-occurrences')) : 5;
if (!Number.isInteger(minOccurrences) || minOccurrences < 2) fail('--min-occurrences must be an integer >= 2');
const redact = !flag('no-redact');

// Always audit the export first: personal data that should have been masked is reported (never printed) and stops --audit with exit 3.
const audit = auditExport(data);
if (!audit.ok) {
  const kinds = [...new Set(audit.findings.map(f => f.kind))].join(', ');
  process.stderr.write(`warning: the export contains ${audit.findings.length} item(s) that look personal or unmasked (${kinds}). Re-export with supabase/exports/cima-readiness-export.sql before sharing the file.\n`);
}
if (flag('audit')) { process.stderr.write(audit.ok ? 'audit: ok (nothing personal found in the export)\n' : `audit: FAILED: ${audit.findings.slice(0, 20).map(f => `${f.kind} @ ${f.where}`).join('; ')}\n`); process.exit(audit.ok ? 0 : 3); }

const result = runBacktest({interactions: data.interactions, knowledge, now, discovery: {minOccurrences}});
const readiness = buildReadiness(result, {knowledge});
let output;
if (format === 'json') {
  // The JSON form is masked as well, field by field, so it is safe to share by default.
  const mask = value => (typeof value === 'string' ? (redact ? redactText(value) : value) : Array.isArray(value) ? value.map(mask) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mask(v)])) : value);
  output = JSON.stringify(mask(readiness), null, 2);
} else output = renderMarkdown(readiness, {redact, generatedAt: now});
if (option('out')) writeFileSync(option('out'), output + '\n'); else process.stdout.write(output + '\n');
const s = readiness.summary;
process.stderr.write(`interactions=${s.interactions} pairs=${s.pairs} topics=${s.topics} humanOnly=${s.humanOnlyTopics} actions=${readiness.actions.length}\n`);

// Lists t('...') keys used in the source that are missing from a locale dictionary,
// and dictionary entries that no code uses any more.   Usage: npm run i18n:check
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { if (name !== 'messages') walk(path); }
    else if (/\.(js|tsx?|jsx)$/.test(name)) files.push(path);
  }
}
['app', 'components', 'lib'].forEach(walk);

const used = new Set();
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  for (const m of source.matchAll(/(?<![\w$.])t\('((?:[^'\\]|\\.)*)'/g)) used.add(m[1].replace(/\\(.)/g, '$1'));
}

let failed = false;
for (const locale of ['en', 'ar', 'tr']) {
  const dict = (await import(pathToFileURL(join('lib/i18n/messages', locale + '.js')).href)).default;
  const missing = [...used].filter((key) => !(key in dict));
  const unused = Object.keys(dict).filter((key) => !used.has(key));
  console.log(`${locale}: ${used.size - missing.length}/${used.size} translated, ${unused.length} unused`);
  missing.forEach((key) => console.log('  missing:', key));
  if (missing.length) failed = true;
}
process.exit(failed ? 1 : 0);

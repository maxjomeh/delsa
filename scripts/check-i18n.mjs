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

// Files that render inside a customer's site (templates, storefront): their strings live in the "site"
// dictionaries. Everything else belongs to the platform's own pages ("app" dictionaries).
const SITE_FILES = new Set(['components/BuilderSiteView.js', 'components/BuilderStorefront.js', 'components/BuilderExtraElements.js', 'lib/builder-commerce.js', 'lib/book-seo.js', 'app/(published)/s/[slug]/[[...path]]/page.js']);
const used = { app: new Set(), site: new Set() };
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const scope = SITE_FILES.has(file.replaceAll('\\', '/')) ? 'site' : 'app';
  for (const m of source.matchAll(/(?<![\w$.])(?:t|tx)\('((?:[^'\\]|\\.)*)'/g)) {
    const key = m[1].replace(/\\(.)/g, '$1');
    if (/[\u0600-\u06FF]/.test(key)) used[scope].add(key);
  }
}

let failed = false;
for (const scope of ['app', 'site']) {
  for (const locale of ['en', 'ar', 'tr']) {
    const file = scope === 'app' ? locale + '.js' : 'site-' + locale + '.js';
    const dict = (await import(pathToFileURL(join('lib/i18n/messages', file)).href)).default;
    const keys = [...used[scope]];
    const missing = keys.filter((key) => !(key in dict));
    // Site dictionaries also hold template/starter copy that is generated, not literal in code.
    const unused = scope === 'app' ? Object.keys(dict).filter((key) => !used.app.has(key)) : [];
    console.log(`${scope}/${locale}: ${keys.length - missing.length}/${keys.length} translated${scope === 'app' ? `, ${unused.length} unused` : ''}`);
    missing.forEach((key) => console.log('  missing:', key));
    if (missing.length) failed = true;
  }
}
process.exit(failed ? 1 : 0);

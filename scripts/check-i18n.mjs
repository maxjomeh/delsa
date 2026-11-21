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
    else if (/\.(m?js|tsx?|jsx)$/.test(name)) files.push(path);
  }
}
['app', 'components', 'lib'].forEach(walk);

// Files that render inside a customer's site (templates, storefront): their strings live in the "site"
// dictionaries. Everything else belongs to the platform's own pages ("app" dictionaries).
const SITE_FILES = new Set(['components/BuilderSiteView.js', 'components/BuilderStorefront.js', 'components/BuilderExtraElements.js', 'components/BuilderFloatingCover.js', 'components/BuilderMotion.js', 'lib/builder-commerce.js', 'lib/book-seo.js', 'app/(published)/s/[slug]/[[...path]]/page.js']);
// The customer dashboard and the admin panel (and the admin API messages they display).
const PANEL_FILES = new Set(['components/CustomerDashboard.js', 'components/CustomerServiceOverview.js', 'components/ApuWorkspace.js', 'components/CustomerApuDetails.js', 'components/CustomerDetails.js', 'components/AdminDashboardClient.js', 'components/AdminSupport.js', 'components/AdminUsersManager.js', 'components/PlatformCredentialsAdmin.js', 'components/StoreProductsAdmin.js', 'components/ProtectedPage.js', 'components/i18n/BuilderI18n.js', 'app/api/admin/customer-details/route.js', 'app/api/admin/customers/route.js', 'app/api/admin/products/route.js', 'app/api/admin/platform-credentials/route.js', 'app/api/admin/support-chats/route.js']);
// The site-builder UI (visual editor, demo, dashboard builder tab, helpers) and the labels it reads from libs. It runs on top of the
// 'app' and 'site' dictionaries (loadMessages(locale, 'builder')), so keys already translated in 'site' need no second entry.
const EDITOR_FILES = new Set(['components/BuilderDemo.js', 'components/BuilderVisualEditor.js', 'components/BuilderElementItems.js', 'components/BuilderDialog.js', 'components/BuilderTaxonomy.js', 'components/BuilderNavigation.js', 'lib/site-builder.js', 'components/SiteBuilder.js', 'components/BuilderCommerce.js', 'components/BuilderProductForm.js', 'components/BuilderInstagramImport.js', 'components/BuilderBookLookup.js', 'components/InlineSiteBuilder.js', 'lib/builder-fonts.js', 'lib/builder-surfaces.js', 'lib/builder-instagram.js', 'lib/book-catalog-client.js']);
// Sima / CRM (components/crm and the lib/crm helpers that produce visible text); runs on top of 'app' + 'panel'.
const CRM_FILES = new Set(['lib/crm/customer-intelligence.mjs', 'lib/crm/cima-outbox-status.mjs']);
const used = { app: new Set(), panel: new Set(), editor: new Set(), site: new Set(), crm: new Set() };
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const norm = file.replaceAll('\\', '/');
  const scope = norm.startsWith('components/crm/') || CRM_FILES.has(norm) ? 'crm' : SITE_FILES.has(norm) ? 'site' : PANEL_FILES.has(norm) ? 'panel' : EDITOR_FILES.has(norm) ? 'editor' : 'app';
  for (const m of source.matchAll(/(?<![\w$.])(?:t|tx)\('((?:[^'\\]|\\.)*)'/g)) {
    const key = m[1].replace(/\\(.)/g, '$1');
    if (/[\u0600-\u06FF]/.test(key)) used[scope].add(key);
  }
}

let failed = false;
for (const scope of ['app', 'panel', 'editor', 'crm', 'site']) {
  for (const locale of ['en', 'ar', 'tr']) {
    const file = scope === 'app' ? locale + '.js' : scope + '-' + locale + '.js';
    const dict = { ...(scope === 'panel' || scope === 'editor' || scope === 'crm' ? (await import(pathToFileURL(join('lib/i18n/messages', locale + '.js')).href)).default : {}), ...(scope === 'crm' ? (await import(pathToFileURL(join('lib/i18n/messages', 'panel-' + locale + '.js')).href)).default : {}), ...(scope === 'editor' ? (await import(pathToFileURL(join('lib/i18n/messages', 'site-' + locale + '.js')).href)).default : {}), ...(await import(pathToFileURL(join('lib/i18n/messages', file)).href)).default };
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

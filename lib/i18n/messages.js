// Lazy dictionary loaders, split by scope so a page only ships what it renders:
//  - 'app'  : the platform's own pages (home, pricing, auth, ...)
//  - 'site' : site-builder templates, starter content and the published-site chrome
//  - 'panel': the customer dashboard and the admin panel (loaded on top of 'app')
//  - 'crm'   : Sima / CRM (loaded on top of 'app' + 'panel' by BuilderI18n)
//  - 'editor': the site-builder editor UI (loaded on top of 'app'; used by /builder/demo and the dashboard's builder tab)
const loaders = {
  app: {
    en: () => import('./messages/en'),
    ar: () => import('./messages/ar'),
    tr: () => import('./messages/tr'),
  },
  panel: {
    en: () => import('./messages/panel-en'),
    ar: () => import('./messages/panel-ar'),
    tr: () => import('./messages/panel-tr'),
  },
  editor: {
    en: () => import('./messages/editor-en'),
    ar: () => import('./messages/editor-ar'),
    tr: () => import('./messages/editor-tr'),
  },
  crm: {
    en: () => import('./messages/crm-en'),
    ar: () => import('./messages/crm-ar'),
    tr: () => import('./messages/crm-tr'),
  },
  site: {
    en: () => import('./messages/site-en'),
    ar: () => import('./messages/site-ar'),
    tr: () => import('./messages/site-tr'),
  },
};

export async function loadMessages(locale, scope = 'app') {
  // 'builder' = everything the site-builder UI needs on top of 'app': its own strings plus the template/industry copy ('site').
  if (scope === 'builder') return { ...(await loadMessages(locale, 'site')), ...(await loadMessages(locale, 'editor')) };
  const load = loaders[scope]?.[locale];
  return load ? (await load()).default : {};
}

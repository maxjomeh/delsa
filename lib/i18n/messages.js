// Lazy dictionary loaders, split by scope so a page only ships what it renders:
//  - 'app'  : the platform's own pages (home, pricing, auth, ...)
//  - 'site' : site-builder templates, starter content and the published-site chrome
const loaders = {
  app: {
    en: () => import('./messages/en'),
    ar: () => import('./messages/ar'),
    tr: () => import('./messages/tr'),
  },
  site: {
    en: () => import('./messages/site-en'),
    ar: () => import('./messages/site-ar'),
    tr: () => import('./messages/site-tr'),
  },
};

export async function loadMessages(locale, scope = 'app') {
  const load = loaders[scope]?.[locale];
  return load ? (await load()).default : {};
}

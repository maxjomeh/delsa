import {createPublicClient} from '../lib/supabase/public';
import {normalizeDocument} from '../lib/site-builder';

const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.delsaai.ir';
// Regenerated hourly; published sites are public rows readable by the anonymous role.
export const revalidate = 3600;

export default async function sitemap() {
  const now = new Date();
  const entries = ['', '/store', '/pricing', '/builder'].map(path => ({url: origin + path, lastModified: now}));
  try {
    const db = createPublicClient();
    const {data: sites, error} = await db.from('builder_publications').select('site_id,slug,document,published_at').eq('is_live', true).order('published_at', {ascending: false}).limit(2000);
    if (error || !sites?.length) return entries;
    const {data: products} = await db.from('builder_products').select('site_id,slug,updated_at').eq('status', 'published').in('site_id', sites.map(s => s.site_id)).limit(40000);
    const bySite = new Map(sites.map(s => [s.site_id, s]));
    for (const s of sites) {
      const lastModified = new Date(s.published_at);
      for (const p of normalizeDocument(s.document).pages) entries.push({url: origin + '/s/' + s.slug + (p.slug ? '/' + p.slug : ''), lastModified});
      entries.push({url: origin + '/s/' + s.slug + '/shop', lastModified});
    }
    for (const p of products || []) {
      const s = bySite.get(p.site_id);
      if (s) entries.push({url: origin + '/s/' + s.slug + '/product/' + p.slug, lastModified: p.updated_at ? new Date(p.updated_at) : new Date(s.published_at)});
    }
  } catch { /* fall back to the static entries */ }
  return entries.slice(0, 50000);
}

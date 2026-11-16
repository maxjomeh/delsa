const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.delsaai.ir';

export default function robots() {
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      // Private, per-user or transactional areas are not meant for search results.
      disallow: ['/api/', '/admin', '/dashboard', '/auth/', '/login', '/signup', '/s/*/cart', '/s/*/checkout', '/s/*/orders'],
    }],
    sitemap: origin + '/sitemap.xml',
  };
}

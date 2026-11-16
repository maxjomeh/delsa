import { createClient } from '@supabase/supabase-js';

// Cookie-free anonymous client for public, cacheable reads (published sites).
// It must never read cookies() or headers(), otherwise the page becomes dynamic
// and cannot be served from the Next.js ISR cache / Vercel CDN.
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );
}

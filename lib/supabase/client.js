import { sessionCookieOptions } from './cookie-options';
import { createBrowserClient } from '@supabase/ssr';
let client;
export function createClient() {
  if (!client) client = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {cookieOptions:sessionCookieOptions});
  return client;
}

import {NextResponse} from 'next/server';
import {revalidatePath} from 'next/cache';
import {createClient} from '../../../../lib/supabase/server';

// Called by the site builder after publish / unpublish / archive so the cached public site updates at once.
// Authorization is enforced by RLS: the signed-in user can only read builder_sites rows they own (or admins).
export async function POST(request) {
  let siteId = '';
  try { siteId = String((await request.json())?.siteId || ''); } catch { /* handled below */ }
  if (!/^[0-9a-f-]{36}$/i.test(siteId)) return NextResponse.json({error: 'invalid_request'}, {status: 400});
  const db = await createClient();
  const {data: {user}} = await db.auth.getUser();
  if (!user) return NextResponse.json({error: 'unauthorized'}, {status: 401});
  const {data: site, error} = await db.from('builder_sites').select('slug').eq('id', siteId).maybeSingle();
  if (error) return NextResponse.json({error: 'unavailable'}, {status: 500});
  if (!site) return NextResponse.json({error: 'not_found'}, {status: 404});
  revalidatePath('/s/' + site.slug, 'layout');
  return NextResponse.json({ok: true});
}

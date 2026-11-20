import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { localizeHref, splitLocale } from '../../../lib/i18n/config';
export async function POST(request) { const supabase = await createClient(); await supabase.auth.signOut(); let locale; try { locale = splitLocale(new URL(request.headers.get('referer') || '').pathname).locale; } catch {} return NextResponse.redirect(new URL(localizeHref(locale || 'fa','/'),request.url),303); }

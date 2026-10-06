import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '../../../../lib/supabase/server';
import { isSupabaseConfigured } from '../../../../lib/supabase/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAdmin() {
 const db = await createClient();
 const { data: { user } } = await db.auth.getUser();
 if (!user) return { response: NextResponse.json({ error: 'برای ادامه وارد حساب مدیر شوید.' }, { status: 401 }) };
 const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle();
 if (profile?.role !== 'admin') return { response: NextResponse.json({ error: 'دسترسی مدیر لازم است.' }, { status: 403 }) };
 return { response: null };
}

function normalizePhone(value) {
 const digits = String(value || '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[^+\d]/g, '');
 if (/^09\d{9}$/.test(digits)) return '+98' + digits.slice(1);
 if (/^9\d{9}$/.test(digits)) return '+98' + digits;
 if (/^98\d{10}$/.test(digits)) return '+' + digits;
 if (/^\+\d{8,15}$/.test(digits)) return digits;
 return '';
}

export async function POST(request) {
 const auth = await requireAdmin();
 if (auth.response) return auth.response;
 if (!isSupabaseConfigured()) return NextResponse.json({ error: 'تنظیمات ثبت‌نام آماده نیست.' }, { status: 503 });
 const origin = request.headers.get('origin');
 if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'درخواست معتبر نیست.' }, { status: 403 });
 let body; try { body = await request.json(); } catch { return NextResponse.json({ error: 'درخواست معتبر نیست.' }, { status: 400 }); }
 const name = String(body.name || '').trim();
 const phone = normalizePhone(body.phone);
 const password = typeof body.password === 'string' ? body.password : '';
 const confirmation = typeof body.passwordConfirmation === 'string' ? body.passwordConfirmation : '';
 if (name.length < 2 || name.length > 120 || !phone || password.length < 8 || password.length > 128 || password !== confirmation)
  return NextResponse.json({ error: 'نام، شماره تماس معتبر و دو رمز عبور یکسان با حداقل ۸ نویسه لازم است.' }, { status: 400 });
 const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if (!url || !key) return NextResponse.json({ error: 'تنظیمات پایگاه داده ناقص است.' }, { status: 503 });
 const signupClient = createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
 const email = `phone-${phone.replace(/\D/g, '')}@delsa.invalid`;
 const { data, error } = await signupClient.auth.signUp({ email, password, options: { data: { full_name: name, phone } } });
 if (error || !data.user) return NextResponse.json({ error: 'ساخت حساب انجام نشد. شماره ممکن است قبلاً ثبت شده باشد یا تنظیمات ثبت‌نام نیاز به بررسی داشته باشد.' }, { status: 400 });
 if (!data.session) return NextResponse.json({ error: 'حساب ساخته شد اما تأیید ایمیل در Supabase فعال است؛ آن را غیرفعال کنید تا ورود با شماره و رمز کار کند.' }, { status: 503 });
 return NextResponse.json({ ok: true, customer: { id: data.user.id, phone, full_name: name } }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}

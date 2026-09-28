import { NextResponse } from 'next/server';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function key() {
  const value = Buffer.from(process.env.PLATFORM_CREDENTIALS_ENCRYPTION_KEY || '', 'base64');
  if (value.length !== 32) throw new Error('Encryption key is not configured');
  return value;
}
function encrypt(value) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map(part => part.toString('base64url')).join('.');
}
function decrypt(value) {
  const [iv, tag, body] = String(value).split('.').map(part => Buffer.from(part, 'base64url'));
  if (iv.length !== 12 || tag.length !== 16) throw new Error('Invalid encrypted value');
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}
async function requireAdmin() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: 'برای ادامه وارد حساب مدیر شوید.' }, { status: 401 }) };
  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') return { response: NextResponse.json({ error: 'دسترسی مدیر لازم است.' }, { status: 403 }) };
  return { db, user };
}

export async function GET() {
  const { db, response } = await requireAdmin();
  if (response) return response;
  const [{ data: customers, error: customerError }, { data: credentials, error: credentialError }] = await Promise.all([
    db.from('profiles').select('id,full_name,phone,email').order('created_at', { ascending: false }).limit(500),
    db.from('customer_platform_credentials').select('id,customer_id,platform,username,created_at').order('created_at', { ascending: false }).limit(1000),
  ]);
  if (customerError || credentialError) return NextResponse.json({ error: 'دسترسی‌ها آماده نیستند؛ migration مربوط را در Supabase اجرا کنید.' }, { status: 503 });
  return NextResponse.json({ customers: customers || [], credentials: credentials || [] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request) {
  const { db, user, response } = await requireAdmin();
  if (response) return response;
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'درخواست معتبر نیست.' }, { status: 400 }); }
  if (body.action === 'reveal') {
    const { data, error } = await db.from('customer_platform_credentials').select('password_ciphertext').eq('id', String(body.id || '')).maybeSingle();
    if (error || !data) return NextResponse.json({ error: 'دسترسی پیدا نشد.' }, { status: 404 });
    try { return NextResponse.json({ password: decrypt(data.password_ciphertext) }, { headers: { 'Cache-Control': 'no-store, private' } }); }
    catch { return NextResponse.json({ error: 'کلید رمزگذاری را در تنظیمات Vercel بررسی کنید.' }, { status: 500 }); }
  }
  const customerId = String(body.customerId || ''), platform = String(body.platform || '').trim(), username = String(body.username || '').trim();
  const password = typeof body.password === 'string' ? body.password : '';
  if (!customerId || platform.length < 1 || platform.length > 80 || username.length < 1 || username.length > 255 || password.length < 1 || password.length > 500)
    return NextResponse.json({ error: 'مشتری و هر سه فیلد را کامل کنید.' }, { status: 400 });
  let passwordCiphertext;
  try { passwordCiphertext = encrypt(password); }
  catch { return NextResponse.json({ error: 'کلید رمزگذاری در تنظیمات سرور ثبت نشده است.' }, { status: 503 }); }
  const { data, error } = await db.from('customer_platform_credentials').insert({ customer_id: customerId, platform, username, password_ciphertext: passwordCiphertext, created_by: user.id }).select('id,customer_id,platform,username,created_at').single();
  if (error) return NextResponse.json({ error: 'ذخیره انجام نشد؛ مشتری یا migration پایگاه داده را بررسی کنید.' }, { status: 400 });
  return NextResponse.json({ credential: data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE(request) {
  const { db, response } = await requireAdmin();
  if (response) return response;
  const id = new URL(request.url).searchParams.get('id') || '';
  const { error } = await db.from('customer_platform_credentials').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'حذف دسترسی انجام نشد.' }, { status: 400 });
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}

import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { isSupabaseConfigured } from '../../../../lib/supabase/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeDigits(value) {
  return String(value ?? '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

export async function POST(request) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'پایگاه داده آماده نیست.' }, { status: 503 });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'درخواست معتبر نیست.' }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'برای ادامه وارد حساب مدیر شوید.' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'دسترسی مدیر لازم است.' }, { status: 403 });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'درخواست معتبر نیست.' }, { status: 400 }); }
  const name = String(body.name || '').trim();
  const description = String(body.description || '').trim();
  const rawPrice = normalizeDigits(body.price).replace(/[٬,،\s]/g, '');
  const imageUrl = String(body.imageUrl || '').trim();
  let price = null;
  if (rawPrice) {
    if (!/^\d{1,12}$/.test(rawPrice)) return NextResponse.json({ error: 'قیمت را فقط با رقم وارد کنید.' }, { status: 400 });
    price = Number(rawPrice);
    if (!Number.isSafeInteger(price)) return NextResponse.json({ error: 'قیمت واردشده معتبر نیست.' }, { status: 400 });
  }
  if (name.length < 2 || name.length > 120 || description.length > 1200 || imageUrl.length > 2048)
    return NextResponse.json({ error: 'نام محصول یا توضیحات از حد مجاز بیشتر است.' }, { status: 400 });
  if (imageUrl) {
    try { if (new URL(imageUrl).protocol !== 'https:') throw new Error(); }
    catch { return NextResponse.json({ error: 'پیوند تصویر باید با https شروع شود.' }, { status: 400 }); }
  }
  const { data: product, error } = await supabase.from('store_products').insert({
    name, description, price, image_url: imageUrl || null, is_published: true, created_by: user.id,
  }).select('id,name,description,price,image_url,is_published,created_at').single();
  if (error) {
    console.error('Admin product insert failed:', error.message);
    return NextResponse.json({ error: 'ذخیرهٔ محصول انجام نشد. جدول فروشگاه را بررسی کنید.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, product }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}

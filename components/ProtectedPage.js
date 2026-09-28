import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '../lib/supabase/server';
import { isSupabaseConfigured } from '../lib/supabase/config';
import { ArrowUpLeft, LogOut, RefreshCw, ShieldCheck, Clock3 } from 'lucide-react';
import AdminDashboardClient from './AdminDashboardClient';

function profilePhone(profile) {
  const digits = String(profile?.phone || profile?.email?.match(/^phone-(\d+)@delsa\.invalid$/i)?.[1] || '').replace(/\D/g, '');
  if (digits.startsWith('98') && digits.length === 12) return '0' + digits.slice(2);
  if (digits.length === 10 && digits.startsWith('9')) return '0' + digits;
  return digits || '—';
}

export async function UserDashboard() {
  if (!isSupabaseConfigured()) return redirect('/login?error=setup');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('full_name,role').eq('id', user.id).maybeSingle();
  if (profile?.role === 'admin') redirect('/admin');
  return <main className="panel-shell"><header className="panel-top"><Link href="/" className="brand"><img className="brand-mark" src="/delsa-mark.svg" alt=""/><span className="brand-word">DELSA</span></Link><div className="panel-user"><span>{profile?.full_name || profilePhone({ phone: user.phone, email: user.email })}</span><form action="/auth/signout" method="post"><button className="icon-button" aria-label="خروج"><LogOut size={17}/></button></form></div></header><div className="panel-main"><div className="panel-greeting"><span className="eyebrow">فضای کاری / APU</span><h1>سلام {profile?.full_name || 'خوش آمدی'}،</h1><p>مدیریت به‌روزرسانی قیمت محصولات از اینجا شروع می‌شود.</p></div><section className="panel-focus"><div className="focus-icon"><RefreshCw size={24}/></div><div><span className="eyebrow">APU · Automated Price Updates</span><h2>به‌روزرسانی هوشمند قیمت</h2><p>منابع قیمت را اضافه کن، محصولات را تطبیق بده و پیش از اعمال تغییرات آن‌ها را بررسی کن.</p></div><span className="soon-badge">در حال راه‌اندازی</span></section><section className="panel-grid"><article className="panel-card"><small>اتصال فروشگاه</small><strong>هنوز متصل نشده</strong><p>اتصال فروشگاه پس از تکمیل تنظیمات APU فعال می‌شود.</p></article><article className="panel-card"><small>محصول‌های پایش‌شده</small><strong>۰</strong><p>با اضافه کردن منبع داده، محصول‌ها در اینجا نمایش داده می‌شوند.</p></article><article className="panel-card"><small>آخرین اجرا</small><strong>—</strong><p>تاریخچه‌ی اجراها پس از اتصال APU در دسترس است.</p></article></section><section className="panel-note"><Clock3 size={19}/><div><b>APU به‌زودی فعال می‌شود</b><p>در حال حاضر حساب واقعی و امن است؛ اتصال فروشگاه و موتور تغییر قیمت هنوز راه‌اندازی نشده‌اند.</p></div></section><Link href="/" className="back-home">بازگشت به صفحه‌ی اصلی <ArrowUpLeft size={16}/></Link></div></main>;
}

export async function AdminDashboard() {
  if (!isSupabaseConfigured()) return redirect('/admin/login?error=setup');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') redirect('/login');
  const [{ data: users }, { data: products }] = await Promise.all([
    supabase.from('profiles').select('id,phone,email,full_name,role,created_at').order('created_at', { ascending: false }).limit(500),
    supabase.from('store_products').select('id,name,description,price,image_url,is_published,created_at').order('created_at', { ascending: false }).limit(100),
  ]);
  return <main className="panel-shell"><header className="panel-top"><Link href="/" className="brand"><img className="brand-mark" src="/delsa-mark.svg" alt=""/><span className="brand-word">DELSA</span></Link><div className="panel-user"><span><ShieldCheck size={15}/> مدیر سامانه</span><form action="/auth/signout" method="post"><button className="icon-button" aria-label="خروج"><LogOut size={17}/></button></form></div></header><AdminDashboardClient users={users || []} products={products || []}/></main>;
}

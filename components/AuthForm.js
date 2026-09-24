'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '../lib/supabase/client';
import { ArrowUpLeft, LoaderCircle, ShieldCheck } from 'lucide-react';

function normalizePhone(value) {
  const latin = String(value || '')
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
  let phone = latin.trim().replace(/[\s()-]/g, '');
  if (phone.startsWith('00')) phone = `+${phone.slice(2)}`;
  if (/^09\d{9}$/.test(phone)) return `+98${phone.slice(1)}`;
  if (/^9\d{9}$/.test(phone)) return `+98${phone}`;
  if (/^98\d{10}$/.test(phone)) return `+${phone}`;
  return /^\+\d{8,15}$/.test(phone) ? phone : null;
}

export default function AuthForm({ mode = 'login', admin = false }) {
  const router = useRouter();
  const params = useSearchParams();
  const signup = mode === 'signup';
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    const form = new FormData(event.currentTarget);
    const phone = normalizePhone(form.get('phone'));
    const password = String(form.get('password') || '');
    if (!phone) { setError('شماره تماس را با پیش‌شمارهٔ کشور وارد کن؛ مثلاً 09123456789.'); setBusy(false); return; }
    if (signup && password !== String(form.get('password_confirmation') || '')) { setError('رمزهای عبور با هم مطابقت ندارند.'); setBusy(false); return; }
    const supabase = createClient();
    try {
      if (signup) {
        const { data, error: authError } = await supabase.auth.signUp({
          phone, password,
          options: { data: { full_name: String(form.get('name') || '').trim() }, channel: 'sms' },
        });
        if (authError) throw authError;
        if (data.session) { router.replace('/dashboard'); router.refresh(); }
        else setMessage('حساب ثبت شد؛ تنظیم تأیید شماره در Supabase هنوز ورود بدون کد را فعال نکرده است.');
        return;
      }
      const { error: authError } = await supabase.auth.signInWithPassword({ phone, password });
      if (authError) throw authError;
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (admin && profile?.role !== 'admin') {
        await supabase.auth.signOut();
        throw new Error('این حساب دسترسی ادمین ندارد.');
      }
      router.replace(profile?.role === 'admin' ? '/admin' : '/dashboard'); router.refresh();
    } catch (e) { setError(e?.message || 'ورود انجام نشد. دوباره تلاش کن.'); }
    finally { setBusy(false); }
  }
  const setupError = params.get('error') === 'setup';
  return <main className="auth-screen"><div className="auth-glow"/><Link href="/" className="auth-brand"><img src="/delsa-mark.svg" alt=""/><b>DELSA</b></Link><section className="auth-card">
    <span className="auth-kicker">{admin ? <><ShieldCheck size={15}/> فضای مدیریت</> : 'DELSA / APU'}</span>
    <h1>{signup ? 'حساب دلسا را بساز' : admin ? 'ورود مدیر' : 'خوش برگشتی'}</h1>
    <p>{signup ? 'برای دسترسی به محیط APU، حساب کاربری‌ات را بساز.' : admin ? 'با شماره‌ای وارد شو که دسترسی مدیر برای آن فعال شده است.' : 'برای ادامه به فضای کاری امن دلسا وارد شو.'}</p>
    {(setupError || !configured) && <div className="auth-notice">ورود واقعی هنوز فعال نشده است. مدیر پروژه باید URL و کلید عمومی Supabase را در تنظیمات Vercel وارد کند.</div>}
    <form onSubmit={submit}>
      {signup && <label>نام نمایشی<input name="name" autoComplete="name" required placeholder="نام شما"/></label>}
      <label>شماره تماس<input name="phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="۰۹۱۲۳۴۵۶۷۸۹"/></label>
      <label>رمز عبور<input name="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={8} required placeholder="حداقل ۸ نویسه"/></label>
      {signup && <label>تکرار رمز عبور<input name="password_confirmation" type="password" autoComplete="new-password" minLength={8} required placeholder="رمز عبور را دوباره وارد کن"/></label>}
      {error && <div className="auth-error" role="alert">{error}</div>}{message && <div className="auth-success" role="status">{message}</div>}
      <button className="button primary auth-submit" disabled={busy || !configured}>{busy ? <LoaderCircle className="spin" size={18}/> : signup ? 'ساخت حساب' : 'ورود امن'}<ArrowUpLeft size={18}/></button>
    </form>
    {!admin && <div className="auth-switch">{signup ? <>حساب داری؟ <Link href="/login">ورود</Link></> : <>حساب نداری؟ <Link href="/signup">ثبت‌نام</Link></>}</div>}
    {admin && <div className="auth-switch"><Link href="/login">بازگشت به ورود کاربر</Link></div>}
    <small className="auth-legal">ورود با شماره تماس و رمز عبور · کد یک‌بارمصرف ارسال نمی‌شود.</small>
  </section><Link href="/" className="auth-back">بازگشت به سایت <ArrowUpLeft size={15}/></Link></main>;
}

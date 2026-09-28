'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '../lib/supabase/client';
import { ArrowUpLeft, Eye, EyeOff, LoaderCircle, ShieldCheck } from 'lucide-react';


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

function legacyPhoneLoginId(phone) {
  return `phone-${phone.replace(/\D/g, '')}@delsa.invalid`;
}

export default function AuthForm({ mode = 'login', admin = false }) {
  const router = useRouter();
  const params = useSearchParams();
  const signup = mode === 'signup';
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);

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
          email: legacyPhoneLoginId(phone), password,
          options: { data: { full_name: String(form.get('name') || '').trim(), phone } },
        });
        if (authError) throw authError;
        if (data.session) { router.replace('/dashboard'); router.refresh(); }
        else setMessage('حساب ساخته شد. حالا می‌توانی با شماره تماس و رمز عبور وارد شوی.');
        return;
      }
      let { error: authError } = await supabase.auth.signInWithPassword({ phone, password });
      if (authError) {
        // Keep accounts created before phone auth was enabled usable during migration.
        const legacyLogin = await supabase.auth.signInWithPassword({ email: legacyPhoneLoginId(phone), password });
        authError = legacyLogin.error;
      }
      if (authError) {
        if (authError.code === 'phone_provider_disabled') {
          throw new Error('ورود با شماره تماس هنوز در تنظیمات Supabase فعال نشده است.');
        }
        if (authError.code === 'phone_not_confirmed') {
          throw new Error('تأیید شماره در Supabase فعال است؛ برای ورود بدون کد، آن را غیرفعال کن.');
        }
        throw authError;
      }
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
      {signup && <label>نام و نام خانوادگی<input name="name" autoComplete="name" required placeholder="نام شما"/></label>}
      <label>شماره تماس<input name="phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="۰۹۱۲۳۴۵۶۷۸۹"/></label>
      <label>رمز عبور<div className="auth-password-wrap"><input name="password" type={showPassword ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} minLength={8} required placeholder="حداقل ۸ نویسه"/><button className="auth-password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'مخفی کردن رمز عبور' : 'نمایش رمز عبور'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
{signup && <label>تکرار رمز عبور<div className="auth-password-wrap"><input name="password_confirmation" type={showPasswordConfirmation ? 'text' : 'password'} autoComplete="new-password" minLength={8} required placeholder="رمز عبور را دوباره وارد کن"/><button className="auth-password-toggle" type="button" onClick={() => setShowPasswordConfirmation((visible) => !visible)} aria-label={showPasswordConfirmation ? 'مخفی کردن رمز عبور' : 'نمایش رمز عبور'} aria-pressed={showPasswordConfirmation}>{showPasswordConfirmation ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>}

      {error && <div className="auth-error" role="alert">{error}</div>}{message && <div className="auth-success" role="status">{message}</div>}
      <button className="button primary auth-submit" disabled={busy || !configured}>{busy ? <LoaderCircle className="spin" size={18}/> : signup ? 'ساخت حساب' : 'ورود امن'}<ArrowUpLeft size={18}/></button>
    </form>
    {!admin && <div className="auth-switch">{signup ? <>حساب داری؟ <Link href="/login">ورود</Link></> : <>حساب نداری؟ <Link href="/signup">ثبت‌نام</Link></>}</div>}
    {admin && <div className="auth-switch"><Link href="/login">بازگشت به ورود کاربر</Link></div>}
    <small className="auth-legal">ورود با شماره تماس و رمز عبور · شماره با پیامک تأیید نمی‌شود و کدی ارسال نمی‌شود.</small>
  </section><Link href="/" className="auth-back">بازگشت به سایت <ArrowUpLeft size={15}/></Link></main>;
}

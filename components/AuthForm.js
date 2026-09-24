'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '../lib/supabase/client';
import { ArrowUpLeft, LoaderCircle, ShieldCheck } from 'lucide-react';

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
    const email = String(form.get('email') || '').trim().toLowerCase();
    const password = String(form.get('password') || '');
    const supabase = createClient();
    try {
      if (signup) {
        const { data, error: authError } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: String(form.get('name') || '').trim() }, emailRedirectTo: `${location.origin}/auth/callback?next=/dashboard` },
        });
        if (authError) throw authError;
        if (data.session) { router.replace('/dashboard'); router.refresh(); }
        else setMessage('حساب ساخته شد. برای فعال‌سازی، لینک تأیید ارسال‌شده به ایمیلت را باز کن.');
        return;
      }
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
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
    <p>{signup ? 'برای دسترسی به محیط APU، حساب کاربری‌ات را بساز.' : admin ? 'با حسابی وارد شو که دسترسی مدیر برای آن فعال شده است.' : 'برای ادامه به فضای کاری امن دلسا وارد شو.'}</p>
    {(setupError || !configured) && <div className="auth-notice">ورود واقعی هنوز فعال نشده است. مدیر پروژه باید URL و کلید عمومی Supabase را در تنظیمات Vercel وارد کند.</div>}
    <form onSubmit={submit}>
      {signup && <label>نام نمایشی<input name="name" autoComplete="name" required placeholder="نام شما"/></label>}
      <label>ایمیل / نام کاربری<input name="email" type="email" autoComplete="email" required placeholder="name@example.com"/></label>
      <label>رمز عبور<input name="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={8} required placeholder="حداقل ۸ نویسه"/></label>
      {error && <div className="auth-error" role="alert">{error}</div>}{message && <div className="auth-success" role="status">{message}</div>}
      <button className="button primary auth-submit" disabled={busy || !configured}>{busy ? <LoaderCircle className="spin" size={18}/> : signup ? 'ساخت حساب' : 'ورود امن'}<ArrowUpLeft size={18}/></button>
    </form>
    {!admin && <div className="auth-switch">{signup ? <>حساب داری؟ <Link href="/login">ورود</Link></> : <>حساب نداری؟ <Link href="/signup">ثبت‌نام</Link></>}</div>}
    {admin && <div className="auth-switch"><Link href="/login">بازگشت به ورود کاربر</Link></div>}
    <small className="auth-legal">ورود امن با ایمیل و رمز عبور · رمزها توسط سرویس احراز هویت نگهداری می‌شوند.</small>
  </section><Link href="/" className="auth-back">بازگشت به سایت <ArrowUpLeft size={15}/></Link></main>;
}

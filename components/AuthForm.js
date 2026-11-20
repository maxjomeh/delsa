'use client';
import { useState } from 'react';
import Link from './i18n/Link';
import { useI18n } from './i18n/I18nProvider';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '../lib/supabase/client';
import { ArrowUpLeft, Eye, EyeOff, LoaderCircle, ShieldCheck } from 'lucide-react';
import '../app/home.css';
import HomeHeader from './home/HomeHeader';


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
  const { t, href } = useI18n();
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
    if (!phone) { setError(t('شماره تماس را با پیش‌شمارهٔ کشور وارد کن؛ مثلاً 09123456789.')); setBusy(false); return; }
    if (signup && password !== String(form.get('password_confirmation') || '')) { setError(t('رمزهای عبور با هم مطابقت ندارند.')); setBusy(false); return; }
    const supabase = createClient();
    try {
      if (signup) {
        const { data, error: authError } = await supabase.auth.signUp({
          email: legacyPhoneLoginId(phone), password,
          options: { data: { full_name: String(form.get('name') || '').trim(), phone } },
        });
        if (authError) throw authError;
        if (data.session) { router.replace(href('/dashboard')); router.refresh(); }
        else setMessage(t('حساب ساخته شد. حالا می‌توانی با شماره تماس و رمز عبور وارد شوی.'));
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
          throw new Error(t('ورود با شماره تماس هنوز در تنظیمات Supabase فعال نشده است.'));
        }
        if (authError.code === 'phone_not_confirmed') {
          throw new Error(t('تأیید شماره در Supabase فعال است؛ برای ورود بدون کد، آن را غیرفعال کن.'));
        }
        throw authError;
      }
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (admin && profile?.role !== 'admin') {
        await supabase.auth.signOut();
        throw new Error(t('این حساب دسترسی ادمین ندارد.'));
      }
      router.replace(href(profile?.role === 'admin' ? '/admin' : '/dashboard')); router.refresh();
    } catch (e) {
      const reason = String(e?.message || '');
      if (signup && /database error saving new user/i.test(reason)) {
        setError(t('ثبت‌نام به دلیل خطای ذخیره‌سازی حساب انجام نشد. لطفاً دوباره تلاش کن؛ اگر تکرار شد با پشتیبانی تماس بگیر.'));
      } else if (signup && /user already registered|already been registered/i.test(reason)) {
        setError(t('این شماره قبلاً ثبت شده است. از بخش ورود استفاده کن.'));
      } else {
        setError(reason || (signup ? t('ثبت‌نام انجام نشد. دوباره تلاش کن.') : t('ورود انجام نشد. دوباره تلاش کن.')));
      }
    }
    finally { setBusy(false); }
  }
  const setupError = params.get('error') === 'setup';
  return <div className="hx"><HomeHeader home={false}/><main className="auth-screen"><div className="auth-glow"/><section className="auth-card">
    <span className="auth-kicker">{admin ? <><ShieldCheck size={15}/> {t('فضای مدیریت')}</> : 'DELSA / APU'}</span>
    <h1>{signup ? t('حساب دلسا را بساز') : admin ? t('ورود مدیر') : t('خوش برگشتی')}</h1>
    <p>{signup ? t('برای دسترسی به محیط APU، حساب کاربری‌ات را بساز.') : admin ? t('با شماره‌ای وارد شو که دسترسی مدیر برای آن فعال شده است.') : t('برای ادامه به فضای کاری امن دلسا وارد شو.')}</p>
    {(setupError || !configured) && <div className="auth-notice">{t('ورود واقعی هنوز فعال نشده است. مدیر پروژه باید URL و کلید عمومی Supabase را در تنظیمات Vercel وارد کند.')}</div>}
    <form onSubmit={submit}>
      {signup && <label>{t('نام و نام خانوادگی')}<input name="name" autoComplete="name" required placeholder={t('نام شما')}/></label>}
      <label>{t('شماره تماس')}<input name="phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder={t('۰۹۱۲۳۴۵۶۷۸۹')}/></label>
      <label>{t('رمز عبور')}<div className="auth-password-wrap"><input name="password" type={showPassword ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} minLength={8} required placeholder={t('حداقل ۸ نویسه')}/><button className="auth-password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? t('مخفی کردن رمز عبور') : t('نمایش رمز عبور')} aria-pressed={showPassword}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
{signup && <label>{t('تکرار رمز عبور')}<div className="auth-password-wrap"><input name="password_confirmation" type={showPasswordConfirmation ? 'text' : 'password'} autoComplete="new-password" minLength={8} required placeholder={t('رمز عبور را دوباره وارد کن')}/><button className="auth-password-toggle" type="button" onClick={() => setShowPasswordConfirmation((visible) => !visible)} aria-label={showPasswordConfirmation ? t('مخفی کردن رمز عبور') : t('نمایش رمز عبور')} aria-pressed={showPasswordConfirmation}>{showPasswordConfirmation ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>}

      {error && <div className="auth-error" role="alert">{error}</div>}{message && <div className="auth-success" role="status">{message}</div>}
      <button className="hx-btn hx-btn-primary auth-submit" disabled={busy || !configured}>{busy ? <LoaderCircle className="spin" size={18}/> : signup ? t('ساخت حساب') : t('ورود امن')}<ArrowUpLeft size={18}/></button>
    </form>
    {!admin && <div className="auth-switch">{signup ? <>{t('حساب داری؟')} <Link href="/login">{t('ورود')}</Link></> : <>{t('حساب نداری؟')} <Link href="/signup">{t('ثبت‌نام')}</Link></>}</div>}
    {admin && <div className="auth-switch"><Link href="/login">{t('بازگشت به ورود کاربر')}</Link></div>}
    <small className="auth-legal">{t('ورود با شماره تماس و رمز عبور · شماره با پیامک تأیید نمی‌شود و کدی ارسال نمی‌شود.')}</small>
  </section><Link href="/" className="auth-back">{t('بازگشت به سایت')} <ArrowUpLeft size={15}/></Link></main></div>;
}

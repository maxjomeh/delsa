import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '../lib/supabase/server';
import { isSupabaseConfigured } from '../lib/supabase/config';
import { ArrowUpLeft, LogOut, RefreshCw, ShieldCheck, Clock3 } from 'lucide-react';
import AdminDashboardClient from './AdminDashboardClient';
import CustomerDashboard from './CustomerDashboard';

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
  const { data: profile } = await supabase.from('profiles').select('full_name,phone,email,role').eq('id', user.id).maybeSingle();
  if (profile?.role === 'admin') redirect('/admin');
  const [sources, rules, runs, messages, store, subscriptions, entitlement] = await Promise.all([
    supabase.from('apu_sources').select('*').eq('user_id', user.id).is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('apu_rules').select('*').eq('user_id', user.id).is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('apu_runs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
    supabase.from('support_messages').select('*').eq('user_id', user.id).order('created_at', { ascending: true }).limit(100),
    supabase.from('customer_stores').select('name,website').eq('customer_id', user.id).maybeSingle(),
    supabase.from('customer_subscriptions').select('id,product_id,plan,starts_at,expires_at,store_products(name)').eq('customer_id', user.id).order('expires_at', { ascending: false }),
    supabase.rpc('has_active_apu'),
  ]);
  const loadError = [sources, rules, runs, messages, store, subscriptions].some((result) => result.error);
  return <CustomerDashboard
    userId={user.id}
    hasApu={Boolean(entitlement.data)}
    name={profile?.full_name || 'خوش آمدی'}
    phone={profilePhone({ phone: profile?.phone || user.phone, email: profile?.email || user.email })}
    initialSources={sources.data || []}
    initialRules={rules.data || []}
    initialRuns={runs.data || []}
    initialMessages={messages.data || []}
    store={store.data}
    subscriptions={subscriptions.data || []}
    loadError={loadError}
  />;
}

export async function AdminDashboard() {
  if (!isSupabaseConfigured()) return redirect('/admin/login?error=setup');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') redirect('/login');
  const [{ data: users }, { data: products }, { data: subscriptions }] = await Promise.all([
    supabase.from('profiles').select('id,phone,email,full_name,role,created_at').order('created_at', { ascending: false }).limit(500),
    supabase.from('store_products').select('id,name,description,price,image_url,is_published,created_at').order('created_at', { ascending: false }).limit(100),
    supabase.from('customer_subscriptions').select('id,customer_id,product_id,plan,expires_at').limit(5000),
  ]);
  return <main className="panel-shell"><header className="panel-top"><Link href="/" className="brand"><img className="brand-mark" src="/delsa-mark.svg" alt=""/><span className="brand-word">DELSA</span></Link><div className="panel-user"><span><ShieldCheck size={15}/> مدیر سامانه</span><form action="/auth/signout" method="post"><button className="icon-button" aria-label="خروج"><LogOut size={17}/></button></form></div></header><AdminDashboardClient users={users || []} products={products || []} subscriptions={subscriptions || []}/></main>;
}

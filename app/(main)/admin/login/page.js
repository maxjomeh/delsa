import { redirect } from 'next/navigation';
import { createClient } from '../../../../lib/supabase/server';
import { isSupabaseConfigured } from '../../../../lib/supabase/config';
import { getI18n } from '../../../../lib/i18n/server';
import { Suspense } from 'react';
import AuthForm from '../../../../components/AuthForm';
import '../../../../components/auth.css';
export const dynamic = 'force-dynamic';
export default async function AdminLoginPage() { const {href}=await getI18n(); if(isSupabaseConfigured()){const db=await createClient();const {data:{user}}=await db.auth.getUser();if(user){const {data:profile}=await db.from('profiles').select('role').eq('id',user.id).maybeSingle();redirect(href(profile?.role==='admin'?'/admin':'/dashboard'))}} return <Suspense><AuthForm admin/></Suspense>; }

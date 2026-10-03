import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { isSupabaseConfigured } from '../../lib/supabase/config';
import { Suspense } from 'react';
import AuthForm from '../../components/AuthForm';
import '../../components/auth.css';
export const dynamic = 'force-dynamic';
export default async function LoginPage() { if(isSupabaseConfigured()){const db=await createClient();const {data:{user}}=await db.auth.getUser();if(user){const {data:profile}=await db.from('profiles').select('role').eq('id',user.id).maybeSingle();redirect(profile?.role==='admin'?'/admin':'/dashboard')}} return <Suspense><AuthForm/></Suspense>; }

import { Suspense } from 'react';
import AuthForm from '../../../components/AuthForm';
import '../../../components/auth.css';
export default function AdminLoginPage() { return <Suspense><AuthForm admin/></Suspense>; }

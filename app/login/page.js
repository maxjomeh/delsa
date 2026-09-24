import { Suspense } from 'react';
import AuthForm from '../../components/AuthForm';
import '../../components/auth.css';
export default function LoginPage() { return <Suspense><AuthForm/></Suspense>; }

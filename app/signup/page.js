import { Suspense } from 'react';
import AuthForm from '../../components/AuthForm';
import '../../components/auth.css';
export default function SignupPage() { return <Suspense><AuthForm mode="signup"/></Suspense>; }

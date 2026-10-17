import { AdminDashboard } from '../../components/ProtectedPage';
import '../../components/dashboard.css';
export const dynamic = 'force-dynamic';
export default async function AdminPage({searchParams}) { const params=await searchParams; return <AdminDashboard initialTab={params?.tab}/>; }

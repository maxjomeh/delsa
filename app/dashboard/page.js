import { UserDashboard } from '../../components/ProtectedPage';
import '../../components/dashboard.css';
import '../../components/customer-dashboard.css';
export const dynamic = 'force-dynamic';
export default async function DashboardPage({searchParams}) { const params=await searchParams; return <UserDashboard initialTab={params?.tab}/>; }

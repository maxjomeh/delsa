import {Suspense} from 'react';
import Workspace from '../../components/Workspace';
export const metadata={title:'پیش‌نمایش مدیریت | دلسا',robots:{index:false,follow:false}};
export default function Page(){return <Suspense fallback={<p>در حال بارگذاری…</p>}><Workspace admin/></Suspense>}

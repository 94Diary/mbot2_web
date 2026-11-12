import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useSite } from '../lib/site.jsx';
import { Button, Gate, Skeleton } from '../ui/index.js';

function Loading() {
  return <div className="wrap page"><Skeleton height={32} width="40%" /><Skeleton height={240} /></div>;
}

export function MaintenanceGate({ children }) {
  const { site } = useSite();
  const { isAdmin, loading } = useAuth();
  const { pathname } = useLocation();
  if (loading) return <Loading />;
  if (site.maintenance && !isAdmin && !['/login'].includes(pathname)) {
    return (
      <div className="wrap page">
        <Gate icon="set" title="เว็บปิดปรับปรุงชั่วคราว" action={<Button to="/login">เข้าสู่ระบบผู้ดูแล</Button>}>
          ทีมกำลังปรับปรุงระบบ กลับมาใหม่อีกครั้งภายหลัง
        </Gate>
      </div>
    );
  }
  return children;
}

/** Requires login and (optionally) a permission; API still checks every request. */
export function RequirePerm({ perm }) {
  const { user, loading, can } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (perm && !can(perm)) {
    return (
      <div className="wrap page">
        <Gate icon="lock" title="ไม่มีสิทธิ์เข้าหน้านี้" action={<Button variant="primary" to="/console">ไปหน้าที่เข้าได้</Button>}>
          หน้านี้สำหรับผู้ดูแลเว็บเท่านั้น ถ้าคิดว่าควรเข้าได้ ติดต่อเจ้าของระบบ
        </Gate>
      </div>
    );
  }
  return <Outlet />;
}

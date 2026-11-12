import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { ConsentProvider } from './features/consent/CookieConsent.jsx';
import { PageTransition } from './features/design/Brand.jsx';
import { AdminLayout } from './layouts/AdminLayout.jsx';
import { ConsoleHeader } from './layouts/ConsoleHeader.jsx';
import { ConsoleLayout } from './layouts/ConsoleLayout.jsx';
import { ErrorBoundary } from './layouts/ErrorBoundary.jsx';
import { MaintenanceGate, RequirePerm } from './layouts/guards.jsx';
import { SiteFooter, SiteHeader, TopBanners } from './layouts/SiteHeader.jsx';
import { AuthProvider } from './lib/auth.jsx';
import { RobotPrefsProvider } from './lib/robots.jsx';
import { SiteProvider } from './lib/site.jsx';
import { SIM_ACTIVE, useTelemetry } from './lib/telemetry.jsx';
import { ToastProvider } from './lib/toast.jsx';
import { Account, Login, NotFound, Register } from './pages/Auth.jsx';
import { Home } from './pages/Home.jsx';
import { Announcements } from './pages/admin/Announcements.jsx';
import { Audit } from './pages/admin/Audit.jsx';
import { Dashboard } from './pages/admin/Dashboard.jsx';
import { AdminLessons, LessonEdit } from './pages/admin/Lessons.jsx';
import { AdminMissions } from './pages/admin/Missions.jsx';
import { Roles } from './pages/admin/Roles.jsx';
import { Settings } from './pages/admin/Settings.jsx';
import { Backups, Machine, Messages, SystemStatus } from './pages/admin/SystemPages.jsx';
import { Users } from './pages/admin/Users.jsx';
import { Connect } from './pages/console/Connect.jsx';
import { Control } from './pages/console/Control.jsx';
import { History } from './pages/console/History.jsx';
import { MissionDetail } from './pages/console/MissionDetail.jsx';
import { Team } from './pages/console/Team.jsx';
import { About, Contact, Privacy, Search, Terms } from './pages/public/Info.jsx';
import { Lesson, LessonsIndex } from './pages/public/Lessons.jsx';
import { Robot } from './pages/public/Robot.jsx';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/layouts.css';
import './styles/design.css';

/** เข้าคอนโซล: มีภารกิจค้าง → ควบคุม · ไม่มี → เชื่อมหุ่น (pages-and-flows.md › flow B) */
function ConsoleHome() {
  const { sim, mission, connection } = useTelemetry();
  if (connection === 'connecting') return null;
  return <Navigate to={SIM_ACTIVE.has(sim.state) || mission.phase !== 'idle' ? '/console/control' : '/console/connect'} replace />;
}

function Root() {
  return (
    <>
      <PageTransition />
      <MaintenanceGate><ErrorBoundary><Outlet /></ErrorBoundary></MaintenanceGate>
    </>
  );
}

function PublicLayout() {
  return (
    <div className="shell dz">
      <TopBanners />
      <SiteHeader />
      <Outlet />
      <SiteFooter />
    </div>
  );
}

/** คอนโซลและหลังบ้านใช้หน้าตาแบบเดิม (หัวเว็บเดิม + แถบเมนูของแต่ละส่วน) */
function WorkShell() {
  return <><ConsoleHeader /><Outlet /></>;
}

function App() {
  return (
    <Routes>
      <Route element={<Root />}>
        <Route path="login" element={<Login />} />
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="register" element={<Register />} />
          <Route path="lessons" element={<LessonsIndex />} />
          <Route path="lessons/:slug" element={<Lesson />} />
          <Route path="robot" element={<Robot />} />
          <Route path="search" element={<Search />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="terms" element={<Terms />} />
          <Route element={<RequirePerm />}><Route path="account" element={<Account />} /></Route>
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route element={<WorkShell />}>
          <Route element={<RequirePerm perm="console.view" />}>
            <Route path="console" element={<ConsoleLayout />}>
              <Route index element={<ConsoleHome />} />
              <Route path="connect" element={<Connect />} />
              <Route path="control" element={<Control />} />
              <Route path="team" element={<Team />} />
              <Route path="history" element={<History />} />
              <Route path="missions/:id" element={<MissionDetail />} />
            </Route>
          </Route>
          <Route element={<RequirePerm perm="admin.access" />}>
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="system" element={<SystemStatus />} />
              <Route path="lessons" element={<AdminLessons />} />
              <Route path="lessons/:id" element={<LessonEdit />} />
              <Route path="messages" element={<Messages />} />
              <Route path="machine" element={<Machine />} />
              <Route path="backups" element={<Backups />} />
              <Route path="users" element={<Users />} />
              <Route path="roles" element={<Roles />} />
              <Route path="missions" element={<AdminMissions />} />
              <Route path="announcements" element={<Announcements />} />
              <Route path="settings" element={<Settings />} />
              <Route path="audit" element={<Audit />} />
            </Route>
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <SiteProvider>
            <RobotPrefsProvider>
              <ConsentProvider>
                <App />
              </ConsentProvider>
            </RobotPrefsProvider>
          </SiteProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);

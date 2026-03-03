import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthGuard } from './components/auth-guard';
import { AppShellLayout } from './layouts/app-shell-layout';
import { DashboardPage } from './pages/dashboard-page';
import { ReadingsPage } from './pages/readings-page';
import { RecipientsPage } from './pages/recipients-page';
import { SchedulerPage } from './pages/scheduler-page';
import { SettingsPage } from './pages/settings-page';
import { WhatsAppPage } from './pages/whatsapp-page';

export function App() {
  return (
    <AuthGuard>
      <Routes>
        <Route element={<AppShellLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/whatsapp" element={<WhatsAppPage />} />
          <Route path="/recipients" element={<RecipientsPage />} />
          <Route path="/readings" element={<ReadingsPage />} />
          <Route path="/scheduler" element={<SchedulerPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthGuard>
  );
}

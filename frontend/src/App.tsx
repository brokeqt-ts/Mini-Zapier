import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { WorkflowEditorPage } from './pages/WorkflowEditorPage';
import { ExecutionHistoryPage } from './pages/ExecutionHistoryPage';
import { ExecutionDetailPage } from './pages/ExecutionDetailPage';
import { SettingsPage } from './pages/SettingsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore((s) => ({ user: s.user, isLoading: s.isLoading }));
  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const loadProfile = useAuthStore((s) => s.loadProfile);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="workflows/:id" element={<WorkflowEditorPage />} />
        <Route
          path="workflows/:id/executions"
          element={<ExecutionHistoryPage />}
        />
        <Route path="executions/:id" element={<ExecutionDetailPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { DashboardPage, PlaceholderPage } from './pages';
import { AppShell } from '../components/layout/AppShell';
import { AcademicSetupPage } from '../features/academic/AcademicSetupPage';
import { AttendancePage } from '../features/attendance/AttendancePage';
import { LearningMaterialsPage } from '../features/learning-materials/LearningMaterialsPage';
import { LoginPage } from '../features/auth/LoginPage';
import { RequireAdmin } from './RequireAdmin';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="notes" element={<LearningMaterialsPage />} />
          <Route path="assignments" element={<LearningMaterialsPage />} />
          <Route element={<RequireAdmin />}>
            <Route
              path="academic"
              element={<Navigate to="/academic/campuses" replace />}
            />
            <Route path="academic/:entity" element={<AcademicSetupPage />} />
          </Route>
          <Route path=":section" element={<PlaceholderPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

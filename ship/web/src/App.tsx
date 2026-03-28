import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import DocsPage from './pages/DocsPage';
import IssuesPage from './pages/IssuesPage';
import ProjectsPage from './pages/ProjectsPage';
import WeeksPage from './pages/WeeksPage';
import TeamsPage from './pages/TeamsPage';
import ShipsPage from './pages/ShipsPage';
import ProgramsPage from './pages/ProgramsPage';
import ProgramDetailPage from './pages/ProgramDetailPage';
import DocumentDetailPage from './pages/DocumentDetailPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import StandupsPage from './pages/StandupsPage';

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="admin-dashboard" element={<AdminDashboardPage />} />
        <Route path="admin" element={<AdminDashboardPage />} />
        <Route path="docs" element={<DocsPage />} />
        <Route path="issues" element={<IssuesPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="weeks" element={<WeeksPage />} />
        <Route path="teams" element={<TeamsPage />} />
        <Route path="ships" element={<ShipsPage />} />
        <Route path="standups" element={<StandupsPage />} />
        <Route path="programs" element={<ProgramsPage />} />
        <Route path="programs/:id" element={<ProgramDetailPage />} />
        <Route path=":type/:id" element={<DocumentDetailPage />} />
      </Route>
    </Routes>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

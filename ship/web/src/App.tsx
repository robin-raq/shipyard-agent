import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import CommandPalette from './components/CommandPalette';
import SessionTimeoutModal from './components/SessionTimeoutModal';
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
import WeeklyPlansPage from './pages/WeeklyPlansPage';
import WeeklyRetrosPage from './pages/WeeklyRetrosPage';
import ReviewsPage from './pages/ReviewsPage';
import PublicFeedbackPage from './pages/PublicFeedbackPage';
import ActivityPage from './pages/ActivityPage';
import SprintReviewsPage from './pages/SprintReviewsPage';
import SettingsPage from './pages/SettingsPage';
import NotificationsPage from './pages/NotificationsPage';
import OrgChartPage from './pages/OrgChartPage';
import MyWeekPage from './pages/MyWeekPage';
import StatusOverviewPage from './pages/StatusOverviewPage';
import ProfilePage from './pages/ProfilePage';
import InvitationsPage from './pages/InvitationsPage';
import AcceptInvitePage from './pages/AcceptInvitePage';
import ApiTokensPage from './pages/ApiTokensPage';
import IterationsPage from './pages/IterationsPage';
import ApprovalsPage from './pages/ApprovalsPage';

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
    <>
      <CommandPalette />
      <SessionTimeoutModal />
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
          <Route path="weekly-plans" element={<WeeklyPlansPage />} />
          <Route path="weekly-retros" element={<WeeklyRetrosPage />} />
          <Route path="sprint-reviews" element={<SprintReviewsPage />} />
          <Route path="reviews" element={<ReviewsPage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="org-chart" element={<OrgChartPage />} />
          <Route path="programs" element={<ProgramsPage />} />
          <Route path="programs/:id" element={<ProgramDetailPage />} />
          <Route path="iterations" element={<IterationsPage />} />
          <Route path="approvals" element={<ApprovalsPage />} />
          <Route path="my-week" element={<MyWeekPage />} />
          <Route path="status" element={<StatusOverviewPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="invitations" element={<InvitationsPage />} />
          <Route path="api-tokens" element={<ApiTokensPage />} />
          <Route path=":type/:id" element={<DocumentDetailPage />} />
        </Route>
      </Routes>
    </>
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
      <Route path="/feedback" element={<PublicFeedbackPage />} />
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

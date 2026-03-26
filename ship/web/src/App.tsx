import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="docs" element={<DocsPage />} />
          <Route path="issues" element={<IssuesPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="weeks" element={<WeeksPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="ships" element={<ShipsPage />} />
          <Route path="programs" element={<ProgramsPage />} />
          <Route path="programs/:id" element={<ProgramDetailPage />} />
          <Route path=":type/:id" element={<DocumentDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

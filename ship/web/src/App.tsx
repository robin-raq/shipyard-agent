import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import DocsPage from './pages/DocsPage';
import IssuesPage from './pages/IssuesPage';
import ProjectsPage from './pages/ProjectsPage';
import WeeksPage from './pages/WeeksPage';
import TeamsPage from './pages/TeamsPage';
import ShipsPage from './pages/ShipsPage';
import DocumentDetailPage from './pages/DocumentDetailPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/docs" replace />} />
          <Route path="docs" element={<DocsPage />} />
          <Route path="issues" element={<IssuesPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="weeks" element={<WeeksPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="ships" element={<ShipsPage />} />
          <Route path=":type/:id" element={<DocumentDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

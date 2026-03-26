import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProjects, deleteProject, createProject } from '../api/client';
import DocumentForm from '../components/DocumentForm';

interface Project {
  id: string;
  title: string;
  content: string;
  status: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  planning: 'bg-purple-100 text-purple-800',
  active: 'bg-green-100 text-green-800',
  'on-hold': 'bg-yellow-100 text-yellow-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const navigate = useNavigate();

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getProjects();
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
      await deleteProject(id);
      await fetchProjects();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete project');
    }
  };

  const handleCreate = async (data: { title: string; content: string }) => {
    try {
      await createProject({ ...data, status: 'planning' });
      setShowCreateForm(false);
      await fetchProjects();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create project');
    }
  };

  const handleRowClick = (id: string) => {
    navigate(`/projects/${id}`);
  };

  if (loading) {
    return (
      <main className="p-8">
        <div className="text-gray-700" role="status" aria-live="polite">Loading...</div>
      </main>
    );
  }

  return (
    <main className="p-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label={showCreateForm ? 'Cancel creating project' : 'Create new project'}
        >
          {showCreateForm ? 'Cancel' : '+ Create'}
        </button>
      </header>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg" role="alert">
          {error}
        </div>
      )}

      {showCreateForm && (
        <section className="mb-6 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Create New Project</h2>
          <DocumentForm onSubmit={handleCreate} />
        </section>
      )}

      <section className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {projects.length === 0 ? (
          <div className="p-8 text-center text-gray-700">
            No projects found. Create one to get started!
          </div>
        ) : (
          <table className="w-full" role="table" aria-label="Projects list">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr role="row">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {projects.map((project) => (
                <tr
                  key={project.id}
                  onClick={() => handleRowClick(project.id)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  role="row"
                >
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {project.title}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[project.status] || 'bg-gray-100 text-gray-800'}`} role="status" aria-label={`Status: ${project.status}`}>
                      {project.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {new Date(project.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right text-sm">
                    <button
                      onClick={(e) => handleDelete(project.id, e)}
                      className="text-red-700 hover:text-red-900 font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded px-2 py-1"
                      aria-label={`Delete project ${project.title}`}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getIssues, deleteIssue, createIssue } from '../api/client';
import DocumentForm from '../components/DocumentForm';

interface Issue {
  id: string;
  title: string;
  content: string;
  status: string;
  priority: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  closed: 'bg-green-100 text-green-800',
  blocked: 'bg-red-100 text-red-800',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-gray-700',
  medium: 'text-blue-700',
  high: 'text-orange-700',
  critical: 'text-red-700',
};

export default function IssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const navigate = useNavigate();

  const fetchIssues = async () => {
    try {
      setLoading(true);
      setError(null);
      const filters: { status?: string; priority?: string } = {};
      if (statusFilter) filters.status = statusFilter;
      if (priorityFilter) filters.priority = priorityFilter;
      const data = await getIssues(filters);
      setIssues(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch issues');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, [statusFilter, priorityFilter]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this issue?')) return;

    try {
      await deleteIssue(id);
      await fetchIssues();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete issue');
    }
  };

  const handleCreate = async (data: { title: string; content: string }) => {
    try {
      await createIssue({ ...data, status: 'open', priority: 'medium' });
      setShowCreateForm(false);
      await fetchIssues();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create issue');
    }
  };

  const handleRowClick = (id: string) => {
    navigate(`/issues/${id}`);
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
        <h1 className="text-3xl font-bold text-gray-900">Issues</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label={showCreateForm ? 'Cancel creating issue' : 'Create new issue'}
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
          <h2 className="text-xl font-semibold mb-4">Create New Issue</h2>
          <DocumentForm onSubmit={handleCreate} />
        </section>
      )}

      {/* Filters */}
      <section className="mb-4 flex gap-4">
        <div>
          <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:border-transparent"
            aria-label="Filter issues by status"
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="closed">Closed</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
        <div>
          <label htmlFor="priority-filter" className="block text-sm font-medium text-gray-700 mb-1">
            Priority
          </label>
          <select
            id="priority-filter"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:border-transparent"
            aria-label="Filter issues by priority"
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {issues.length === 0 ? (
          <div className="p-8 text-center text-gray-700">
            No issues found. Create one to get started!
          </div>
        ) : (
          <table className="w-full" role="table" aria-label="Issues list">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr role="row">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Priority
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
              {issues.map((issue) => (
                <tr
                  key={issue.id}
                  onClick={() => handleRowClick(issue.id)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  role="row"
                >
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {issue.title}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[issue.status] || 'bg-gray-100 text-gray-800'}`} role="status" aria-label={`Status: ${issue.status}`}>
                      {issue.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`font-semibold ${PRIORITY_COLORS[issue.priority] || 'text-gray-700'}`}>
                      {issue.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {new Date(issue.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right text-sm">
                    <button
                      onClick={(e) => handleDelete(issue.id, e)}
                      className="text-red-700 hover:text-red-900 font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded px-2 py-1"
                      aria-label={`Delete issue ${issue.title}`}
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

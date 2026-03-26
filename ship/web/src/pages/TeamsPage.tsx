import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTeams, deleteTeam, createTeam } from '../api/client';

interface Team {
  id: string;
  name: string;
  content: string;
  created_at: string;
}

interface TeamFormProps {
  onSubmit: (data: { name: string; content: string }) => void | Promise<void>;
  initialValues?: {
    name?: string;
    content?: string;
  };
}

function TeamForm({ onSubmit, initialValues }: TeamFormProps) {
  const [name, setName] = useState(initialValues?.name || '');
  const [content, setContent] = useState(initialValues?.content || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({ name, content });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" role="form" aria-label="Team form">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Team Name
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter team name..."
          aria-label="Team Name"
        />
      </div>

      <div>
        <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
          placeholder="Enter team description..."
          aria-label="Description"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label="Save team"
        >
          {submitting ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const navigate = useNavigate();

  const fetchTeams = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTeams();
      setTeams(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch teams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this team?')) return;

    try {
      await deleteTeam(id);
      await fetchTeams();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete team');
    }
  };

  const handleCreate = async (data: { name: string; content: string }) => {
    try {
      await createTeam(data);
      setShowCreateForm(false);
      await fetchTeams();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create team');
    }
  };

  const handleRowClick = (id: string) => {
    navigate(`/teams/${id}`);
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
        <h1 className="text-3xl font-bold text-gray-900">Teams</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label={showCreateForm ? 'Cancel creating team' : 'Create new team'}
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
          <h2 className="text-xl font-semibold mb-4">Create New Team</h2>
          <TeamForm onSubmit={handleCreate} />
        </section>
      )}

      <section className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {teams.length === 0 ? (
          <div className="p-8 text-center text-gray-700">
            No teams found. Create one to get started!
          </div>
        ) : (
          <table className="w-full" role="table" aria-label="Teams list">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr role="row">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Team Name
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
              {teams.map((team) => (
                <tr
                  key={team.id}
                  onClick={() => handleRowClick(team.id)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  role="row"
                >
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {team.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {new Date(team.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right text-sm">
                    <button
                      onClick={(e) => handleDelete(team.id, e)}
                      className="text-red-700 hover:text-red-900 font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded px-2 py-1"
                      aria-label={`Delete team ${team.name}`}
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

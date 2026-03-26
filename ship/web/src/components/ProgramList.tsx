import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ProgramForm from './ProgramForm';

interface Program {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface ProgramListProps {
  onProgramClick?: (id: string) => void;
}

export default function ProgramList({ onProgramClick }: ProgramListProps) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const fetchPrograms = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/programs');
      if (!response.ok) {
        throw new Error('Failed to fetch programs');
      }
      const data = await response.json();
      setPrograms(data.programs || data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch programs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this program?')) return;

    try {
      const response = await fetch(`/api/programs/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete program');
      }
      await fetchPrograms();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete program');
    }
  };

  const handleCreate = async (data: { name: string; description?: string }) => {
    try {
      const response = await fetch('/api/programs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to create program');
      }
      setShowCreateForm(false);
      await fetchPrograms();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create program');
    }
  };

  const handleRowClick = (id: string) => {
    if (onProgramClick) {
      onProgramClick(id);
    } else {
      navigate(`/programs/${id}`);
    }
  };

  const filteredPrograms = programs.filter(program =>
    program.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (program.description && program.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-gray-700" role="status" aria-live="polite">Loading programs...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Programs</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label={showCreateForm ? 'Cancel creating program' : 'Create new program'}
        >
          {showCreateForm ? 'Cancel' : '+ Create Program'}
        </button>
      </header>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg" role="alert">
          {error}
        </div>
      )}

      {showCreateForm && (
        <section className="mb-6 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Create New Program</h2>
          <ProgramForm onSubmit={handleCreate} />
        </section>
      )}

      {/* Search Bar */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search programs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          aria-label="Search programs"
        />
      </div>

      <section className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {filteredPrograms.length === 0 ? (
          <div className="p-8 text-center text-gray-700">
            {searchTerm ? 'No programs match your search.' : 'No programs found. Create one to get started!'}
          </div>
        ) : (
          <table className="w-full" role="table" aria-label="Programs list">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr role="row">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Program Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Description
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
              {filteredPrograms.map((program) => (
                <tr
                  key={program.id}
                  onClick={() => handleRowClick(program.id)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  role="row"
                >
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {program.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {program.description ? (
                      <span className="line-clamp-2">{program.description}</span>
                    ) : (
                      <span className="text-gray-400 italic">No description</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {new Date(program.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right text-sm">
                    <button
                      onClick={(e) => handleDelete(program.id, e)}
                      className="text-red-700 hover:text-red-900 font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded px-2 py-1"
                      aria-label={`Delete program ${program.name}`}
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
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ProgramForm from '../components/ProgramForm';

interface Program {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export default function ProgramDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const fetchProgram = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/programs/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch program');
      }
      const data = await response.json();
      setProgram(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch program');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProgram();
  }, [id]);

  const handleUpdate = async (data: { name: string; description?: string }) => {
    if (!id) return;

    try {
      const response = await fetch(`/api/programs/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to update program');
      }
      setIsEditing(false);
      await fetchProgram();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update program');
    }
  };

  const handleDelete = async () => {
    if (!id || !confirm('Are you sure you want to delete this program?')) return;

    try {
      const response = await fetch(`/api/programs/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete program');
      }
      navigate('/programs');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete program');
    }
  };

  if (loading) {
    return (
      <main className="p-8">
        <div className="text-gray-700" role="status" aria-live="polite">Loading program...</div>
      </main>
    );
  }

  if (error || !program) {
    return (
      <main className="p-8">
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg" role="alert">
          {error || 'Program not found'}
        </div>
        <button
          onClick={() => navigate('/programs')}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          Back to Programs
        </button>
      </main>
    );
  }

  return (
    <main className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/programs')}
            className="text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 rounded px-2 py-1"
            aria-label="Back to programs"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900">{program.name}</h1>
        </div>
        <div className="flex gap-2">
          {!isEditing && (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label="Edit program"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                aria-label="Delete program"
              >
                Delete
              </button>
            </>
          )}
          {isEditing && (
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              aria-label="Cancel editing"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {isEditing ? (
        <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Edit Program</h2>
          <ProgramForm
            onSubmit={handleUpdate}
            initialValues={{
              name: program.name,
              description: program.description,
            }}
          />
        </section>
      ) : (
        <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-medium text-gray-700 mb-2">Program Name</h2>
              <p className="text-lg text-gray-900">{program.name}</p>
            </div>

            <div>
              <h2 className="text-sm font-medium text-gray-700 mb-2">Description</h2>
              {program.description ? (
                <p className="text-gray-900 whitespace-pre-wrap">{program.description}</p>
              ) : (
                <p className="text-gray-400 italic">No description provided</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
              <div>
                <h2 className="text-sm font-medium text-gray-700 mb-1">Created</h2>
                <p className="text-gray-900">
                  {new Date(program.createdAt).toLocaleString()}
                </p>
              </div>
              <div>
                <h2 className="text-sm font-medium text-gray-700 mb-1">Last Updated</h2>
                <p className="text-gray-900">
                  {new Date(program.updatedAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

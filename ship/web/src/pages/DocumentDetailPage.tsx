import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getDoc, updateDoc, deleteDoc,
  getIssue, updateIssue, deleteIssue,
  getProject, updateProject, deleteProject,
  getWeek, updateWeek, deleteWeek,
  getTeam, updateTeam, deleteTeam,
  getShip, updateShip, deleteShip,
  getProgram, updateProgram, deleteProgram
} from '../api/client';
import DocumentForm from '../components/DocumentForm';
import RichTextEditor from '../components/RichTextEditor';

interface Entity {
  id: string;
  title?: string;
  name?: string;
  content?: string;
  description?: string;
  type?: string;
  status?: string;
  priority?: string;
  created_at: string;
  updated_at: string;
}

// API function mapping based on entity type
const API_MAP = {
  docs: {
    get: getDoc,
    update: updateDoc,
    delete: deleteDoc,
    titleField: 'title',
  },
  issues: {
    get: getIssue,
    update: updateIssue,
    delete: deleteIssue,
    titleField: 'title',
  },
  projects: {
    get: getProject,
    update: updateProject,
    delete: deleteProject,
    titleField: 'title',
  },
  weeks: {
    get: getWeek,
    update: updateWeek,
    delete: deleteWeek,
    titleField: 'title',
  },
  teams: {
    get: getTeam,
    update: updateTeam,
    delete: deleteTeam,
    titleField: 'name',
  },
  ships: {
    get: getShip,
    update: updateShip,
    delete: deleteShip,
    titleField: 'name',
    contentField: 'description',
  },
  programs: {
    get: getProgram,
    update: updateProgram,
    delete: deleteProgram,
    titleField: 'name',
    contentField: 'description',
  },
};

export default function DocumentDetailPage() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const [entity, setEntity] = useState<Entity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const api = type && API_MAP[type as keyof typeof API_MAP];

  const fetchEntity = async () => {
    if (!id || !api) {
      setError(`Unknown entity type: ${type}`);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await api.get(id);
      setEntity(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch entity');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntity();
  }, [id, type]);

  const handleUpdate = async (data: { title?: string; name?: string; content: string }) => {
    if (!id || !api) return;

    try {
      await api.update(id, data);
      setIsEditing(false);
      await fetchEntity();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update entity');
    }
  };

  const handleDelete = async () => {
    if (!id || !api || !confirm('Are you sure you want to delete this?')) return;

    try {
      await api.delete(id);
      navigate(`/${type}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete entity');
    }
  };

  if (loading) {
    return (
      <main className="p-8">
        <div className="text-gray-700" role="status" aria-live="polite">Loading...</div>
      </main>
    );
  }

  if (error || !entity || !api) {
    return (
      <main className="p-8">
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg" role="alert">
          {error || 'Entity not found'}
        </div>
      </main>
    );
  }

  const displayTitle = entity.title || entity.name || 'Untitled';
  const titleField = api.titleField;
  const contentField = (api as any).contentField || 'content';
  const displayContent = (entity as any)[contentField] || '';

  return (
    <main className="p-8 max-w-4xl">
      <nav className="mb-6">
        <button
          onClick={() => navigate(`/${type}`)}
          className="text-blue-700 hover:text-blue-900 mb-4 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-2 py-1"
          aria-label={`Back to ${type}`}
        >
          ← Back to {type}
        </button>
      </nav>

      <article className="bg-white border border-gray-200 rounded-lg shadow-sm p-8">
        {isEditing ? (
          <section>
            <header className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Edit {type?.slice(0, -1)}</h1>
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                aria-label="Cancel editing"
              >
                Cancel
              </button>
            </header>
            {titleField === 'name' ? (
              <TeamEditForm
                onSubmit={(data) => handleUpdate(contentField === 'description' ? { name: data.name, description: data.content } as any : data)}
                initialValues={{ name: entity.name || '', content: displayContent }}
              />
            ) : (
              <DocumentForm
                onSubmit={handleUpdate}
                initialValues={{ title: entity.title || '', content: displayContent }}
              />
            )}
          </section>
        ) : (
          <section>
            <header className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{displayTitle}</h1>
                <div className="text-sm text-gray-700">
                  Created: {new Date(entity.created_at).toLocaleString()}
                  {entity.updated_at && entity.updated_at !== entity.created_at && (
                    <> • Updated: {new Date(entity.updated_at).toLocaleString()}</>
                  )}
                </div>
                {entity.status && (
                  <div className="mt-2">
                    <span className="text-sm text-gray-700">Status: </span>
                    <span className="text-sm font-medium text-gray-900">{entity.status}</span>
                  </div>
                )}
                {entity.priority && (
                  <div className="mt-1">
                    <span className="text-sm text-gray-700">Priority: </span>
                    <span className="text-sm font-medium text-gray-900">{entity.priority}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  aria-label={`Edit ${displayTitle}`}
                >
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  aria-label={`Delete ${displayTitle}`}
                >
                  Delete
                </button>
              </div>
            </header>

            <div className="prose max-w-none">
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <RichTextEditor content={displayContent} onChange={() => {}} editable={false} />
              </div>
            </div>
          </section>
        )}
      </article>
    </main>
  );
}

// Team-specific form component for editing
function TeamEditForm({ onSubmit, initialValues }: { 
  onSubmit: (data: { name: string; content: string }) => void | Promise<void>;
  initialValues: { name: string; content: string };
}) {
  const [name, setName] = useState(initialValues.name);
  const [content, setContent] = useState(initialValues.content);
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
    <form onSubmit={handleSubmit} className="space-y-4" role="form" aria-label="Edit team form">
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
          aria-label="Team Name"
        />
      </div>

      <div>
        <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <RichTextEditor
          content={content}
          onChange={setContent}
          editable={true}
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label="Save team changes"
        >
          {submitting ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
}


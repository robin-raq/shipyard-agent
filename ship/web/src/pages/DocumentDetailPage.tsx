import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDocument, updateDocument, deleteDocument } from '../api/client';
import DocumentForm from '../components/DocumentForm';

interface Document {
  id: string;
  title: string;
  content: string;
  type: string;
  created_at: string;
  updated_at: string;
}

export default function DocumentDetailPage() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const fetchDocument = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await getDocument(id);
      setDocument(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch document');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocument();
  }, [id]);

  const handleUpdate = async (data: { title: string; content: string }) => {
    if (!id) return;

    try {
      await updateDocument(id, data);
      setIsEditing(false);
      await fetchDocument();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update document');
    }
  };

  const handleDelete = async () => {
    if (!id || !confirm('Are you sure you want to delete this document?')) return;

    try {
      await deleteDocument(id);
      navigate(`/${type}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete document');
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="p-8">
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error || 'Document not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/${type}`)}
          className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-2"
        >
          ← Back to {type}s
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-8">
        {isEditing ? (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Edit Document</h1>
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
            <DocumentForm
              onSubmit={handleUpdate}
              initialValues={{ title: document.title, content: document.content }}
            />
          </div>
        ) : (
          <div>
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{document.title}</h1>
                <div className="text-sm text-gray-500">
                  Created: {new Date(document.created_at).toLocaleString()}
                  {document.updated_at && document.updated_at !== document.created_at && (
                    <> • Updated: {new Date(document.updated_at).toLocaleString()}</>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="prose max-w-none">
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <pre className="whitespace-pre-wrap font-sans text-gray-800">{document.content}</pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

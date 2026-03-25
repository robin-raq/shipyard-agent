import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDocuments, deleteDocument, createDocument } from '../api/client';
import DocumentForm from './DocumentForm';

interface Document {
  id: string;
  title: string;
  content: string;
  type: string;
  created_at: string;
}

interface DocumentListProps {
  documentType: string;
  heading: string;
}

export default function DocumentList({ documentType, heading }: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const navigate = useNavigate();

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getDocuments(documentType);
      setDocuments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [documentType]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      await deleteDocument(id);
      await fetchDocuments();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete document');
    }
  };

  const handleCreate = async (data: { title: string; content: string }) => {
    try {
      await createDocument({ ...data, type: documentType });
      setShowCreateForm(false);
      await fetchDocuments();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create document');
    }
  };

  const handleRowClick = (id: string) => {
    navigate(`/${documentType}/${id}`);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">{heading}</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showCreateForm ? 'Cancel' : '+ Create'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {showCreateForm && (
        <div className="mb-6 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Create New {heading.slice(0, -1)}</h2>
          <DocumentForm onSubmit={handleCreate} />
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {documents.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No {heading.toLowerCase()} found. Create one to get started!
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {documents.map((doc) => (
                <tr
                  key={doc.id}
                  onClick={() => handleRowClick(doc.id)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {doc.title}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right text-sm">
                    <button
                      onClick={(e) => handleDelete(doc.id, e)}
                      className="text-red-600 hover:text-red-800 font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

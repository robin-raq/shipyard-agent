import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ShipForm from './ShipForm';

interface Ship {
  id: string;
  name: string;
  description: string;
  status: string;
  created_at: string;
}

interface ShipListProps {
  entityType: string;
  heading: string;
  fetchItems: () => Promise<any[]>;
  createItem: (data: any) => Promise<any>;
  deleteItem: (id: string) => Promise<any>;
}

export default function ShipList({ 
  entityType, 
  heading, 
  fetchItems,
  createItem,
  deleteItem
}: ShipListProps) {
  const [items, setItems] = useState<Ship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchItems();
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this ship?')) return;

    try {
      await deleteItem(id);
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete ship');
    }
  };

  const handleCreate = async (data: { name: string; description: string }) => {
    try {
      await createItem(data);
      setShowCreateForm(false);
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create ship');
    }
  };

  const handleRowClick = (id: string) => {
    navigate(`/${entityType}/${id}`);
  };

  if (loading) {
    return (
      <main className="p-8">
        <div className="text-gray-700">Loading...</div>
      </main>
    );
  }

  return (
    <main className="p-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">{heading}</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label={showCreateForm ? 'Cancel creating ship' : 'Create new ship'}
        >
          {showCreateForm ? 'Cancel' : '+ Create'}
        </button>
      </header>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {showCreateForm && (
        <section className="mb-6 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Create New Ship</h2>
          <ShipForm onSubmit={handleCreate} />
        </section>
      )}

      <section className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {items.length === 0 ? (
          <div className="p-8 text-center text-gray-700">
            No {heading.toLowerCase()} found. Create one to get started!
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Name
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
              {items.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => handleRowClick(item.id)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {item.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      item.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {new Date(item.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right text-sm">
                    <button
                      onClick={(e) => handleDelete(item.id, e)}
                      className="text-red-700 hover:text-red-900 font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded px-2 py-1"
                      aria-label={`Delete ${item.name}`}
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

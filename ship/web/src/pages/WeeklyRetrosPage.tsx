import { useState, useEffect } from 'react';
import { getWeeklyRetros, createWeeklyRetro, submitWeeklyRetro, deleteWeeklyRetro } from '../api/client';

interface WeeklyRetro {
  id: string;
  username: string;
  went_well: string;
  to_improve: string;
  action_items: string;
  status: string;
  submitted_at: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  submitted: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  changes_requested: 'bg-orange-100 text-orange-800',
};

export default function WeeklyRetrosPage() {
  const [retros, setRetros] = useState<WeeklyRetro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [wentWell, setWentWell] = useState('');
  const [toImprove, setToImprove] = useState('');
  const [actionItems, setActionItems] = useState('');

  const fetchRetros = async () => {
    try {
      setLoading(true);
      const data = await getWeeklyRetros();
      setRetros(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load retros');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRetros(); }, []);

  const handleCreate = async () => {
    try {
      await createWeeklyRetro({ went_well: wentWell, to_improve: toImprove, action_items: actionItems });
      setWentWell(''); setToImprove(''); setActionItems('');
      setShowForm(false);
      await fetchRetros();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create retro');
    }
  };

  const handleSubmit = async (id: string) => {
    if (!confirm('Submit this retro for review?')) return;
    try { await submitWeeklyRetro(id); await fetchRetros(); }
    catch (err) { alert(err instanceof Error ? err.message : 'Failed to submit'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this retro?')) return;
    try { await deleteWeeklyRetro(id); await fetchRetros(); }
    catch (err) { alert(err instanceof Error ? err.message : 'Failed to delete'); }
  };

  if (loading) return <main className="p-8"><p className="text-gray-500">Loading...</p></main>;

  return (
    <main className="p-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Weekly Retros</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Retro'}
        </button>
      </header>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>}

      {showForm && (
        <section className="mb-6 p-6 bg-white border border-gray-200 rounded-lg shadow-sm space-y-4">
          <h2 className="text-xl font-semibold">Create Weekly Retro</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">What went well?</label>
            <textarea value={wentWell} onChange={(e) => setWentWell(e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">What could improve?</label>
            <textarea value={toImprove} onChange={(e) => setToImprove(e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Action items</label>
            <textarea value={actionItems} onChange={(e) => setActionItems(e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Save Retro
          </button>
        </section>
      )}

      {retros.length === 0 ? (
        <div className="p-8 text-center text-gray-500 bg-white rounded-lg border">No retros yet.</div>
      ) : (
        <div className="space-y-4">
          {retros.map((retro) => (
            <div key={retro.id} className="bg-white border rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="font-semibold text-gray-900">{retro.username}</span>
                  <span className="text-sm text-gray-500 ml-2">{new Date(retro.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[retro.status]}`}>
                    {retro.status.replace('_', ' ')}
                  </span>
                  {retro.status === 'draft' && (
                    <button onClick={() => handleSubmit(retro.id)} className="text-sm text-blue-600 hover:underline">Submit</button>
                  )}
                  <button onClick={() => handleDelete(retro.id)} className="text-sm text-red-600 hover:underline">Delete</button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <h4 className="text-xs font-medium text-green-600 uppercase mb-1">Went Well</h4>
                  <p className="text-sm text-gray-700">{retro.went_well || '—'}</p>
                </div>
                <div>
                  <h4 className="text-xs font-medium text-orange-600 uppercase mb-1">To Improve</h4>
                  <p className="text-sm text-gray-700">{retro.to_improve || '—'}</p>
                </div>
                <div>
                  <h4 className="text-xs font-medium text-blue-600 uppercase mb-1">Action Items</h4>
                  <p className="text-sm text-gray-700">{retro.action_items || '—'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

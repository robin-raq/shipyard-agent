import { useState, useEffect } from 'react';
import { getWeeklyPlans, createWeeklyPlan, submitWeeklyPlan, deleteWeeklyPlan, getWeeks } from '../api/client';
import RichTextEditor from '../components/RichTextEditor';

interface WeeklyPlan {
  id: string;
  user_id: string;
  username: string;
  week_id: string;
  plan_content: string;
  status: string;
  submitted_at: string | null;
  created_at: string;
}

interface Week {
  id: string;
  title: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  submitted: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  changes_requested: 'bg-orange-100 text-orange-800',
};

export default function WeeklyPlansPage() {
  const [plans, setPlans] = useState<WeeklyPlan[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [planContent, setPlanContent] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [plansData, weeksData] = await Promise.all([getWeeklyPlans(), getWeeks()]);
      setPlans(plansData);
      setWeeks(weeksData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async () => {
    try {
      await createWeeklyPlan({ week_id: selectedWeek || undefined, plan_content: planContent });
      setPlanContent('');
      setSelectedWeek('');
      setShowForm(false);
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create plan');
    }
  };

  const handleSubmit = async (id: string) => {
    if (!confirm('Submit this plan for review?')) return;
    try {
      await submitWeeklyPlan(id);
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit plan');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this plan?')) return;
    try {
      await deleteWeeklyPlan(id);
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete plan');
    }
  };

  if (loading) return <main className="p-8"><p className="text-gray-500">Loading...</p></main>;

  return (
    <main className="p-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Weekly Plans</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Plan'}
        </button>
      </header>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>}

      {showForm && (
        <section className="mb-6 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Create Weekly Plan</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Week</label>
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Select a week...</option>
              {weeks.map((w) => <option key={w.id} value={w.id}>{w.title}</option>)}
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Plan Content</label>
            <RichTextEditor content={planContent} onChange={setPlanContent} />
          </div>
          <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Save Plan
          </button>
        </section>
      )}

      <section className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {plans.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No weekly plans yet. Create one to get started!</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Author</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {plans.map((plan) => (
                <tr key={plan.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{plan.username}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[plan.status] || 'bg-gray-100'}`}>
                      {plan.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{new Date(plan.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-right text-sm space-x-2">
                    {plan.status === 'draft' && (
                      <button onClick={() => handleSubmit(plan.id)} className="text-blue-600 hover:underline">Submit</button>
                    )}
                    <button onClick={() => handleDelete(plan.id)} className="text-red-600 hover:underline">Delete</button>
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

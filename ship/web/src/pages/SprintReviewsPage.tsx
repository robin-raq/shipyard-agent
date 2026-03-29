import { useEffect, useMemo, useState } from 'react';
import {
  getSprintReviews,
  createSprintReview,
  submitSprintReview,
  deleteSprintReview,
  getWeeks,
  type SprintReview,
} from '../api/client';
import RichTextEditor from '../components/RichTextEditor';

interface Week {
  id: string;
  title: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  submitted: 'bg-blue-100 text-blue-800',
  finalized: 'bg-green-100 text-green-800',
};

export default function SprintReviewsPage() {
  const [reviews, setReviews] = useState<SprintReview[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [weekId, setWeekId] = useState('');
  const [summary, setSummary] = useState('');
  const [accomplishments, setAccomplishments] = useState('');
  const [challenges, setChallenges] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [teamRating, setTeamRating] = useState(3);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [reviewsData, weeksData] = await Promise.all([
        getSprintReviews(),
        getWeeks(),
      ]);
      setReviews(reviewsData);
      setWeeks(weeksData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sprint reviews');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const weekTitleById = useMemo(() => {
    const map: Record<string, string> = {};
    weeks.forEach((w) => { map[w.id] = w.title; });
    return map;
  }, [weeks]);

  const groupedByWeek = useMemo(() => {
    const groups: Record<string, SprintReview[]> = {};
    for (const r of reviews) {
      if (!groups[r.weekId]) groups[r.weekId] = [];
      groups[r.weekId].push(r);
    }
    // Sort each group's reviews by createdAt desc
    Object.values(groups).forEach((arr) => arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    // Return entries sorted by week title (fallback to id)
    return Object.entries(groups).sort((a, b) => {
      const aTitle = weekTitleById[a[0]] || a[0];
      const bTitle = weekTitleById[b[0]] || b[0];
      return aTitle.localeCompare(bTitle);
    });
  }, [reviews, weekTitleById]);

  const resetForm = () => {
    setWeekId('');
    setSummary('');
    setAccomplishments('');
    setChallenges('');
    setNextSteps('');
    setTeamRating(3);
  };

  const handleCreate = async () => {
    if (!weekId) {
      alert('Please select a week');
      return;
    }
    if (!summary.trim()) {
      alert('Please enter a summary');
      return;
    }

    try {
      await createSprintReview({
        weekId,
        summary,
        accomplishments,
        challenges,
        nextSteps,
        teamRating,
      });
      resetForm();
      setShowForm(false);
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create sprint review');
    }
  };

  const handleSubmit = async (id: string) => {
    if (!confirm('Submit this sprint review?')) return;
    try {
      await submitSprintReview(id);
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit sprint review');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this sprint review?')) return;
    try {
      await deleteSprintReview(id);
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete sprint review');
    }
  };

  if (loading) return <main className="p-8"><p className="text-gray-500">Loading...</p></main>;

  return (
    <main className="p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sprint Reviews</h1>
          <p className="text-gray-500">Grouped by week</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Review'}
        </button>
      </header>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>
      )}

      {showForm && (
        <section className="mb-6 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Create Sprint Review</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Week</label>
              <select
                value={weekId}
                onChange={(e) => setWeekId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select a week...</option>
                {weeks.map((w) => (
                  <option key={w.id} value={w.id}>{w.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Team Rating</label>
              <input
                type="number"
                min={1}
                max={5}
                value={teamRating}
                onChange={(e) => setTeamRating(Math.max(1, Math.min(5, Number(e.target.value) || 0)))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Summary</label>
              <input
                type="text"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="High-level summary of the week..."
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Accomplishments</label>
              <RichTextEditor content={accomplishments} onChange={setAccomplishments} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Challenges</label>
              <RichTextEditor content={challenges} onChange={setChallenges} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Next Steps</label>
              <RichTextEditor content={nextSteps} onChange={setNextSteps} />
            </div>
          </div>
          <div className="mt-4">
            <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Review</button>
          </div>
        </section>
      )}

      <section className="space-y-6">
        {groupedByWeek.length === 0 ? (
          <div className="p-8 text-center text-gray-500 bg-white rounded-lg border">No sprint reviews yet. Create one to get started!</div>
        ) : (
          groupedByWeek.map(([wId, list]) => (
            <div key={wId} className="bg-white border rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-800">{weekTitleById[wId] || 'Week'}{weekTitleById[wId] ? '' : ` (${wId})`}</h2>
              </div>
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Summary</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Team Rating</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {list.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{r.summary}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{r.teamRating}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] || 'bg-gray-100'}`}>{r.status}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-right text-sm space-x-2">
                        {r.status === 'draft' && (
                          <button onClick={() => handleSubmit(r.id)} className="text-blue-600 hover:underline">Submit</button>
                        )}
                        <button onClick={() => handleDelete(r.id)} className="text-red-600 hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </section>
    </main>
  );
}

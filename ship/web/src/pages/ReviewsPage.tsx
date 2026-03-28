import { useState, useEffect } from 'react';
import { getPendingReviews, createReview } from '../api/client';

interface PendingPlan {
  id: string;
  username: string;
  plan_content: string;
  submitted_at: string;
  entity_type: 'weekly_plan';
}

interface PendingRetro {
  id: string;
  username: string;
  went_well: string;
  to_improve: string;
  action_items: string;
  submitted_at: string;
  entity_type: 'weekly_retro';
}

export default function ReviewsPage() {
  const [plans, setPlans] = useState<PendingPlan[]>([]);
  const [retros, setRetros] = useState<PendingRetro[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPending = async () => {
    try {
      setLoading(true);
      const data = await getPendingReviews();
      setPlans(data.plans || []);
      setRetros(data.retros || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPending(); }, []);

  const handleReview = async (entityType: string, entityId: string, decision: string) => {
    const comment = decision === 'changes_requested'
      ? prompt('What changes are needed?') || ''
      : '';
    try {
      await createReview({ entity_type: entityType, entity_id: entityId, decision, comment });
      await fetchPending();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit review');
    }
  };

  if (loading) return <main className="p-8"><p className="text-gray-500">Loading...</p></main>;

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Reviews</h1>
      <p className="text-gray-500 mb-6">{total} item{total !== 1 ? 's' : ''} awaiting review</p>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>}

      {total === 0 ? (
        <div className="p-8 text-center text-gray-500 bg-white rounded-lg border">Nothing to review. All caught up!</div>
      ) : (
        <div className="space-y-6">
          {plans.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-3">Weekly Plans</h2>
              <div className="space-y-3">
                {plans.map((plan) => (
                  <div key={plan.id} className="bg-white border rounded-lg shadow-sm p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="font-semibold">{plan.username}</span>
                        <span className="text-sm text-gray-500 ml-2">
                          Submitted {new Date(plan.submitted_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReview('weekly_plan', plan.id, 'approved')}
                          className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReview('weekly_plan', plan.id, 'changes_requested')}
                          className="px-3 py-1 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700"
                        >
                          Request Changes
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{plan.plan_content}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {retros.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-3">Weekly Retros</h2>
              <div className="space-y-3">
                {retros.map((retro) => (
                  <div key={retro.id} className="bg-white border rounded-lg shadow-sm p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="font-semibold">{retro.username}</span>
                        <span className="text-sm text-gray-500 ml-2">
                          Submitted {new Date(retro.submitted_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReview('weekly_retro', retro.id, 'approved')}
                          className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReview('weekly_retro', retro.id, 'changes_requested')}
                          className="px-3 py-1 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700"
                        >
                          Request Changes
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div><h4 className="font-medium text-green-600 text-xs uppercase mb-1">Went Well</h4><p className="text-gray-700">{retro.went_well}</p></div>
                      <div><h4 className="font-medium text-orange-600 text-xs uppercase mb-1">To Improve</h4><p className="text-gray-700">{retro.to_improve}</p></div>
                      <div><h4 className="font-medium text-blue-600 text-xs uppercase mb-1">Action Items</h4><p className="text-gray-700">{retro.action_items}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}

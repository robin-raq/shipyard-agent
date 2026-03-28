import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getIssues, getStandupStatus, getWeeklyPlans, getPendingReviews } from '../api/client';

interface DashboardData {
  issues: { total: number; inProgress: number; triage: number };
  standup: { due: boolean };
  plans: { total: number; drafts: number };
  reviews: { pending: number };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const [issues, standupStatus, plans, reviews] = await Promise.allSettled([
          getIssues(),
          getStandupStatus(),
          getWeeklyPlans(),
          getPendingReviews(),
        ]);

        const issuesData = issues.status === 'fulfilled' ? issues.value : [];
        const standupData = standupStatus.status === 'fulfilled' ? standupStatus.value : { due: false };
        const plansData = plans.status === 'fulfilled' ? plans.value : [];
        const reviewsData = reviews.status === 'fulfilled' ? reviews.value : { total: 0 };

        setData({
          issues: {
            total: issuesData.length,
            inProgress: issuesData.filter((i: any) => i.status === 'in_progress').length,
            triage: issuesData.filter((i: any) => i.status === 'triage').length,
          },
          standup: { due: standupData.due },
          plans: {
            total: plansData.length,
            drafts: plansData.filter((p: any) => p.status === 'draft').length,
          },
          reviews: { pending: reviewsData.total || 0 },
        });
      } catch {
        // Dashboard should never fail — show empty state
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <main className="p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>
        <p className="text-gray-500">Loading...</p>
      </main>
    );
  }

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
      <p className="text-gray-500 mb-8">Welcome back, {user?.username || 'developer'}.</p>

      {/* Action banner */}
      {data?.standup.due && (
        <div
          onClick={() => navigate('/standups')}
          className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors"
        >
          <p className="text-blue-800 font-medium">📝 You haven't submitted your standup today. <span className="underline">Submit now →</span></p>
        </div>
      )}

      {(data?.reviews.pending ?? 0) > 0 && (
        <div
          onClick={() => navigate('/reviews')}
          className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg cursor-pointer hover:bg-yellow-100 transition-colors"
        >
          <p className="text-yellow-800 font-medium">✅ {data!.reviews.pending} item{data!.reviews.pending !== 1 ? 's' : ''} awaiting your review. <span className="underline">Review now →</span></p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Issues"
          value={data?.issues.total ?? 0}
          subtitle={`${data?.issues.inProgress ?? 0} in progress`}
          icon="🐛"
          onClick={() => navigate('/issues')}
        />
        <StatCard
          title="Triage"
          value={data?.issues.triage ?? 0}
          subtitle="need attention"
          icon="🔍"
          color="purple"
          onClick={() => navigate('/issues')}
        />
        <StatCard
          title="Weekly Plans"
          value={data?.plans.total ?? 0}
          subtitle={`${data?.plans.drafts ?? 0} drafts`}
          icon="📋"
          onClick={() => navigate('/weekly-plans')}
        />
        <StatCard
          title="Pending Reviews"
          value={data?.reviews.pending ?? 0}
          subtitle="awaiting action"
          icon="✅"
          color={data?.reviews.pending ? 'yellow' : undefined}
          onClick={() => navigate('/reviews')}
        />
      </div>

      {/* Quick links */}
      <h2 className="text-lg font-semibold text-gray-800 mb-3">Quick Actions</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickLink icon="📝" label="New Standup" onClick={() => navigate('/standups')} />
        <QuickLink icon="🐛" label="New Issue" onClick={() => navigate('/issues')} />
        <QuickLink icon="📋" label="New Plan" onClick={() => navigate('/weekly-plans')} />
        <QuickLink icon="🔄" label="New Retro" onClick={() => navigate('/weekly-retros')} />
      </div>
    </main>
  );
}

function StatCard({ title, value, subtitle, icon, color, onClick }: {
  title: string; value: number; subtitle: string; icon: string; color?: string; onClick: () => void;
}) {
  const borderColor = color === 'purple' ? 'border-l-purple-500' : color === 'yellow' ? 'border-l-yellow-500' : 'border-l-blue-500';
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg shadow-sm border border-l-4 ${borderColor} p-4 cursor-pointer hover:shadow-md transition-shadow`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-600">{title}</span>
        <span>{icon}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500">{subtitle}</div>
    </div>
  );
}

function QuickLink({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 p-3 bg-white border rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:border-blue-300 transition-colors"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

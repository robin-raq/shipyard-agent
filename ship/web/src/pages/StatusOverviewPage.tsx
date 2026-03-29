import { useEffect, useMemo, useState } from 'react';
import { getStatusOverview, type StatusOverview } from '../api/client';

const STATUS_ORDER = ['triage', 'backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled'] as const;
const PRIORITY_ORDER = ['low', 'medium', 'high', 'urgent'] as const;

type StatusKey = typeof STATUS_ORDER[number];
type PriorityKey = typeof PRIORITY_ORDER[number];

const STATUS_COLORS: Record<StatusKey, string> = {
  triage: 'bg-purple-500',
  backlog: 'bg-gray-500',
  todo: 'bg-blue-500',
  in_progress: 'bg-yellow-500',
  in_review: 'bg-indigo-500',
  done: 'bg-green-500',
  cancelled: 'bg-red-500',
};

const PRIORITY_COLORS: Record<PriorityKey, string> = {
  low: 'bg-gray-400',
  medium: 'bg-blue-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-600',
};

export default function StatusOverviewPage() {
  const [data, setData] = useState<StatusOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await getStatusOverview();
        if (mounted) setData(res);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Failed to load status overview');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Status Overview</h1>
        <p className="text-gray-600">Project and team health metrics</p>
      </header>

      {loading && (
        <div className="text-gray-700" role="status" aria-live="polite">Loading...</div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg" role="alert">{error}</div>
      )}

      {data && (
        <>
          {/* Stat cards */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard title="Projects" value={data.projectCount} icon="📦" color="blue" />
            <StatCard title="Teams" value={data.teamCount} icon="👥" color="purple" />
            <StatCard title="Active Today" value={data.activeUsersToday} icon="⚡" color="green" />
            <StatCard title="Pending Reviews" value={data.pendingReviews} icon="✅" color={data.pendingReviews ? 'yellow' : undefined} />
          </section>

          {/* Charts */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Issues by Status</h2>
              <HorizontalBarChart
                order={STATUS_ORDER as readonly string[]}
                data={data.issuesByStatus as Record<string, number>}
                colors={STATUS_COLORS as Record<string, string>}
                labelFormatter={(k) => labelizeStatus(k as StatusKey)}
              />
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Issues by Priority</h2>
              <HorizontalBarChart
                order={PRIORITY_ORDER as readonly string[]}
                data={data.issuesByPriority as Record<string, number>}
                colors={PRIORITY_COLORS as Record<string, string>}
                labelFormatter={(k) => capitalize(k)}
              />
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: number; icon: string; color?: 'blue' | 'purple' | 'green' | 'yellow' }) {
  const border = color === 'purple' ? 'border-l-purple-500' : color === 'green' ? 'border-l-green-500' : color === 'yellow' ? 'border-l-yellow-500' : 'border-l-blue-500';
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-l-4 ${border} p-4`}> 
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-600">{title}</span>
        <span>{icon}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function HorizontalBarChart({
  order,
  data,
  colors,
  labelFormatter,
}: {
  order: readonly string[];
  data: Record<string, number>;
  colors: Record<string, string>;
  labelFormatter?: (key: string) => string;
}) {
  const items = useMemo(() => order.map((k) => ({ key: k, value: data?.[k] ?? 0 })), [order, data]);
  const max = useMemo(() => Math.max(1, ...items.map((i) => i.value)), [items]);

  if (!items.some((i) => i.value > 0)) {
    return <div className="text-sm text-gray-500">No data</div>;
  }

  return (
    <ul className="space-y-3">
      {items.map(({ key, value }) => {
        const widthPct = Math.max(0, Math.round((value / max) * 100));
        return (
          <li key={key} className="flex items-center gap-3">
            <div className="w-28 text-xs text-gray-600 shrink-0">{labelFormatter ? labelFormatter(key) : key}</div>
            <div className="flex-1">
              <div className="h-6 bg-gray-100 rounded">
                <div
                  className={`h-6 rounded ${colors[key] || 'bg-blue-500'}`}
                  style={{ width: `${widthPct}%` }}
                  aria-label={`${labelFormatter ? labelFormatter(key) : key}: ${value}`}
                  role="img"
                />
              </div>
            </div>
            <div className="w-10 text-right text-xs text-gray-700 tabular-nums">{value}</div>
          </li>
        );
      })}
    </ul>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function labelizeStatus(s: StatusKey) {
  switch (s) {
    case 'in_progress':
      return 'In Progress';
    case 'in_review':
      return 'In Review';
    default:
      return capitalize(s.replace('_', ' '));
  }
}

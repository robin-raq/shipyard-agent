import { useEffect, useMemo, useState } from 'react';
import { getActivities } from '../api/client';

// Local ActivityLog type aligned with backend contract
interface ActivityLog {
  id: string;
  userId: string;
  action: 'created' | 'updated' | 'deleted' | 'commented' | 'status_changed' | 'assigned';
  entityType: 'issue' | 'project' | 'document' | 'comment' | 'standup' | 'weekly_plan' | 'weekly_retro';
  entityId: string;
  entityTitle: string;
  metadata: Record<string, any> | null;
  createdAt: string;
}

const TABS: { key: 'all' | ActivityLog['entityType']; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'issue', label: 'Issues' },
  { key: 'project', label: 'Projects' },
  { key: 'document', label: 'Documents' },
  { key: 'comment', label: 'Comments' },
  { key: 'standup', label: 'Standups' },
  { key: 'weekly_plan', label: 'Plans' },
  { key: 'weekly_retro', label: 'Retros' },
];

function entityIcon(type: ActivityLog['entityType']): string {
  switch (type) {
    case 'issue':
      return '🐛';
    case 'project':
      return '📁';
    case 'document':
      return '📄';
    case 'comment':
      return '💬';
    case 'standup':
      return '📝';
    case 'weekly_plan':
      return '📋';
    case 'weekly_retro':
      return '🔄';
    default:
      return '📌';
  }
}

function formatAction(action: ActivityLog['action']) {
  return action.replace('_', ' ');
}

export default function ActivityPage() {
  const [selectedTab, setSelectedTab] = useState<(typeof TABS)[number]['key']>('all');
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);

  const filters = useMemo(() => {
    const f: { limit: number; offset: number; entity_type?: string } = { limit, offset };
    if (selectedTab !== 'all') f.entity_type = selectedTab;
    return f;
  }, [limit, offset, selectedTab]);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const res = await getActivities(filters);
        if (!cancelled) {
          setActivities(res.activities as ActivityLog[]);
          setTotal(res.total || 0);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load activity');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const canLoadMore = activities.length < total;

  const handleTabChange = (key: (typeof TABS)[number]['key']) => {
    setSelectedTab(key);
    setOffset(0);
  };

  const handleLoadMore = async () => {
    const nextOffset = offset + limit;
    setOffset(nextOffset);
    try {
      const res = await getActivities({ ...filters, offset: nextOffset });
      // Append new activities
      setActivities((prev) => [...prev, ...(res.activities as ActivityLog[])]);
      setTotal(res.total || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load more');
    }
  };

  return (
    <main className="p-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Activity</h1>
      </header>

      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-6" aria-label="Activity filters">
          {TABS.map((tab) => {
            const isActive = selectedTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
                } whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium`}
                aria-current={isActive ? 'page' : undefined}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>
      )}

      <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        {loading && activities.length === 0 ? (
          <p className="text-gray-500">Loading...</p>
        ) : activities.length === 0 ? (
          <p className="text-gray-500">No activity yet.</p>
        ) : (
          <ol role="list" className="relative border-l border-gray-200 ml-2">
            {activities.map((a) => (
              <li key={a.id} className="mb-8 ml-6">
                <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 ring-8 ring-white">
                  <span className="text-base">{entityIcon(a.entityType)}</span>
                </span>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm text-gray-600">
                      <span className="capitalize font-medium text-gray-900">{formatAction(a.action)}</span>{' '}
                      <span>on</span>{' '}
                      <span className="capitalize">{a.entityType.replace('_', ' ')}</span>
                    </div>
                    <div className="mt-1 text-gray-900 font-medium">{a.entityTitle}</div>
                    {a.metadata && Object.keys(a.metadata || {}).length > 0 && (
                      <div className="mt-2 text-xs text-gray-500">
                        {Object.entries(a.metadata!).map(([k, v]) => (
                          <span key={k} className="mr-3">
                            <span className="font-medium">{k}:</span> {String(v)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <time className="shrink-0 text-xs text-gray-500" dateTime={a.createdAt}>
                    {new Date(a.createdAt).toLocaleString()}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        )}

        {canLoadMore && (
          <div className="mt-4 text-center">
            <button
              onClick={handleLoadMore}
              className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Load more'}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

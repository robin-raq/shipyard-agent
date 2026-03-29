import React, { useEffect, useMemo, useState } from 'react';
import { getFleetGraphApprovals, updateFleetGraphApproval, ApprovalStatus, ApprovalRecord } from '../api/fleetgraph';

const statusTabs: { key: ApprovalStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

function timeAgo(iso: string) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ApprovalStatus | 'all'>('pending');
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getFleetGraphApprovals(filter === 'all' ? undefined : filter);
      setApprovals(res.approvals || []);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const counts = useMemo(() => {
    const c = { all: approvals.length, pending: 0, approved: 0, rejected: 0 } as Record<ApprovalStatus | 'all', number>;
    approvals.forEach((a) => {
      // When filtered via API, still compute from returned list
      c[a.status] += 1 as any;
    });
    c.all = approvals.length;
    return c;
  }, [approvals]);

  const handleDecision = async (id: string, decision: 'approved' | 'rejected') => {
    try {
      setSubmittingId(id);
      await updateFleetGraphApproval(id, decision);
      await refresh();
    } catch (err: any) {
      alert(err instanceof Error ? err.message : 'Failed to update approval');
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Approvals</h1>
        <p className="text-gray-600 mt-1">Review and manage FleetGraph approvals.</p>
      </header>

      {/* Tabs */}
      <div className="mb-6 flex gap-2" role="tablist" aria-label="Approval status tabs">
        {statusTabs.map((t) => {
          const active = filter === t.key;
          const count = t.key === 'all' ? counts.all : counts[t.key as ApprovalStatus] || 0;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(t.key as any)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span>{t.label}</span>
              <span className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs ${
                active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
              }`}>{count}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-gray-700" role="status" aria-live="polite">Loading approvals…</div>
      ) : approvals.length === 0 ? (
        <div className="p-8 bg-white border border-gray-200 rounded-lg text-center text-gray-600">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">✅</div>
          <p className="font-medium">No approvals {filter !== 'all' ? `for ${filter}` : ''}.</p>
          <p className="text-sm text-gray-500 mt-1">When FleetGraph requires approval, it will appear here.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {approvals.map((a) => (
            <li key={a.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center justify-center h-6 w-6 rounded bg-blue-600 text-white text-xs font-semibold">FG</span>
                    <h3 className="text-gray-900 font-semibold">Approval #{a.id.slice(0, 6)}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      a.status === 'pending' ? 'bg-amber-50 text-amber-700' : a.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                    }`}>{a.status}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-800">Target: {a.target}</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-600 space-x-2">
                    <span>Created {new Date(a.createdAt).toLocaleString()} ({timeAgo(a.createdAt)})</span>
                    <span>• Updated {new Date(a.updatedAt).toLocaleString()} ({timeAgo(a.updatedAt)})</span>
                  </div>
                </div>
                {a.status === 'pending' && (
                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      disabled={!!submittingId}
                      onClick={() => handleDecision(a.id, 'rejected')}
                      className="px-3 py-2 text-sm font-medium text-red-700 hover:text-red-900 focus:outline-none focus:ring-2 focus:ring-red-500 rounded-lg disabled:opacity-60"
                    >
                      {submittingId === a.id ? 'Working…' : 'Reject'}
                    </button>
                    <button
                      disabled={!!submittingId}
                      onClick={() => handleDecision(a.id, 'approved')}
                      className="px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                    >
                      {submittingId === a.id ? 'Working…' : 'Approve'}
                    </button>
                  </div>
                )}
              </div>

              {/* Findings */}
              {a.findings && a.findings.length > 0 && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {a.findings.map((f) => (
                    <div key={f.id} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-gray-900 truncate pr-2">{f.title || 'Finding'}</div>
                        <span className={`ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
                          f.severity === 'critical' ? 'bg-red-100 text-red-700' : f.severity === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {f.severity}
                        </span>
                      </div>
                      {f.category && <div className="mt-0.5 text-[11px] text-gray-500">{f.category}</div>}
                      {f.detail && <div className="mt-1 text-[12px] text-gray-700 line-clamp-3">{f.detail}</div>}
                    </div>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

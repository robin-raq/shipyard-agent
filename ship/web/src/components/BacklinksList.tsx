import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { authFetch } from '../context/AuthContext';

// Shared contract view (frontend)
export interface Backlink {
  id: string;
  sourceType: string; // e.g., 'issue' | 'project' | 'document' | 'ship' | 'program' | 'comment'
  sourceId: string;
  targetType: string;
  targetId: string;
  createdAt: string;
}

export interface BacklinksListProps {
  entityType: string; // current entity type (singular)
  entityId: string; // current entity id
  className?: string;
  title?: string;
}

function normalizeEntityType(t: string): string {
  const lower = (t || '').toLowerCase();
  if (lower === 'docs' || lower === 'doc' || lower === 'documents') return 'document';
  if (lower === 'issues' || lower === 'issue') return 'issue';
  if (lower === 'projects' || lower === 'project') return 'project';
  if (lower === 'ships' || lower === 'ship') return 'ship';
  if (lower === 'programs' || lower === 'program') return 'program';
  if (lower === 'teams' || lower === 'team') return 'team';
  if (lower === 'comments' || lower === 'comment') return 'comment';
  return lower;
}

export default function BacklinksList({ entityType, entityId, className = '', title = 'Backlinks' }: BacklinksListProps) {
  const normalizedType = useMemo(() => normalizeEntityType(entityType), [entityType]);

  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBacklinks = useCallback(async () => {
    if (!entityId || !normalizedType) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ entity_type: String(normalizedType), entity_id: String(entityId) });
      const res = await authFetch(`/api/backlinks?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to fetch backlinks' }));
        throw new Error(err.message || 'Failed to fetch backlinks');
      }
      const data = await res.json();
      const list: Backlink[] = Array.isArray(data) ? data : (data?.backlinks ?? []);
      setBacklinks(list || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load backlinks');
    } finally {
      setLoading(false);
    }
  }, [entityId, normalizedType]);

  useEffect(() => {
    fetchBacklinks();
  }, [fetchBacklinks]);

  const renderBacklinkLine = (b: Backlink) => {
    const isSource = b.sourceType?.toLowerCase() === String(normalizedType) && b.sourceId === entityId;
    const arrow = isSource ? '→' : '←';

    return (
      <div className="flex items-center justify-between gap-3 p-2 rounded-md border border-gray-200 bg-white hover:bg-gray-50">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-gray-700">
            <span className="inline-flex items-center gap-1">
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 text-[10px] font-medium capitalize">
                {b.sourceType}
              </span>
              <span className="text-gray-500">{b.sourceId.slice(0, 8)}…</span>
            </span>
            <span className="text-gray-400" aria-hidden>{arrow}</span>
            <span className="inline-flex items-center gap-1">
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 text-[10px] font-medium capitalize">
                {b.targetType}
              </span>
              <span className="text-gray-500">{b.targetId.slice(0, 8)}…</span>
            </span>
          </div>
          <div className="mt-0.5 text-[10px] text-gray-500">{new Date(b.createdAt).toLocaleString()}</div>
        </div>
      </div>
    );
  };

  return (
    <section className={`mt-4 ${className}`} aria-label={title}>
      <header className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        <div className="flex items-center gap-2">
          {!loading && <span className="text-xs text-gray-600">{backlinks.length}</span>}
          <button
            type="button"
            onClick={fetchBacklinks}
            className="inline-flex items-center px-2 py-1 rounded text-xs text-gray-700 hover:bg-gray-100"
            aria-label="Refresh backlinks"
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-2 p-2 text-xs bg-red-50 border border-red-200 text-red-700 rounded" role="alert">
          {error}
        </div>
      )}

      <div className="border border-gray-200 rounded-md bg-white">
        {loading ? (
          <div className="p-3 text-sm text-gray-600" role="status" aria-live="polite">Loading backlinks…</div>
        ) : backlinks.length === 0 ? (
          <div className="p-3 text-sm text-gray-600">No backlinks</div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {backlinks.map((b) => (
              <li key={b.id} className="px-3 py-2">{renderBacklinkLine(b)}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

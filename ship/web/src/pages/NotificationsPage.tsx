import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { authFetch } from '../context/AuthContext';

// Local copy of shared contract types for Notifications
const NOTIFICATION_TYPES = ['assignment', 'comment', 'review_request', 'review_decision', 'mention', 'status_change'] as const;

type NotificationType = typeof NOTIFICATION_TYPES[number];

interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null; // ISO string or null
  createdAt: string; // ISO string
}

interface GetNotificationsResponse {
  notifications: Notification[];
  unread_count: number;
}

interface GetUnreadCountResponse {
  count: number;
}

type TabKey = 'all' | 'unread';

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function timeAgo(iso: string) {
  const d = new Date(iso);
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationsPage() {
  const [tab, setTab] = useState<TabKey>('all');
  const [pageSize, setPageSize] = useState<number>(20);
  const [pageIndex, setPageIndex] = useState<number>(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Notification[]>([]);
  const [hasNext, setHasNext] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const query = useMemo(() => ({
    limit: pageSize,
    offset: pageIndex * pageSize,
    unreadOnly: tab === 'unread',
  }), [pageSize, pageIndex, tab]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await authFetch('/api/notifications/unread-count');
      if (!res.ok) throw new Error(`Failed to fetch unread count (${res.status})`);
      const json = (await res.json()) as GetUnreadCountResponse;
      setUnreadCount(json.count ?? 0);
    } catch (e) {
      // ignore errors to avoid UI noise
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.set('limit', String(query.limit));
      params.set('offset', String(query.offset));
      if (query.unreadOnly) params.set('unread_only', 'true');
      const res = await authFetch(`/api/notifications?${params.toString()}`);
      if (!res.ok) throw new Error(`Failed to fetch notifications (${res.status})`);
      const json = (await res.json()) as GetNotificationsResponse;
      setItems(json.notifications || []);
      setHasNext((json.notifications || []).length === query.limit);
      if (typeof json.unread_count === 'number') setUnreadCount(json.unread_count);
    } catch (e: any) {
      setError(e?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.limit, query.offset, query.unreadOnly]);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Reset pagination when switching tabs or page size
  useEffect(() => {
    setPageIndex(0);
  }, [tab, pageSize]);

  const markAllRead = async () => {
    try {
      await authFetch('/api/notifications/read-all', { method: 'PATCH' });
      setItems((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
      setUnreadCount(0);
      if (tab === 'unread') {
        // In unread tab, refresh to reflect cleared list
        fetchNotifications();
      }
    } catch (e) {
      // ignore
    }
  };

  const markOneRead = async (id: string) => {
    try {
      await authFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      if (tab === 'unread') {
        setItems((prev) => prev.filter((n) => n.id !== id));
      } else {
        setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
      }
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (e) {
      // ignore
    }
  };

  const onRefresh = () => fetchNotifications();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Notifications</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">{unreadCount} unread</span>
          <button
            type="button"
            className="text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400"
            onClick={markAllRead}
            disabled={unreadCount === 0}
          >
            Mark all read
          </button>
          <button
            type="button"
            className="text-sm text-gray-600 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-50"
            onClick={onRefresh}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {([['all', 'All'], ['unread', 'Unread']] as [TabKey, string][]) .map(([key, label]) => {
            const selected = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={classNames(
                  selected
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                  'whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium'
                )}
              >
                {label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Controls */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-600">Page {pageIndex + 1}</div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600">
            Show
            <select
              className="ml-2 rounded border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            per page
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200"
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              disabled={pageIndex === 0 || loading}
            >
              Previous
            </button>
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200"
              onClick={() => setPageIndex((p) => p + 1)}
              disabled={!hasNext || loading}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="mt-4 bg-white rounded-md border border-gray-200 divide-y divide-gray-100">
        {loading && (
          <div className="p-6 text-sm text-gray-500">Loading…</div>
        )}
        {error && !loading && (
          <div className="p-6 text-sm text-red-600">{error}</div>
        )}
        {!loading && !error && items.length === 0 && (
          <div className="p-10 text-sm text-gray-500 text-center">No notifications</div>
        )}
        {!loading && !error && items.map((n) => {
          const unread = !n.readAt;
          return (
            <div key={n.id} className={classNames('p-4 sm:p-5 flex items-start gap-3', unread ? 'bg-blue-50/40' : '')}>
              <div className={classNames('mt-1.5 h-2 w-2 shrink-0 rounded-full', unread ? 'bg-blue-600' : 'bg-transparent')} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="truncate text-sm font-medium text-gray-900" title={n.title}>{n.title}</div>
                  <div className="shrink-0 text-xs text-gray-500">{timeAgo(n.createdAt)}</div>
                </div>
                {n.body && (
                  <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap break-words">{n.body}</div>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 capitalize">{n.type.replace('_', ' ')}</span>
                  {unread && (
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:text-blue-700"
                      onClick={() => markOneRead(n.id)}
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom pagination controls */}
      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200"
          onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
          disabled={pageIndex === 0 || loading}
        >
          Previous
        </button>
        <button
          type="button"
          className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200"
          onClick={() => setPageIndex((p) => p + 1)}
          disabled={!hasNext || loading}
        >
          Next
        </button>
      </div>
    </div>
  );
}

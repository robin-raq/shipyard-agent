import React, { useCallback, useEffect, useRef, useState } from 'react';
import { authFetch, useAuth } from '../context/AuthContext';

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

export interface NotificationBellProps {
  className?: string;
  pollIntervalMs?: number; // default 30s
  limit?: number; // number to show in dropdown (default 10)
}

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function BellIcon({ filled = false, className }: { filled?: boolean; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14.857 17.657A2 2 0 0 1 13 19H11a2 2 0 0 1-1.857-1.343M6 8a6 6 0 1 1 12 0c0 3.866 1.5 5 2 6H4c.5-1 2-2.134 2-6z" />
    </svg>
  );
}

export default function NotificationBell({ className, pollIntervalMs = 30000, limit = 10 }: NotificationBellProps) {
  const { user } = useAuth();
  const [count, setCount] = useState<number>(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadOnly, setUnreadOnly] = useState<boolean>(true);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const intervalRef = useRef<number | null>(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await authFetch('/api/notifications/unread-count');
      if (!res.ok) throw new Error(`Failed to fetch unread count (${res.status})`);
      const json = (await res.json()) as GetUnreadCountResponse;
      setCount(json.count ?? 0);
    } catch (e) {
      // swallow errors to avoid UI noise; keep last known count
      // console.error(e);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      if (unreadOnly) params.set('unread_only', 'true');
      const res = await authFetch(`/api/notifications?${params.toString()}`);
      if (!res.ok) throw new Error(`Failed to fetch notifications (${res.status})`);
      const json = (await res.json()) as GetNotificationsResponse;
      setItems(json.notifications || []);
      // keep count in sync if server returned it
      if (typeof json.unread_count === 'number') setCount(json.unread_count);
    } catch (e: any) {
      setError(e?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [limit, unreadOnly]);

  // Initial fetch + polling for count
  useEffect(() => {
    fetchUnreadCount();
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(fetchUnreadCount, pollIntervalMs) as unknown as number;
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [fetchUnreadCount, pollIntervalMs]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Load notifications when opening
  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  const hasUnread = count > 0;

  const handleToggle = () => setOpen((v) => !v);

  const markAllRead = async () => {
    try {
      await authFetch('/api/notifications/read-all', { method: 'PATCH' });
      setItems((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
      setCount(0);
    } catch (e) {
      // ignore
    }
  };

  const markOneRead = async (id: string) => {
    try {
      await authFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
      setCount((c) => Math.max(0, c - 1));
    } catch (e) {
      // ignore
    }
  };

  const timeAgo = useCallback((iso: string) => {
    const d = new Date(iso);
    const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }, []);

  return (
    <div ref={rootRef} className={classNames('relative', className)}>
      <button
        type="button"
        onClick={handleToggle}
        className={classNames(
          'relative inline-flex items-center justify-center rounded-full p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500',
        )}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Notifications"
      >
        <BellIcon className="h-6 w-6" />
        {hasUnread && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-medium leading-4 h-4 min-w-[16px] px-1 shadow">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-w-[90vw] rounded-md bg-white shadow-lg ring-1 ring-black/5 z-50">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">Notifications</span>
              <span className="text-xs text-gray-500">{count} unread</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-gray-600">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={unreadOnly}
                  onChange={(e) => setUnreadOnly(e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                />
                Unread only
              </label>
              <button
                type="button"
                className="text-xs text-blue-600 hover:text-blue-700 disabled:text-gray-400"
                onClick={(e) => {
                  e.stopPropagation();
                  markAllRead();
                }}
                disabled={count === 0}
              >
                Mark all read
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-auto divide-y divide-gray-100">
            {loading && (
              <div className="p-4 text-sm text-gray-500">Loading…</div>
            )}
            {error && !loading && (
              <div className="p-4 text-sm text-red-600">{error}</div>
            )}
            {!loading && !error && items.length === 0 && (
              <div className="p-6 text-sm text-gray-500 text-center">No notifications</div>
            )}
            {!loading && !error && items.map((n) => {
              const unread = !n.readAt;
              return (
                <div
                  key={n.id}
                  className={classNames('p-3 flex gap-3 cursor-default', unread ? 'bg-blue-50/40' : '')}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={classNames('mt-0.5 h-2 w-2 rounded-full', unread ? 'bg-blue-600' : 'bg-transparent')} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="truncate text-sm font-medium text-gray-900" title={n.title}>{n.title}</div>
                      <div className="shrink-0 text-xs text-gray-500">{timeAgo(n.createdAt)}</div>
                    </div>
                    {n.body && (
                      <div className="mt-0.5 text-sm text-gray-600 line-clamp-2 whitespace-pre-wrap break-words">{n.body}</div>
                    )}
                    <div className="mt-2 flex items-center gap-2">
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

          <div className="p-2 text-center border-t border-gray-100">
            <button
              type="button"
              className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-50"
              onClick={(e) => {
                e.stopPropagation();
                fetchNotifications();
              }}
            >
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import { authFetch } from '../context/AuthContext';

// Local copy of shared contract types for Org Chart
export interface User {
  id: string;
  username: string;
  email: string;
  title: string;
  department: string;
  reportsTo: string | null;
}

export interface OrgCardProps {
  user: User;
  departments?: string[];
  managers?: Array<{ id: string; username: string }>; // optional list to choose manager from
  className?: string;
  defaultOpen?: boolean;
  onSaved?: (user: User) => void;
}

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function normalizeUser(json: any): User {
  return {
    id: json?.id,
    username: json?.username,
    email: json?.email,
    title: json?.title ?? '',
    department: json?.department ?? '',
    reportsTo: json?.reportsTo ?? json?.reports_to ?? null,
  } as User;
}

export default function OrgCard({
  user,
  departments = [],
  managers = [],
  className,
  defaultOpen = false,
  onSaved,
}: OrgCardProps) {
  const [open, setOpen] = useState<boolean>(defaultOpen);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState<string>(user.title || '');
  const [department, setDepartment] = useState<string>(user.department || '');
  const [managerId, setManagerId] = useState<string>(user.reportsTo ?? '');

  // Build managers list excluding self, and ensure unique-sorted by username
  const managerOptions = useMemo(() => {
    const list = (managers || []).filter((m) => m.id !== user.id);
    return list.sort((a, b) => a.username.localeCompare(b.username));
  }, [managers, user.id]);

  const hasChanges = useMemo(() => {
    const currentManager = managerId || null;
    return (
      (user.title || '') !== (title || '') ||
      (user.department || '') !== (department || '') ||
      (user.reportsTo || null) !== currentManager
    );
  }, [user.title, user.department, user.reportsTo, title, department, managerId]);

  async function onSave() {
    try {
      setSaving(true);
      setError(null);
      const body: any = {};
      if ((user.title || '') !== (title || '')) body.title = title || '';
      if ((user.department || '') !== (department || '')) body.department = department || '';
      const nextReportsTo: string | null = managerId ? managerId : null;
      if ((user.reportsTo || null) !== nextReportsTo) body.reports_to = nextReportsTo;

      // If nothing changed, just close
      if (Object.keys(body).length === 0) {
        setOpen(false);
        return;
      }

      const res = await authFetch(`/api/org-chart/user/${encodeURIComponent(user.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(`Failed to save (${res.status})`);
      }
      const json = await res.json();
      const updated = normalizeUser(json?.user ?? json);

      // Update local fields to reflect saved state
      setTitle(updated.title || '');
      setDepartment(updated.department || '');
      setManagerId(updated.reportsTo ?? '');

      onSaved?.(updated);
      setOpen(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function onCancel() {
    setTitle(user.title || '');
    setDepartment(user.department || '');
    setManagerId(user.reportsTo ?? '');
    setError(null);
    setOpen(false);
  }

  return (
    <div className={classNames('rounded-md border border-gray-200 bg-white shadow-sm', className)}>
      {/* Header */}
      <div className="p-4 flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 flex items-center justify-center rounded-full bg-blue-50 text-blue-700 text-sm font-medium">
            {user.username?.charAt(0)?.toUpperCase?.() || '?'}
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">{user.username}</div>
            <div className="text-xs text-gray-500">{user.email}</div>
            <div className="mt-1 text-xs text-gray-600">
              <span className="font-medium">Title:</span> {user.title || '—'}
              <span className="mx-2 text-gray-300">•</span>
              <span className="font-medium">Department:</span> {user.department || '—'}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          aria-expanded={open}
        >
          {open ? 'Close' : 'Edit'}
          <svg className={classNames('h-4 w-4 transition-transform', open && 'rotate-180')} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.21l3.71-3.98a.75.75 0 111.08 1.04l-4.25 4.56a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Edit form */}
      {open && (
        <div className="border-t border-gray-100 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-xs font-medium text-gray-700">Title</span>
              <input
                type="text"
                className="mt-1 block w-full rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Engineering Manager"
              />
            </label>

            <label className="block">
              <span className="block text-xs font-medium text-gray-700">Department</span>
              {Array.isArray(departments) && departments.length > 0 ? (
                <select
                  className="mt-1 block w-full rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                >
                  {/* Allow free text by including current value if not present */}
                  {!departments.includes(department || '') && department ? (
                    <option value={department}>{department}</option>
                  ) : null}
                  <option value="">—</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className="mt-1 block w-full rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g., Engineering"
                />
              )}
            </label>

            <label className="block sm:col-span-2">
              <span className="block text-xs font-medium text-gray-700">Manager</span>
              {Array.isArray(managerOptions) && managerOptions.length > 0 ? (
                <select
                  className="mt-1 block w-full rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                >
                  <option value="">None</option>
                  {managerOptions.map((m) => (
                    <option key={m.id} value={m.id}>{m.username}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className="mt-1 block w-full rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                  placeholder="Manager user ID (UUID) or leave blank for none"
                />
              )}
              <p className="mt-1 text-[11px] text-gray-500">Leave blank for no manager. You cannot set the manager to the user themself.</p>
            </label>
          </div>

          {error && (
            <div className="mt-3 text-sm text-red-600">{error}</div>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center rounded-md px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              className={classNames(
                'inline-flex items-center rounded-md px-3 py-1.5 text-sm text-white',
                saving || !hasChanges ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              )}
              disabled={saving || !hasChanges}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

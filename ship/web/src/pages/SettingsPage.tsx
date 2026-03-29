import React, { useEffect, useMemo, useState } from 'react';
import { authFetch } from '../context/AuthContext';

// === SHARED CONTRACT (Front-end local copy) ===
const THEME_VALUES = ['light', 'dark', 'system'] as const;
const EMAIL_DIGEST_VALUES = ['none', 'daily', 'weekly'] as const;
const DEFAULT_VIEW_VALUES = ['list', 'kanban', 'calendar'] as const;
const TIMEZONE_VALUES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Asia/Tokyo',
] as const;

type Theme = typeof THEME_VALUES[number];
type EmailDigest = typeof EMAIL_DIGEST_VALUES[number];
type DefaultView = typeof DEFAULT_VIEW_VALUES[number];
type Timezone = typeof TIMEZONE_VALUES[number];

interface UserSettings {
  id: string;
  userId: string;
  theme: Theme;
  notificationsEnabled: boolean;
  emailDigest: EmailDigest;
  defaultView: DefaultView;
  timezone: Timezone;
  updatedAt: string;
}

interface GetUserSettingsResponse {
  settings: UserSettings;
}

interface UpdateUserSettingsRequest {
  theme?: Theme;
  notificationsEnabled?: boolean;
  emailDigest?: EmailDigest;
  defaultView?: DefaultView;
  timezone?: Timezone;
}

interface UpdateUserSettingsResponse {
  settings: UserSettings;
}

function classNames(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [form, setForm] = useState<UpdateUserSettingsRequest>({});
  const [initial, setInitial] = useState<UserSettings | null>(null);

  // Fetch on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await authFetch('/api/settings');
        if (!res.ok) throw new Error(`Failed to load settings (${res.status})`);
        const data = (await res.json()) as GetUserSettingsResponse | UserSettings; // support either shape
        const settings: UserSettings = (data as any).settings ?? (data as any);
        if (!isMounted) return;
        setInitial(settings);
        setForm({
          theme: settings.theme,
          notificationsEnabled: settings.notificationsEnabled,
          emailDigest: settings.emailDigest,
          defaultView: settings.defaultView,
          timezone: settings.timezone,
        });
        setError(null);
      } catch (e: any) {
        if (!isMounted) return;
        setError(e?.message || 'Failed to load user settings');
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const canSubmit = useMemo(() => {
    if (!initial) return false;
    // Enable submit if any field changed
    return (
      form.theme !== initial.theme ||
      form.notificationsEnabled !== initial.notificationsEnabled ||
      form.emailDigest !== initial.emailDigest ||
      form.defaultView !== initial.defaultView ||
      form.timezone !== initial.timezone
    );
  }, [form, initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`Failed to save settings (${res.status})`);
      const data = (await res.json()) as UpdateUserSettingsResponse | UserSettings;
      const settings: UserSettings = (data as any).settings ?? (data as any);
      setInitial(settings);
      setForm({
        theme: settings.theme,
        notificationsEnabled: settings.notificationsEnabled,
        emailDigest: settings.emailDigest,
        defaultView: settings.defaultView,
        timezone: settings.timezone,
      });
      setToast('Settings saved successfully');
      setTimeout(() => setToast(null), 3000);
    } catch (e: any) {
      setError(e?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof UpdateUserSettingsRequest>(key: K, value: UpdateUserSettingsRequest[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse h-6 w-40 bg-gray-200 rounded" />
        <div className="mt-4 space-y-3">
          <div className="h-4 bg-gray-100 rounded" />
          <div className="h-4 bg-gray-100 rounded w-5/6" />
          <div className="h-4 bg-gray-100 rounded w-2/3" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative p-6 max-w-3xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-green-600 text-white px-4 py-2 rounded shadow">
            {toast}
          </div>
        </div>
      )}

      <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
      {error && (
        <div className="mt-4 rounded border border-red-200 bg-red-50 text-red-800 p-3">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-8">
        {/* Appearance */}
        <section>
          <h2 className="text-lg font-medium text-gray-900">Appearance</h2>
          <p className="text-sm text-gray-500 mb-4">Choose how Shipyard looks.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {THEME_VALUES.map((t) => (
              <label
                key={t}
                className={classNames(
                  'cursor-pointer rounded border p-4 flex items-center justify-between',
                  form.theme === t ? 'border-blue-600 ring-2 ring-blue-200' : 'border-gray-200'
                )}
              >
                <div>
                  <div className="font-medium capitalize">{t}</div>
                  <div className="text-xs text-gray-500">
                    {t === 'system' ? 'Match your OS preference' : t === 'dark' ? 'Dimmed interface' : 'Bright interface'}
                  </div>
                </div>
                <input
                  type="radio"
                  name="theme"
                  className="h-4 w-4 text-blue-600"
                  checked={form.theme === t}
                  onChange={() => update('theme', t)}
                />
              </label>
            ))}
          </div>
        </section>

        {/* Notifications */}
        <section>
          <h2 className="text-lg font-medium text-gray-900">Notifications</h2>
          <p className="text-sm text-gray-500 mb-4">Control when we notify you.</p>
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                className="h-4 w-4 text-blue-600"
                checked={!!form.notificationsEnabled}
                onChange={(e) => update('notificationsEnabled', e.target.checked)}
              />
              <span className="text-sm text-gray-800">Enable notifications</span>
            </label>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email digest</label>
              <select
                className="block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                value={form.emailDigest || 'none'}
                onChange={(e) => update('emailDigest', e.target.value as EmailDigest)}
                disabled={!form.notificationsEnabled}
              >
                {EMAIL_DIGEST_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </option>
                ))}
              </select>
              {!form.notificationsEnabled && (
                <p className="mt-1 text-xs text-gray-500">Enable notifications to receive email digests.</p>
              )}
            </div>
          </div>
        </section>

        {/* Display */}
        <section>
          <h2 className="text-lg font-medium text-gray-900">Display</h2>
          <p className="text-sm text-gray-500 mb-4">Pick your default view.</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default view</label>
            <select
              className="block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={form.defaultView || 'list'}
              onChange={(e) => update('defaultView', e.target.value as DefaultView)}
            >
              {DEFAULT_VIEW_VALUES.map((v) => (
                <option key={v} value={v}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Regional */}
        <section>
          <h2 className="text-lg font-medium text-gray-900">Regional</h2>
          <p className="text-sm text-gray-500 mb-4">Set your local preferences.</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
            <select
              className="block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={form.timezone || 'UTC'}
              onChange={(e) => update('timezone', e.target.value as Timezone)}
            >
              {TIMEZONE_VALUES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </section>

        <div className="pt-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit || saving}
            className={classNames(
              'inline-flex items-center px-4 py-2 rounded text-white shadow',
              canSubmit && !saving ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed'
            )}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {initial && !canSubmit && (
            <span className="text-sm text-gray-500">No changes</span>
          )}
        </div>
      </form>
    </div>
  );
}

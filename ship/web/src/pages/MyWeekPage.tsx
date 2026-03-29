import React, { useEffect, useMemo, useState } from 'react';
import { getMyWeek, getWeeks, type MyWeekResponse } from '../api/client';

interface WeekOption {
  id: string;
  title: string;
}

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function StatusPill({ label, tone = 'gray' }: { label: string; tone?: 'gray' | 'green' | 'blue' | 'yellow' | 'red' }) {
  const map: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-800',
    green: 'bg-green-100 text-green-800',
    blue: 'bg-blue-100 text-blue-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    red: 'bg-red-100 text-red-800',
  };
  return (
    <span className={classNames('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', map[tone])}>
      {label}
    </span>
  );
}

export default function MyWeekPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MyWeekResponse | null>(null);
  const [weeks, setWeeks] = useState<WeekOption[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string>('');

  const loadWeeks = async () => {
    try {
      const list = await getWeeks();
      setWeeks(list || []);
    } catch (e) {
      // ignore week list failure to not block page
    }
  };

  const loadMyWeek = async (weekId?: string) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await getMyWeek(weekId);
      setData(resp);
    } catch (e: any) {
      setError(e?.message || 'Failed to load My Week');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // initial load
    loadWeeks();
    loadMyWeek();
  }, []);

  const onSelectWeek = (id: string) => {
    setSelectedWeekId(id);
    loadMyWeek(id || undefined);
  };

  // Derive status indicators
  const standupStatus = useMemo(() => {
    if (!data?.standup) return { label: 'Missing', tone: 'red' as const };
    return { label: 'Completed', tone: 'green' as const };
  }, [data]);

  const planStatus = useMemo(() => {
    const status = data?.plan?.status as string | undefined;
    if (!data?.plan) return { label: 'Missing', tone: 'red' as const };
    switch ((status || '').toLowerCase()) {
      case 'draft':
        return { label: 'Draft', tone: 'gray' as const };
      case 'submitted':
        return { label: 'Submitted', tone: 'blue' as const };
      case 'approved':
        return { label: 'Approved', tone: 'green' as const };
      default:
        return { label: status || 'Available', tone: 'yellow' as const };
    }
  }, [data]);

  const retroStatus = useMemo(() => {
    if (!data?.retro) return { label: 'Missing', tone: 'red' as const };
    const anyRetro: any = data.retro as any;
    const status = (anyRetro.status as string | undefined) || '';
    switch (status.toLowerCase()) {
      case 'draft':
        return { label: 'Draft', tone: 'gray' as const };
      case 'submitted':
        return { label: 'Submitted', tone: 'blue' as const };
      case 'approved':
        return { label: 'Approved', tone: 'green' as const };
      default:
        return { label: status || 'Available', tone: 'yellow' as const };
    }
  }, [data]);

  if (loading) return <main className="p-8"><p className="text-gray-500">Loading...</p></main>;

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Week</h1>
          <p className="text-gray-500">
            {data?.week?.start_date ? `Week starting ${new Date(data.week.start_date).toLocaleDateString()}` : 'Select a week'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2">
            <div className="flex items-center gap-1"><span className="text-sm text-gray-600">Standup</span><StatusPill label={standupStatus.label} tone={standupStatus.tone} /></div>
            <div className="flex items-center gap-1"><span className="text-sm text-gray-600">Plan</span><StatusPill label={planStatus.label} tone={planStatus.tone} /></div>
            <div className="flex items-center gap-1"><span className="text-sm text-gray-600">Retro</span><StatusPill label={retroStatus.label} tone={retroStatus.tone} /></div>
          </div>
          <div>
            <label className="sr-only" htmlFor="weekId">Select week</label>
            <select
              id="weekId"
              value={selectedWeekId}
              onChange={(e) => onSelectWeek(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Current week</option>
              {weeks.map((w) => (
                <option key={w.id} value={w.id}>{w.title}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Standup */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Standup</h2>
            <StatusPill label={standupStatus.label} tone={standupStatus.tone} />
          </div>
          {!data?.standup ? (
            <p className="text-sm text-gray-500">No standup submitted yet.</p>
          ) : (
            <div className="space-y-3">
              <div className="text-sm text-gray-600">Date: {new Date(data.standup.standup_date).toLocaleDateString()}</div>
              {'yesterday' in (data.standup as any) && (
                <div>
                  <h4 className="text-xs font-medium text-gray-700 uppercase mb-1">Yesterday</h4>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{(data.standup as any).yesterday || '—'}</p>
                </div>
              )}
              {'today' in (data.standup as any) && (
                <div>
                  <h4 className="text-xs font-medium text-gray-700 uppercase mb-1">Today</h4>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{(data.standup as any).today || '—'}</p>
                </div>
              )}
              {'blockers' in (data.standup as any) && (
                <div>
                  <h4 className="text-xs font-medium text-gray-700 uppercase mb-1">Blockers</h4>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{(data.standup as any).blockers || '—'}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Weekly Plan */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Weekly Plan</h2>
            <StatusPill label={planStatus.label} tone={planStatus.tone} />
          </div>
          {!data?.plan ? (
            <p className="text-sm text-gray-500">No weekly plan yet.</p>
          ) : (
            <div className="space-y-3">
              <div className="text-sm text-gray-600">Status: <span className="font-medium text-gray-800">{data.plan.status || '—'}</span></div>
              <div>
                <h4 className="text-xs font-medium text-gray-700 uppercase mb-1">Plan</h4>
                <div className="prose prose-sm max-w-none">
                  <div className="text-sm text-gray-800 whitespace-pre-wrap">
                    {data.plan.plan_content || '—'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Weekly Retro */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Weekly Retro</h2>
            <StatusPill label={retroStatus.label} tone={retroStatus.tone} />
          </div>
          {!data?.retro ? (
            <p className="text-sm text-gray-500">No weekly retro yet.</p>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-gray-600">{(data.retro as any).status ? `Status: ${(data.retro as any).status}` : ''}</div>
              <div>
                <h4 className="text-xs font-medium text-green-700 uppercase mb-1">Went Well</h4>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{data.retro.went_well || '—'}</p>
              </div>
              <div>
                <h4 className="text-xs font-medium text-yellow-700 uppercase mb-1">To Improve</h4>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{data.retro.to_improve || '—'}</p>
              </div>
              <div>
                <h4 className="text-xs font-medium text-blue-700 uppercase mb-1">Action Items</h4>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{data.retro.action_items || '—'}</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

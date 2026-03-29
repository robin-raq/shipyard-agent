import { useEffect, useMemo, useState } from 'react';
import {
  fetchIterations,
  createIteration,
  activateIteration,
  completeIteration,
  type Iteration,
  type CreateIterationRequest,
  ITERATION_STATUSES,
} from '../api/client';
import { getTeams } from '../api/client';

interface Team {
  id: string;
  name: string;
}

function StatusBadge({ status }: { status: Iteration['status'] }) {
  const styles =
    status === 'active'
      ? 'bg-green-100 text-green-800'
      : status === 'completed'
      ? 'bg-gray-200 text-gray-800'
      : 'bg-yellow-100 text-yellow-800';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${styles}`}>
      {status}
    </span>
  );
}

function IterationCard({
  iteration,
  teamName,
  onActivate,
  onComplete,
}: {
  iteration: Iteration;
  teamName?: string;
  onActivate: (id: string) => void | Promise<void>;
  onComplete: (id: string) => void | Promise<void>;
}) {
  const isActive = iteration.status === 'active';
  return (
    <div
      className={`p-6 bg-white rounded-lg shadow-sm border ${
        isActive ? 'border-2 border-green-500' : 'border-gray-200'
      }`}
      role="article"
      aria-label={`Iteration ${iteration.name}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-900 mb-1">{iteration.name}</h3>
          <div className="text-sm text-gray-700">
            {new Date(iteration.startDate).toLocaleDateString()} –{' '}
            {new Date(iteration.endDate).toLocaleDateString()}
          </div>
          <div className="mt-2 text-sm text-gray-600 line-clamp-2">
            {iteration.goal || 'No goal set'}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <StatusBadge status={iteration.status} />
            {teamName && (
              <span className="text-xs text-gray-600">• Team: {teamName}</span>
            )}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {iteration.status !== 'active' && (
            <button
              onClick={() => onActivate(iteration.id)}
              className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              Activate
            </button>
          )}
          {iteration.status === 'active' && (
            <button
              onClick={() => onComplete(iteration.id)}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Complete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function NewIterationForm({
  onSubmit,
  teams,
}: {
  onSubmit: (data: CreateIterationRequest) => void | Promise<void>;
  teams: Team[];
}) {
  const [name, setName] = useState('');
  const [teamId, setTeamId] = useState(teams[0]?.id || '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [goal, setGoal] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!teamId && teams.length > 0) setTeamId(teams[0].id);
  }, [teams, teamId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !teamId || !startDate || !endDate) return;
    try {
      setSubmitting(true);
      await onSubmit({ name, teamId, startDate, endDate, goal });
      setName('');
      setGoal('');
      setStartDate('');
      setEndDate('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end" role="form" aria-label="New iteration form">
      <div>
        <label htmlFor="iter-name" className="block text-sm font-medium text-gray-700 mb-1">
          Name
        </label>
        <input
          id="iter-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Sprint 25"
        />
      </div>
      <div>
        <label htmlFor="iter-team" className="block text-sm font-medium text-gray-700 mb-1">
          Team
        </label>
        <select
          id="iter-team"
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="iter-start" className="block text-sm font-medium text-gray-700 mb-1">
          Start Date
        </label>
        <input
          id="iter-start"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label htmlFor="iter-end" className="block text-sm font-medium text-gray-700 mb-1">
          End Date
        </label>
        <input
          id="iter-end"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="md:col-span-5">
        <label htmlFor="iter-goal" className="block text-sm font-medium text-gray-700 mb-1">
          Goal (optional)
        </label>
        <textarea
          id="iter-goal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          placeholder="What is the goal of this iteration?"
        />
      </div>
      <div className="md:col-span-5 flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {submitting ? 'Creating...' : '+ Create Iteration'}
        </button>
      </div>
    </form>
  );
}

export default function IterationsPage() {
  const [iterations, setIterations] = useState<Iteration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  const teamMap = useMemo(() => {
    const m = new Map<string, string>();
    teams.forEach((t) => m.set(t.id, t.name));
    return m;
  }, [teams]);

  const refresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const [iterRes, teamsRes] = await Promise.all([
        fetchIterations(),
        getTeams(),
      ]);
      setIterations(iterRes.iterations ?? []);
      setTeams(Array.isArray(teamsRes) ? teamsRes.map((t: any) => ({ id: t.id, name: t.name })) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load iterations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleCreate = async (data: CreateIterationRequest) => {
    try {
      await createIteration(data);
      setShowCreate(false);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create iteration');
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await activateIteration(id);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to activate iteration');
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await completeIteration(id);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to complete iteration');
    }
  };

  if (loading) {
    return (
      <main className="p-8">
        <div className="text-gray-700" role="status" aria-live="polite">
          Loading...
        </div>
      </main>
    );
  }

  return (
    <main className="p-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Iterations</h1>
        <button
          onClick={() => setShowCreate((s) => !s)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label={showCreate ? 'Hide new iteration form' : 'Show new iteration form'}
        >
          {showCreate ? 'Cancel' : '+ New Iteration'}
        </button>
      </header>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg" role="alert">
          {error}
        </div>
      )}

      {showCreate && (
        <section className="mb-6 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Create New Iteration</h2>
          <NewIterationForm onSubmit={handleCreate} teams={teams} />
        </section>
      )}

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {iterations.length === 0 ? (
          <div className="col-span-full p-8 text-center text-gray-700 bg-white border border-gray-200 rounded-lg">
            No iterations found. Create one to get started!
          </div>
        ) : (
          iterations.map((it) => (
            <IterationCard
              key={it.id}
              iteration={it}
              teamName={teamMap.get(it.teamId)}
              onActivate={handleActivate}
              onComplete={handleComplete}
            />
          ))
        )}
      </section>
    </main>
  );
}

import { useState, useEffect } from 'react';
import { getStandups, getStandupStatus, createStandup, updateStandup } from '../api/client';
import StandupForm from '../components/StandupForm';
import StandupFeed from '../components/StandupFeed';
import type { StandupEntry } from '../components/StandupFeed';

function formatDateParam(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function isToday(date: Date): boolean {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

export default function StandupsPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [standups, setStandups] = useState<StandupEntry[]>([]);
  const [myStandup, setMyStandup] = useState<any>(null);
  const [isDue, setIsDue] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const dateStr = formatDateParam(selectedDate);
      const data = await getStandups({ date: dateStr });
      setStandups(data);

      if (isToday(selectedDate)) {
        const status = await getStandupStatus();
        setIsDue(status.due);
        setMyStandup(status.standup || null);
      } else {
        setIsDue(false);
        setMyStandup(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load standups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const handleSubmit = async (data: { yesterday: string; today: string; blockers: string }) => {
    await createStandup(data);
    await fetchData();
  };

  const handleUpdate = async (data: { yesterday: string; today: string; blockers: string }) => {
    if (myStandup) {
      await updateStandup(myStandup.id, data);
      setEditing(false);
      await fetchData();
    }
  };

  const prevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  };

  const nextDay = () => {
    if (!isToday(selectedDate)) {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + 1);
      setSelectedDate(d);
    }
  };

  const goToToday = () => setSelectedDate(new Date());

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-6">Standups</h1>

      {/* Date Navigation */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={prevDay}
          className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
        >
          ← Prev
        </button>
        <h2 className="text-lg font-semibold">{formatDisplayDate(selectedDate)}</h2>
        <button
          onClick={nextDay}
          disabled={isToday(selectedDate)}
          className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Next →
        </button>
        {!isToday(selectedDate) && (
          <button onClick={goToToday} className="text-sm text-blue-600 hover:underline">
            Today
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-gray-500 text-center py-12">Loading standups...</div>
      ) : (
        <>
          {/* Today's standup form/status */}
          {isToday(selectedDate) && (
            <div className="mb-8">
              {isDue && !myStandup ? (
                <>
                  <h3 className="text-lg font-medium mb-3">Submit your standup</h3>
                  <StandupForm onSubmit={handleSubmit} />
                </>
              ) : myStandup && !editing ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-green-700 font-medium">✓ You've submitted your standup today</span>
                    <button
                      onClick={() => setEditing(true)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="text-sm text-gray-700 space-y-2">
                    <div><span className="font-medium">Yesterday:</span> {myStandup.yesterday}</div>
                    <div><span className="font-medium">Today:</span> {myStandup.today}</div>
                    <div><span className="font-medium">Blockers:</span> {myStandup.blockers || 'None'}</div>
                  </div>
                </div>
              ) : myStandup && editing ? (
                <>
                  <h3 className="text-lg font-medium mb-3">Edit your standup</h3>
                  <StandupForm
                    standupId={myStandup.id}
                    initialValues={{
                      yesterday: myStandup.yesterday,
                      today: myStandup.today,
                      blockers: myStandup.blockers,
                    }}
                    onSubmit={handleUpdate}
                    onCancel={() => setEditing(false)}
                  />
                </>
              ) : null}
            </div>
          )}

          {/* Team standup feed */}
          <div>
            <h3 className="text-lg font-medium mb-3">Team Standups</h3>
            <StandupFeed standups={standups} />
          </div>
        </>
      )}
    </main>
  );
}

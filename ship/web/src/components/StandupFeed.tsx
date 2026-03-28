import React from 'react';

export interface StandupEntry {
  id: string;
  username: string;
  yesterday: string;
  today: string;
  blockers: string;
  standup_date: string;
  created_at: string;
}

interface StandupFeedProps {
  standups: StandupEntry[];
}

const StandupFeed: React.FC<StandupFeedProps> = ({ standups }) => {
  if (standups.length === 0) {
    return (
      <p className="text-gray-500 text-center py-8">
        No standups submitted for this date.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {standups.map((standup) => (
        <div key={standup.id} className="bg-white rounded-lg shadow-sm border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-900">{standup.username}</span>
            <span className="text-xs text-gray-400">
              {new Date(standup.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Yesterday</h4>
            <p className="text-sm text-gray-700">{standup.yesterday || '—'}</p>
          </div>

          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Today</h4>
            <p className="text-sm text-gray-700">{standup.today || '—'}</p>
          </div>

          {standup.blockers && standup.blockers.toLowerCase() !== 'none' && standup.blockers.trim() !== '' && (
            <div className="bg-red-50 rounded-md p-2">
              <h4 className="text-xs font-medium text-red-600 uppercase tracking-wider mb-1">Blockers</h4>
              <p className="text-sm text-red-700">{standup.blockers}</p>
            </div>
          )}
          {(!standup.blockers || standup.blockers.toLowerCase() === 'none' || standup.blockers.trim() === '') && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Blockers</h4>
              <p className="text-sm text-gray-400">None</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default StandupFeed;

import React, { useState } from 'react';

interface StandupFormProps {
  onSubmit: (data: { yesterday: string; today: string; blockers: string }) => Promise<void>;
  onCancel?: () => void;
  standupId?: string;
  initialValues?: {
    yesterday?: string;
    today?: string;
    blockers?: string;
  };
}

const StandupForm: React.FC<StandupFormProps> = ({ onSubmit, onCancel, standupId, initialValues }) => {
  const [yesterday, setYesterday] = useState(initialValues?.yesterday || '');
  const [today, setToday] = useState(initialValues?.today || '');
  const [blockers, setBlockers] = useState(initialValues?.blockers || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ yesterday, today, blockers });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit standup');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-lg shadow-sm border p-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          What did you do yesterday?
        </label>
        <textarea
          value={yesterday}
          onChange={(e) => setYesterday(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
          placeholder="Describe what you accomplished..."
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          What are you doing today?
        </label>
        <textarea
          value={today}
          onChange={(e) => setToday(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
          placeholder="Describe your plans for today..."
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Any blockers?
        </label>
        <textarea
          value={blockers}
          onChange={(e) => setBlockers(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
          placeholder="Anything blocking your progress? (or 'None')"
        />
      </div>
      <div className="flex justify-end space-x-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {submitting ? 'Submitting...' : standupId ? 'Update Standup' : 'Submit Standup'}
        </button>
      </div>
    </form>
  );
};

export default StandupForm;

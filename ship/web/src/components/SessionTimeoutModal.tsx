import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const SESSION_CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
const WARNING_THRESHOLD = 10 * 60 * 1000; // Warn 10 minutes before expiry

export default function SessionTimeoutModal() {
  const [showWarning, setShowWarning] = useState(false);
  const [minutesLeft, setMinutesLeft] = useState(0);
  const { user, logout } = useAuth();

  useEffect(() => {
    if (!user) return;

    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'x-session-token': localStorage.getItem('session_token') || '' },
        });

        if (!res.ok) {
          // Session expired
          setShowWarning(false);
          logout();
          return;
        }

        const data = await res.json();
        if (data.expiresAt) {
          const expiresAt = new Date(data.expiresAt).getTime();
          const remaining = expiresAt - Date.now();

          if (remaining < WARNING_THRESHOLD && remaining > 0) {
            setMinutesLeft(Math.ceil(remaining / 60000));
            setShowWarning(true);
          } else {
            setShowWarning(false);
          }
        }
      } catch {
        // Network error — don't show warning
      }
    };

    const interval = setInterval(checkSession, SESSION_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [user, logout]);

  const handleRefresh = async () => {
    // Re-authenticate to extend session
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'x-session-token': localStorage.getItem('session_token') || '' },
      });
      if (res.ok) {
        setShowWarning(false);
      }
    } catch {
      // Failed to refresh
    }
  };

  if (!showWarning) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-yellow-50 border border-yellow-200 rounded-lg shadow-lg p-4 max-w-sm">
      <h3 className="font-semibold text-yellow-800 mb-1">Session Expiring</h3>
      <p className="text-sm text-yellow-700 mb-3">
        Your session will expire in {minutesLeft} minute{minutesLeft !== 1 ? 's' : ''}.
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleRefresh}
          className="px-3 py-1.5 bg-yellow-600 text-white rounded-lg text-sm hover:bg-yellow-700"
        >
          Stay Signed In
        </button>
        <button
          onClick={() => setShowWarning(false)}
          className="px-3 py-1.5 text-yellow-700 text-sm hover:underline"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

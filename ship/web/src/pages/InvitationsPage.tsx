import { useEffect, useMemo, useState } from 'react';
import {
  getInvitations,
  createInvitation,
  revokeInvitation,
  INVITATION_ROLES,
} from '../api/client';
import type { Invitation } from '../api/client';

export default function InvitationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<typeof INVITATION_ROLES[number]>('member');
  const [submitting, setSubmitting] = useState(false);

  const fetchInvitations = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getInvitations();
      setInvitations(data.invitations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invitations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, []);

  const pendingCount = useMemo(
    () => invitations.filter((i) => i.status === 'pending').length,
    [invitations]
  );

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    try {
      setSubmitting(true);
      setError(null);
      await createInvitation({ email, role });
      setEmail('');
      setRole('member');
      await fetchInvitations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this invitation?')) return;
    try {
      await revokeInvitation(id);
      await fetchInvitations();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to revoke invitation');
    }
  };

  return (
    <main className="p-8">
      <header className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-3xl font-bold text-gray-900">Invitations</h1>
        <div className="text-gray-700">Pending: {pendingCount}</div>
      </header>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg" role="alert">
          {error}
        </div>
      )}

      {/* Invite form */}
      <section className="mb-6 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Invite a user</h2>
        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="w-full sm:w-1/2">
            <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label htmlFor="invite-role" className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as typeof INVITATION_ROLES[number])}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {INVITATION_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {submitting ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
        </form>
      </section>

      {/* List */}
      <section className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-gray-700" role="status" aria-live="polite">
            Loading...
          </div>
        ) : invitations.length === 0 ? (
          <div className="p-8 text-center text-gray-700">No invitations yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" role="table" aria-label="Invitations list">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Expires</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{inv.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{inv.role}</td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          inv.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : inv.status === 'accepted'
                            ? 'bg-green-100 text-green-800'
                            : inv.status === 'revoked'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {inv.expiresAt ? new Date(String(inv.expiresAt)).toLocaleString() : '—'}
                    </td>
                    <td className="px-6 py-4 text-right text-sm">
                      {inv.status === 'pending' ? (
                        <button
                          onClick={() => handleRevoke(inv.id)}
                          className="text-red-700 hover:text-red-900 font-medium"
                          aria-label={`Revoke invitation for ${inv.email}`}
                        >
                          Revoke
                        </button>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

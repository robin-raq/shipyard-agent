import React, { useEffect, useMemo, useState } from 'react';
import { fetchApiTokens, generateApiToken, revokeApiToken } from '../api/client';

interface ApiTokenListItem {
  id: string;
  name: string;
  tokenPrefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export default function ApiTokensPage() {
  const [tokens, setTokens] = useState<ApiTokenListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate form state
  const [name, setName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Show plaintext token after generation (only once)
  const [generatedToken, setGeneratedToken] = useState<{ name: string; token: string } | null>(null);

  const refresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchApiTokens();
      setTokens(res.tokens || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load API tokens');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setSubmitting(true);
      setError(null);
      const req: { name: string; expiresInDays?: number } = { name: name.trim() };
      const days = parseInt(expiresInDays, 10);
      if (!Number.isNaN(days) && days > 0) req.expiresInDays = days;
      const res = await generateApiToken(req);
      setGeneratedToken({ name: res.name, token: res.token });
      setName('');
      setExpiresInDays('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate token');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this API token? This action cannot be undone.')) return;
    try {
      await revokeApiToken(id);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to revoke token');
    }
  };

  const activeTokens = useMemo(() => tokens.filter(t => !t.revokedAt), [tokens]);

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">API Tokens</h1>
        <p className="text-gray-600 mt-1">Create and manage personal API tokens for programmatic access. Keep tokens secret.</p>
      </header>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg" role="alert">
          {error}
        </div>
      )}

      {/* Generate token form */}
      <section className="mb-8 bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Generate New Token</h2>
        <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end" aria-label="Generate API token">
          <div className="md:col-span-3">
            <label htmlFor="token-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              id="token-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., CI deploy script"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="expires-days" className="block text-sm font-medium text-gray-700 mb-1">Expires In (days)</label>
            <input
              id="expires-days"
              type="number"
              min={1}
              inputMode="numeric"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
              placeholder="Optional"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            />
          </div>
          <div className="md:col-span-1">
            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex justify-center items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {submitting ? 'Generating…' : 'Generate Token'}
            </button>
          </div>
        </form>

        {generatedToken && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-yellow-900">Token created: {generatedToken.name}</p>
                <p className="text-sm text-yellow-800 mt-1">This token is shown only once. Copy and store it securely now.</p>
                <code className="block mt-2 p-2 bg-white border border-yellow-300 rounded text-yellow-900 break-all">{generatedToken.token}</code>
              </div>
              <div className="shrink-0">
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(generatedToken.token);
                      alert('Token copied to clipboard');
                    } catch {
                      alert('Failed to copy token');
                    }
                  }}
                  className="px-3 py-2 text-yellow-900 bg-yellow-100 hover:bg-yellow-200 rounded-lg text-sm font-medium"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* List tokens */}
      <section>
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Your Tokens</h2>
          {!loading && (
            <span className="text-sm text-gray-600">{activeTokens.length} active / {tokens.length} total</span>
          )}
        </header>

        {loading ? (
          <div className="text-gray-700" role="status" aria-live="polite">Loading tokens…</div>
        ) : tokens.length === 0 ? (
          <div className="p-6 bg-white border border-gray-200 rounded-lg text-gray-600">No tokens yet. Generate one above.</div>
        ) : (
          <ul className="space-y-3">
            {tokens.map((t) => (
              <li key={t.id} className="p-4 bg-white border border-gray-200 rounded-lg flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-gray-900 font-medium">{t.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-800">{t.tokenPrefix}••••</span>
                    {t.revokedAt ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-700">Revoked</span>
                    ) : t.expiresAt ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-50 text-yellow-800">Expires {new Date(t.expiresAt).toLocaleDateString()}</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-700">No expiry</span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-gray-600 space-x-2">
                    <span>Created {new Date(t.createdAt).toLocaleString()}</span>
                    {t.lastUsedAt && <span>• Last used {new Date(t.lastUsedAt).toLocaleString()}</span>}
                    {t.revokedAt && <span>• Revoked {new Date(t.revokedAt).toLocaleString()}</span>}
                  </div>
                </div>
                <div className="shrink-0">
                  {!t.revokedAt && (
                    <button
                      onClick={() => handleRevoke(t.id)}
                      className="px-3 py-2 text-sm font-medium text-red-700 hover:text-red-900 focus:outline-none focus:ring-2 focus:ring-red-500 rounded-lg"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

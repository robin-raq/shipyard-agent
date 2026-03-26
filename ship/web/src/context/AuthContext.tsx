import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  username: string;
  email: string;
  display_name?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

function getSessionToken(): string | null {
  return localStorage.getItem('ship_session');
}

function setSessionToken(token: string) {
  localStorage.setItem('ship_session', token);
}

function clearSessionToken() {
  localStorage.removeItem('ship_session');
}

/** Authenticated fetch — attaches session token header automatically */
export async function authFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const token = getSessionToken();
  const headers = new Headers(opts.headers);
  if (token) {
    headers.set('x-session-token', token);
  }
  return fetch(url, { ...opts, headers });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getSessionToken();
    if (!token) {
      setLoading(false);
      return;
    }
    authFetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUser(data?.user ?? null))
      .catch(() => {
        clearSessionToken();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Login failed' }));
      throw new Error(err.message || 'Login failed');
    }
    const data = await res.json();
    setSessionToken(data.session.session_id);
    setUser(data.user);
  };

  const logout = async () => {
    const token = getSessionToken();
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'x-session-token': token },
      }).catch(() => {});
    }
    clearSessionToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

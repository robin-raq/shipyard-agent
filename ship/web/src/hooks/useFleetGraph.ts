import { useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const FLEETGRAPH_URL = import.meta.env.VITE_FLEETGRAPH_URL || 'http://localhost:4000';

// FleetGraph contract types (frontend only)
type Severity = 'critical' | 'warning' | 'info' | 'clean';

type Target = 'local' | 'prod';

type EntityType = 'issue' | 'project' | 'program' | 'sprint' | 'document' | 'unknown';

interface Finding {
  id: string;
  category: string;
  severity: Exclude<Severity, 'clean'>;
  title: string;
  detail: string;
  entityIds: string[];
  recommendation?: string;
}

interface FleetResult {
  summary: string;
  severity: Severity;
  findings: Finding[];
  needsApproval: boolean;
  approvalId?: string;
  chatResponse?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  findings?: Finding[];
  severity?: Severity;
  timestamp: string;
}

export function useFleetGraph() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();
  const { user } = useAuth();

  // Parse entity from URL: /issues/abc123 → { entityType: "issue", entityId: "abc123" }
  const getContext = useCallback((): { pathname: string; entityType: EntityType; entityId?: string } => {
    const parts = location.pathname.split('/').filter(Boolean);
    const typeMap: Record<string, EntityType> = {
      issues: 'issue',
      projects: 'project',
      programs: 'program',
      docs: 'document',
      weeks: 'sprint',
    };
    const entityType: EntityType = typeMap[parts[0]] || 'unknown';
    const entityId = parts[1] || undefined;
    return { pathname: location.pathname, entityType, entityId };
  }, [location.pathname]);

  const sendMessage = useCallback(async (text: string) => {
    // Add user message
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: text, timestamp: new Date().toISOString() },
    ]);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${FLEETGRAPH_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'prod' as Target, message: text, context: getContext() }),
      });
      if (!res.ok) throw new Error(`FleetGraph error: ${res.status}`);
      const result: FleetResult = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: result.chatResponse || result.summary,
          findings: result.findings,
          severity: result.severity,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to reach FleetGraph');
    } finally {
      setLoading(false);
    }
  }, [getContext]);

  return { messages, loading, error, sendMessage } as const;
}

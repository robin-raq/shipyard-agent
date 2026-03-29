const FLEETGRAPH_URL = import.meta.env.VITE_FLEETGRAPH_URL || 'http://localhost:4000';

// Shared contract types
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type Severity = 'critical' | 'warning' | 'info' | 'clean';
export type EntityType = 'issue' | 'project' | 'program' | 'sprint' | 'document' | 'unknown';

export interface Finding {
  id: string;
  category: string;
  severity: Exclude<Severity, 'clean'>;
  title: string;
  detail: string;
  entityIds: string[];
  recommendation?: string;
}

export interface ApprovalRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  target: 'local' | 'prod';
  findings: Finding[];
  status: ApprovalStatus;
}

async function handleResponse(res: Response) {
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data && data.message) errMsg = data.message;
    } catch {}
    throw new Error(errMsg);
  }
  return res.json();
}

export async function getFleetGraphApprovals(status?: ApprovalStatus): Promise<{ approvals: ApprovalRecord[] }> {
  const url = new URL(`${FLEETGRAPH_URL}/api/approvals`);
  if (status) url.searchParams.set('status', status);
  const res = await fetch(url.toString());
  return handleResponse(res);
}

export async function updateFleetGraphApproval(
  id: string,
  decision: 'approved' | 'rejected'
): Promise<ApprovalRecord> {
  const res = await fetch(`${FLEETGRAPH_URL}/api/approvals/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision }),
  });
  return handleResponse(res);
}

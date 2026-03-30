"""Batch runner 3 — FleetGraph integration + remaining Ship feature gaps.

13 tasks in 3 dependency-ordered batches:
  Batch 1 (tasks 1-4):  Backend infrastructure
  Batch 2 (tasks 5-8):  Features with migrations
  Batch 3 (tasks 9-13): FleetGraph frontend + API compat

Usage:
    python run_batch_3.py                # run all tasks
    python run_batch_3.py --task 1       # run specific task
    python run_batch_3.py --dry-run      # print prompts only
"""

import argparse
import json
import signal
import time
from pathlib import Path

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage

load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env", override=True)

from shipyard.supervisor import build_supervisor_graph
from shipyard.tools import set_workspace
from shipyard.tracing import TraceCollector

TDD_PREAMBLE = """\
IMPORTANT — Follow strict TDD and MATCH EXISTING PATTERNS exactly.

## Step 1: Understand the codebase BEFORE writing any code
- Use scan_workspace to see the directory tree.
- Use search_files to find existing files and conventions.
- Read at least ONE existing file in the same directory to copy its exact structure.

## Step 2: Implement matching existing patterns
- Backend routes: use factory function pattern (export function createXRouter(pool))
- Register route in ship/api/src/app.ts with import + app.use line
- Frontend pages: add route in ship/web/src/App.tsx + nav in ship/web/src/components/Layout.tsx
- Use `const id = req.params.id as string;` for route params (NOT destructuring)
- Use `const val = req.query.field as string | undefined;` for query params

## Step 3: Verify
- Backend: run_command("npx tsc --noEmit") from ship/api/
- Frontend: run_command("npx tsc --noEmit") from ship/web/

"""

# FleetGraph type definitions embedded for agent context
FLEETGRAPH_TYPES = """
## FleetGraph API Contract (external service — DO NOT create these types in Ship backend)

FleetGraph runs as a SEPARATE server. Ship's frontend calls it directly.

### FleetGraph API Endpoints:
- POST {FLEETGRAPH_URL}/api/chat — on-demand query
  Request: { target: "prod", message: string, context?: { pathname?: string, entityType?: "issue"|"project"|"program"|"sprint"|"document"|"unknown", entityId?: string } }
  Response: FleetResult (see below)

- GET {FLEETGRAPH_URL}/api/approvals?status=pending — list approvals
  Response: { approvals: ApprovalRecord[] }

- POST {FLEETGRAPH_URL}/api/approvals/:id — approve/reject
  Request: { decision: "approved" | "rejected" }
  Response: ApprovalRecord

- GET {FLEETGRAPH_URL}/health — health check
  Response: { status: "ok", service: "fleetgraph" }

### FleetGraph Response Types (for Ship frontend to consume):
```typescript
type Severity = "critical" | "warning" | "info" | "clean";

interface Finding {
  id: string;
  category: string;
  severity: Exclude<Severity, "clean">;
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

interface ApprovalRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  target: "local" | "prod";
  findings: Finding[];
  status: "pending" | "approved" | "rejected";
}
```

### Environment variable:
Ship frontend reads VITE_FLEETGRAPH_URL (default: "http://localhost:4000")
Use: const FLEETGRAPH_URL = import.meta.env.VITE_FLEETGRAPH_URL || "http://localhost:4000";

### FleetGraph expects these Ship API endpoints:
- GET /api/issues?limit=500 — returns array of issues with: id, title, status (as "state"), priority, assignee_name, updated_at, due_date
- GET /api/weeks — returns array of weeks with: id, title, start_date, end_date, status
- GET /api/team/people — returns { people: [{ id, name, email, role, reportsTo }] }
"""

TASKS = [
    # =========================================================================
    # BATCH 1: Backend Infrastructure (Tasks 1-4)
    # =========================================================================
    {
        "id": 1,
        "name": "Team people endpoint for FleetGraph",
        "prompt": TDD_PREAMBLE + """\
Task: Create the /api/team/people endpoint that FleetGraph calls to get the team roster.

## Backend Route
Create ship/api/src/routes/team-people.ts:
- export function createTeamPeopleRouter(pool: pg.Pool): Router
- Apply auth middleware (import { createAuthMiddleware } from "../middleware/auth.js")

Endpoints:
- GET / — return all active users as team members
  - Query: SELECT id, username, email, role, reports_to FROM users WHERE deleted_at IS NULL ORDER BY username
  - Map each row to: { id: row.id, user_id: row.id, name: row.username, email: row.email, role: row.role, reportsTo: row.reports_to }
  - Return: { people: [...] }

Register in ship/api/src/app.ts:
- import { createTeamPeopleRouter } from "./routes/team-people.js";
- app.use("/api/team/people", createTeamPeopleRouter(pool));
- Place BEFORE the catchall SPA fallback route
""",
    },
    {
        "id": 2,
        "name": "Admin user management route + page",
        "prompt": TDD_PREAMBLE + """\
Task: Create admin user management — backend route + frontend page update.

## Backend Route
Create ship/api/src/routes/admin.ts:
- export function createAdminRouter(pool: pg.Pool): Router
- Apply auth middleware
- Apply role middleware for admin-only access (import { createRoleMiddleware } from "../middleware/auth.js")

Endpoints:
- GET /users — list all users
  - SELECT id, username, email, role, title, department, created_at, deleted_at FROM users ORDER BY created_at DESC
  - Return array of user objects
- PATCH /users/:id/role — update user role
  - Body: { role: "member" | "admin" }
  - Validate role is one of the allowed values
  - UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2
  - Return updated user
- DELETE /users/:id — deactivate user (soft delete)
  - UPDATE users SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL
  - Return 200

Register in ship/api/src/app.ts:
- import { createAdminRouter } from "./routes/admin.js";
- app.use("/api/admin", createAdminRouter(pool));

## Frontend — Update AdminDashboardPage
Read ship/web/src/pages/AdminDashboardPage.tsx first, then modify it:
- Add a "Users" section below existing content
- Fetch users from GET /api/admin/users on mount (use authFetch)
- Show table: Username, Email, Role, Status (active/deactivated), Actions
- Role column: dropdown (member/admin) that calls PATCH /api/admin/users/:id/role on change
- Actions column: "Deactivate" button that calls DELETE /api/admin/users/:id
- Show deactivated users in gray with "Reactivate" option

Add to ship/web/src/api/client.ts:
- getAdminUsers(): Promise<any[]>
- updateUserRole(id: string, role: string): Promise<any>
- deactivateUser(id: string): Promise<void>
""",
    },
    {
        "id": 3,
        "name": "Rate limiting middleware",
        "prompt": TDD_PREAMBLE + """\
Task: Create rate limiting middleware to protect against API abuse.

## Middleware
Create ship/api/src/middleware/rateLimiter.ts:
- In-memory sliding window rate limiter (no external dependencies)
- Track requests per IP address using a Map<string, { count: number, resetAt: number }>
- Clean up expired entries periodically (every 60 seconds)
- Export two middleware functions:

1. export function createRateLimiter(maxRequests: number = 100, windowMs: number = 60000)
   - Returns Express middleware
   - Tracks req.ip
   - If count > maxRequests within windowMs: return 429 with { error: "Too many requests", retryAfter: seconds }
   - Set Retry-After header
   - Otherwise: increment count and call next()

2. export const authRateLimiter = createRateLimiter(20, 60000)
   - Stricter limit for auth endpoints (login, register)

## Wire into app.ts
Read ship/api/src/app.ts first, then modify:
- import { createRateLimiter, authRateLimiter } from "./middleware/rateLimiter.js";
- Apply general rate limiter BEFORE all routes: app.use(createRateLimiter());
- Apply authRateLimiter specifically to auth routes: app.use("/api/auth", authRateLimiter, createAuthRouter(pool));
  (modify the existing app.use("/api/auth", ...) line to include authRateLimiter)
""",
    },
    {
        "id": 4,
        "name": "Audit logging middleware + route",
        "prompt": TDD_PREAMBLE + """\
Task: Create audit logging middleware and admin audit log viewer.

## Database
Create migration ship/api/src/db/migrations/029_create_audit_log.sql:
```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(10) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(255) DEFAULT '',
  request_body JSONB DEFAULT '{}',
  ip_address VARCHAR(45) DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type);
```

## Middleware
Create ship/api/src/middleware/auditLogger.ts:
- export function createAuditLogger(pool: pg.Pool): Express middleware
- Only log mutating requests: POST, PUT, PATCH, DELETE
- Skip GET, OPTIONS, HEAD
- Extract resource_type from URL path: /api/issues/123 → resource_type="issues", resource_id="123"
- Extract user_id from req.user?.id (may be null for unauthenticated requests)
- Log AFTER the response is sent (use res.on("finish", ...)) so it doesn't slow down responses
- INSERT INTO audit_log (user_id, action, resource_type, resource_id, request_body, ip_address)
- Sanitize request_body: remove "password" fields before logging

## Backend Route
Create ship/api/src/routes/audit-log.ts:
- export function createAuditLogRouter(pool: pg.Pool): Router
- Apply auth middleware + admin role middleware
- GET / — list audit log entries
  - Query params: limit (default 50), offset, user_id, resource_type, from_date, to_date
  - Join with users for username
  - ORDER BY created_at DESC
  - Return { entries: [...], total: count }

Register in app.ts:
- import { createAuditLogger } from "./middleware/auditLogger.js";
- import { createAuditLogRouter } from "./routes/audit-log.js";
- app.use(createAuditLogger(pool)); — AFTER auth middleware, BEFORE routes
- app.use("/api/admin/audit-log", createAuditLogRouter(pool));
""",
    },

    # =========================================================================
    # BATCH 2: Features with Migrations (Tasks 5-8)
    # =========================================================================
    {
        "id": 5,
        "name": "Backlinks tracking",
        "prompt": TDD_PREAMBLE + """\
Task: Create backlinks system to track entity references.

## Database
Create migration ship/api/src/db/migrations/030_create_backlinks.sql:
```sql
CREATE TABLE IF NOT EXISTS backlinks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type VARCHAR(30) NOT NULL CHECK (source_type IN ('issue', 'project', 'document', 'ship', 'program', 'comment')),
  source_id UUID NOT NULL,
  target_type VARCHAR(30) NOT NULL CHECK (target_type IN ('issue', 'project', 'document', 'ship', 'program')),
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_type, source_id, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS idx_backlinks_source ON backlinks(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_backlinks_target ON backlinks(target_type, target_id);
```

## Backend Route
Create ship/api/src/routes/backlinks.ts:
- export function createBacklinksRouter(pool: pg.Pool): Router
- Apply auth middleware
- GET / — list backlinks for an entity
  - Required query params: entity_type, entity_id
  - Find all where (source matches) OR (target matches)
  - Return array of backlink objects
- POST / — create backlink
  - Body: { source_type, source_id, target_type, target_id }
  - Return 201, or 409 on duplicate
- DELETE /:id — remove backlink

Register in app.ts.

## Frontend Component
Create ship/web/src/components/BacklinksList.tsx:
- Props: entityType: string, entityId: string
- Fetch from /api/backlinks?entity_type=X&entity_id=Y on mount
- Show "Referenced by" section with linked entity type + ID
- If empty: show "No references found"
- Styled as compact list (text-sm, gray border)

Add to ship/web/src/api/client.ts:
- getBacklinks(entityType, entityId): Promise<any[]>
- createBacklink(data): Promise<any>
- deleteBacklink(id): Promise<void>
""",
    },
    {
        "id": 6,
        "name": "API token management",
        "prompt": TDD_PREAMBLE + """\
Task: Create API token management for programmatic access.

## Database
Create migration ship/api/src/db/migrations/031_create_api_tokens.sql:
```sql
CREATE TABLE IF NOT EXISTS api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  token_hash VARCHAR(128) NOT NULL,
  token_prefix VARCHAR(8) NOT NULL,
  last_used_at TIMESTAMPTZ DEFAULT NULL,
  expires_at TIMESTAMPTZ DEFAULT NULL,
  revoked_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_api_tokens_hash ON api_tokens(token_hash);
```

## Backend Route
Create ship/api/src/routes/api-tokens.ts:
- export function createApiTokensRouter(pool: pg.Pool): Router
- Apply auth middleware
- GET / — list current user's tokens
  - SELECT id, name, token_prefix, last_used_at, expires_at, revoked_at, created_at
  - Filter: user_id = req.user.id AND revoked_at IS NULL
  - Return array (never return token_hash)
- POST / — generate new token
  - Body: { name: string, expires_in_days?: number }
  - Generate 32-byte random hex token
  - Store: token_hash = sha256(token), token_prefix = first 8 chars
  - Return { id, name, token: plaintext_token, token_prefix, expires_at } — plaintext shown ONCE
- DELETE /:id — revoke token
  - UPDATE api_tokens SET revoked_at = NOW() WHERE id = $1 AND user_id = req.user.id
  - Return 200

Register in app.ts.

## Frontend
Create ship/web/src/pages/ApiTokensPage.tsx:
- Fetch tokens from GET /api/api-tokens on mount
- Token list: name, prefix (shown as "ship_xxxx..."), created, last used, expires, actions
- "Generate Token" button opens inline form: name input + optional expiry dropdown
- After generating: show token in a highlighted box with copy button and warning "This token won't be shown again"
- Revoke button per token (confirmation prompt)

Add to client.ts, App.tsx route, Layout.tsx nav { path: '/api-tokens', label: 'API Tokens', icon: '🔑' }
""",
    },
    {
        "id": 7,
        "name": "Setup wizard / onboarding",
        "prompt": TDD_PREAMBLE + """\
Task: Create a setup wizard for new user onboarding.

## Backend Route
Create ship/api/src/routes/setup.ts:
- export function createSetupRouter(pool: pg.Pool): Router
- Apply auth middleware
- GET /status — check if user has completed setup
  - Check user_settings for a 'setup_completed' flag
  - Check if user has: at least 1 team, at least 1 project, at least 1 standup
  - Return { completed: bool, steps: [
      { name: 'create_team', label: 'Create a Team', done: bool },
      { name: 'create_project', label: 'Create a Project', done: bool },
      { name: 'first_standup', label: 'Submit First Standup', done: bool }
    ]}
- POST /complete — mark setup as completed
  - Upsert user_settings with setup_completed = true

Register in app.ts.

## Frontend
Create ship/web/src/pages/SetupPage.tsx:
- Fetch setup status on mount from GET /api/setup/status
- If already completed, redirect to /dashboard
- Stepper UI at top: 3 circles connected by lines, filled when done
- Step 1: "Create a Team" — simple form: team name + description, POST to /api/teams
- Step 2: "Create a Project" — form: project name + description, POST to /api/projects
- Step 3: "Submit Your First Standup" — embed StandupForm component
- Each step auto-advances when completed (refetch status)
- "Skip Setup" link at bottom → POST /api/setup/complete → redirect to dashboard
- "Complete" button on final step → POST /api/setup/complete → redirect to dashboard

Add route to App.tsx (inside Layout): <Route path="setup" element={<SetupPage />} />
Add to Layout.tsx nav: { path: '/setup', label: 'Setup', icon: '🚀' }
""",
    },
    {
        "id": 8,
        "name": "Iterations / sprint management",
        "prompt": TDD_PREAMBLE + """\
Task: Create iterations/sprint management system.

## Database
Create migration ship/api/src/db/migrations/032_create_iterations.sql:
```sql
CREATE TABLE IF NOT EXISTS iterations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  goal TEXT DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_iterations_team ON iterations(team_id);
CREATE INDEX IF NOT EXISTS idx_iterations_status ON iterations(status);
CREATE INDEX IF NOT EXISTS idx_iterations_dates ON iterations(start_date, end_date);
```

## Backend Route
Create ship/api/src/routes/iterations.ts:
- export function createIterationsRouter(pool: pg.Pool): Router
- Apply auth middleware
- GET / — list iterations
  - Optional filters: team_id, status
  - Filter by deleted_at IS NULL
  - ORDER BY start_date DESC
- GET /current — get active iteration
  - WHERE status = 'active' AND deleted_at IS NULL LIMIT 1
  - Return 404 if none active
- GET /:id — get single iteration
- POST / — create iteration
  - Body: { name, team_id, start_date, end_date, goal }
  - Status defaults to 'planned'
- PUT /:id — update iteration
- PATCH /:id/activate — set status to 'active'
  - Deactivate any other active iteration for the same team first
- PATCH /:id/complete — set status to 'completed'
- DELETE /:id — soft delete

Register in app.ts.

## Frontend
Create ship/web/src/pages/IterationsPage.tsx:
- Fetch iterations from /api/iterations on mount
- Active iteration highlighted at top with green border
- Iteration cards: name, dates (start - end), goal preview, status badge, team name
- Status badges: planned=gray, active=green, completed=blue
- "+ New Iteration" form: name, team dropdown, start/end dates, goal textarea
- "Activate" button on planned iterations, "Complete" button on active ones

Add to client.ts, App.tsx route, Layout.tsx nav { path: '/iterations', label: 'Iterations', icon: '🔁' }
""",
    },

    # =========================================================================
    # BATCH 3: FleetGraph Frontend Integration (Tasks 9-13)
    # =========================================================================
    {
        "id": 9,
        "name": "FleetGraph chat panel component",
        "prompt": TDD_PREAMBLE + FLEETGRAPH_TYPES + """\

Task: Create the FleetGraph chat panel that embeds in Ship as a sidebar.

## Hook
Create ship/web/src/hooks/useFleetGraph.ts:
```typescript
import { useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const FLEETGRAPH_URL = import.meta.env.VITE_FLEETGRAPH_URL || 'http://localhost:4000';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  findings?: Finding[];
  severity?: Severity;
  timestamp: string;
}

// Use the Finding, Severity, FleetResult, ApprovalRecord types from the contract above

export function useFleetGraph() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();
  const { user } = useAuth();

  // Parse entity from URL: /issues/abc123 → { entityType: "issue", entityId: "abc123" }
  const getContext = useCallback(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    const typeMap: Record<string, string> = { issues: 'issue', projects: 'project', programs: 'program', docs: 'document', weeks: 'sprint' };
    const entityType = typeMap[parts[0]] || 'unknown';
    const entityId = parts[1] || undefined;
    return { pathname: location.pathname, entityType, entityId };
  }, [location.pathname]);

  const sendMessage = useCallback(async (text: string) => {
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: text, timestamp: new Date().toISOString() }]);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${FLEETGRAPH_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'prod', message: text, context: getContext() }),
      });
      if (!res.ok) throw new Error(`FleetGraph error: ${res.status}`);
      const result: FleetResult = await res.json();

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.chatResponse || result.summary,
        findings: result.findings,
        severity: result.severity,
        timestamp: new Date().toISOString(),
      }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reach FleetGraph');
    } finally {
      setLoading(false);
    }
  }, [getContext]);

  return { messages, loading, error, sendMessage };
}
```

## Component
Create ship/web/src/components/FleetGraphPanel.tsx:
- Props: isOpen: boolean, onClose: () => void
- Uses useFleetGraph() hook
- Slide-in panel from right side (fixed position, w-96, full height, bg-white shadow-2xl)
- Header: "⚡ FleetGraph" + close button (X)
- Message list: scrollable area
  - User messages: bg-blue-50 rounded-lg p-3, right-aligned
  - Assistant messages: bg-gray-50 rounded-lg p-3, left-aligned
  - If findings: show severity badge + finding cards below message
  - Finding card: border-l-4 (color by severity) + title + detail + recommendation
- Input area at bottom: text input + send button (blue)
- Loading indicator: pulsing dots while waiting
- Error banner: red text at bottom if FleetGraph unreachable
- Empty state: "Ask FleetGraph about your project. Try: 'What should I focus on today?'"
""",
    },
    {
        "id": 10,
        "name": "Wire FleetGraph panel into Layout",
        "prompt": TDD_PREAMBLE + FLEETGRAPH_TYPES + """\

Task: Add FleetGraph toggle button to Layout and render the panel.

Read ship/web/src/components/Layout.tsx first to understand current structure.
Read ship/web/src/components/FleetGraphPanel.tsx to understand its props.

Modify ship/web/src/components/Layout.tsx:
1. Add import: import FleetGraphPanel from './FleetGraphPanel';
2. Add state: const [fleetGraphOpen, setFleetGraphOpen] = useState(false);
3. Add ⚡ button at the bottom of the sidebar navigation (below all nav items, above any footer):
   ```
   <button
     onClick={() => setFleetGraphOpen(!fleetGraphOpen)}
     className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-gray-600 hover:bg-yellow-50 hover:text-yellow-700 border-t border-gray-200 w-full"
     title="FleetGraph Intelligence"
   >
     <span>⚡</span>
     <span>FleetGraph</span>
   </button>
   ```
4. Render FleetGraphPanel at the end of the component (outside main content area):
   ```
   <FleetGraphPanel isOpen={fleetGraphOpen} onClose={() => setFleetGraphOpen(false)} />
   ```

Also add to ship/web/src/api/client.ts:
```typescript
// FleetGraph API functions
const FLEETGRAPH_URL = import.meta.env.VITE_FLEETGRAPH_URL || 'http://localhost:4000';

export async function sendFleetGraphMessage(message: string, context?: { pathname?: string; entityType?: string; entityId?: string }) {
  const res = await fetch(`${FLEETGRAPH_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target: 'prod', message, context }),
  });
  if (!res.ok) throw new Error('FleetGraph request failed');
  return res.json();
}

export async function getFleetGraphApprovals(status?: string) {
  const qs = status ? `?status=${status}` : '';
  const res = await fetch(`${FLEETGRAPH_URL}/api/approvals${qs}`);
  if (!res.ok) throw new Error('Failed to fetch approvals');
  return res.json();
}

export async function updateFleetGraphApproval(id: string, decision: 'approved' | 'rejected') {
  const res = await fetch(`${FLEETGRAPH_URL}/api/approvals/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision }),
  });
  if (!res.ok) throw new Error('Failed to update approval');
  return res.json();
}
```
""",
    },
    {
        "id": 11,
        "name": "Approvals page for FleetGraph HITL",
        "prompt": TDD_PREAMBLE + FLEETGRAPH_TYPES + """\

Task: Create an Approvals page for FleetGraph's human-in-the-loop queue.

Read ship/web/src/api/client.ts for getFleetGraphApprovals and updateFleetGraphApproval functions.

Create ship/web/src/pages/ApprovalsPage.tsx:
- State: approvals array, filter ('all' | 'pending' | 'approved' | 'rejected'), loading
- Fetch approvals on mount and when filter changes: getFleetGraphApprovals(filter === 'all' ? undefined : filter)
- Filter tabs at top: All, Pending, Approved, Rejected — with count badges
- Each approval card:
  - Header: "Approval #id" + status badge (pending=yellow, approved=green, rejected=red)
  - Timestamp: createdAt formatted as relative time
  - Findings list: each finding as a compact card with severity dot + title + detail
  - If finding has recommendation: show in italic
  - Action buttons (only for pending):
    - "Approve" (green button) → updateFleetGraphApproval(id, 'approved') → refetch
    - "Reject" (red button) → updateFleetGraphApproval(id, 'rejected') → refetch
- Empty state: "No approvals found. FleetGraph creates approvals when it detects project risks."
- Error handling: if FleetGraph is unreachable, show "FleetGraph is not available. Check that the service is running."

Add route to App.tsx: <Route path="approvals" element={<ApprovalsPage />} />
Add to Layout.tsx nav: { path: '/approvals', label: 'Approvals', icon: '🔒' }
""",
    },
    {
        "id": 12,
        "name": "Wire WebSocket into document editor",
        "prompt": TDD_PREAMBLE + """\
Task: Wire the existing useWebSocket hook into the document detail page for real-time collaboration indicators.

Read ship/web/src/hooks/useWebSocket.ts to understand the hook's API.
Read ship/web/src/pages/DocumentDetailPage.tsx to see the current implementation.

Modify ship/web/src/pages/DocumentDetailPage.tsx:
1. Import the useWebSocket hook
2. Call it with the document ID when viewing a document:
   const { activeUsers, isConnected } = useWebSocket(document?.id);
3. Add an "Active Users" indicator near the top of the page:
   - If activeUsers.length > 0: show avatars/initials of other users viewing the document
   - Show a green dot if WebSocket is connected, gray if not
   - Style: flex items-center gap-2, small circular avatars (w-6 h-6 rounded-full bg-blue-500 text-white text-xs)
4. If useWebSocket throws or the connection fails, degrade gracefully — just don't show the indicator

Do NOT modify the useWebSocket hook itself. Only consume it in DocumentDetailPage.
""",
    },
    {
        "id": 13,
        "name": "API shape compatibility for FleetGraph",
        "prompt": TDD_PREAMBLE + """\
Task: Ensure Ship's API returns data shapes compatible with FleetGraph's expectations.

FleetGraph's shipClient.ts calls these endpoints and expects specific field names:

1. GET /api/issues?limit=500
   FleetGraph looks for: id, title, state (or status), priority, assignee_id, assignee_name, updated_at, created_at, due_date
   - Read ship/api/src/routes/issues.ts
   - Check if the GET / endpoint returns these fields
   - If 'assignee_name' is missing: modify the query to JOIN with users table on assignee_id to include assignee_name
   - If 'due_date' column doesn't exist: add it to the SELECT as NULL (FleetGraph handles null gracefully)

2. GET /api/weeks
   FleetGraph looks for: id, title (or name), status, start_date, end_date, has_plan
   - Read ship/api/src/routes/weeks.ts
   - Check if these fields are returned
   - 'has_plan' may not exist — if not, add a subquery: EXISTS(SELECT 1 FROM weekly_plans WHERE week_id = weeks.id) as has_plan

3. GET /api/team/people (created in Task 1)
   FleetGraph looks for: people array with { id, user_id, name, email, role, reportsTo }
   - Verify the route from Task 1 returns this shape

4. GET /api/weeks/:id/standups — FleetGraph fetches standups scoped to a week
   - This endpoint may NOT exist. Check ship/api/src/routes/weeks.ts or standups.ts
   - If missing: add a GET /:id/standups endpoint to the weeks router
   - Query: SELECT s.*, u.username as user_name FROM standups s JOIN users u ON s.user_id = u.id WHERE s.deleted_at IS NULL
   - Since our standups use standup_date (not week_id), filter by date range: standup_date BETWEEN week.start_date AND week.end_date
   - Return array of standups

For each fix: read the file first, make the minimal edit, verify with npx tsc --noEmit.
""",
    },
]

TASK_TIMEOUT = 600


def run_task(task, graph, trace_collector):
    print(f"\n{'='*70}")
    print(f"TASK {task['id']}: {task['name']}")
    print(f"{'='*70}\n")

    trace_collector.start_trace(f"batch3_task_{task['id']}_{task['name']}")
    start = time.time()

    class TaskTimeout(Exception):
        pass

    def timeout_handler(signum, frame):
        raise TaskTimeout(f"Task timed out after {TASK_TIMEOUT}s")

    old_handler = signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(TASK_TIMEOUT)

    try:
        result = graph.invoke({
            "messages": [HumanMessage(content=task["prompt"])],
            "context": "",
            "memories": "",
            "rules": "",
            "trace_steps": [],
            "tasks": [],
            "current_task_index": 0,
            "codebase_patterns": "",
            "shared_contract": "",
            "project_state": "",
            "retry_counts": {},
            "token_usage": {},
        })
        last_msg = result["messages"][-1].content
    except TaskTimeout:
        last_msg = f"TIMEOUT: Task exceeded {TASK_TIMEOUT}s limit."
        print(f"\n⚠️  {last_msg}")
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, old_handler)

    elapsed = time.time() - start
    trace_path = trace_collector.save_trace()

    result_file = Path(f"traces/batch3_task_{task['id']}_result.md")
    result_file.parent.mkdir(exist_ok=True)
    result_file.write_text(
        f"# Task {task['id']}: {task['name']}\n\n"
        f"**Duration:** {elapsed:.1f}s\n"
        f"**Trace:** {trace_path}\n\n"
        f"## Agent Output\n\n{last_msg}\n"
    )

    print(f"\n{last_msg}")
    print(f"\n[Completed in {elapsed:.1f}s | trace: {trace_path}]")

    return {"id": task["id"], "name": task["name"], "duration": elapsed, "trace": str(trace_path), "output": last_msg}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--task", type=int, help="Run specific task (1-13)")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--start-from", type=int, default=1)
    args = parser.parse_args()

    if args.dry_run:
        tasks = [TASKS[args.task - 1]] if args.task else TASKS
        for t in tasks:
            print(f"\n{'='*70}\nTASK {t['id']}: {t['name']}\n{'='*70}")
            print(t["prompt"])
        return

    set_workspace(Path(__file__).resolve().parent)
    graph = build_supervisor_graph()
    trace_collector = TraceCollector()
    results = []

    if args.task:
        results.append(run_task(TASKS[args.task - 1], graph, trace_collector))
    else:
        for task in TASKS:
            if task["id"] < args.start_from:
                continue
            results.append(run_task(task, graph, trace_collector))

    summary_path = Path("traces/batch3_run_summary.json")
    summary_path.write_text(json.dumps(results, indent=2))
    print(f"\n\nTotal tasks: {len(results)}")
    print(f"Total time: {sum(r['duration'] for r in results):.1f}s")


if __name__ == "__main__":
    main()

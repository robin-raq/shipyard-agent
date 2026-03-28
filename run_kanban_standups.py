"""Batch runner — feeds kanban + standups tasks to the Shipyard agent.

Each task prompt enforces TDD: write tests first, then implement.
Uses the supervisor (multi-agent) graph so tasks are decomposed to workers.

Usage:
    python run_kanban_standups.py                # run all tasks sequentially
    python run_kanban_standups.py --task 1       # run a specific task
    python run_kanban_standups.py --dry-run      # print prompts without invoking
"""

import argparse
import json
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage

# Load env before importing shipyard modules
load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env", override=True)

from shipyard.supervisor import build_supervisor_graph
from shipyard.tools import set_workspace
from shipyard.tracing import TraceCollector

# ---------------------------------------------------------------------------
# TDD preamble injected into every task prompt
# ---------------------------------------------------------------------------

TDD_PREAMBLE = """\
IMPORTANT — Follow strict TDD and MATCH EXISTING PATTERNS exactly.

## Step 1: Understand the codebase BEFORE writing any code
- Use scan_workspace to see the directory tree.
- Use search_files to find existing test files, imports, and conventions.
- CRITICAL: Read at least ONE existing test file in the same directory to copy its exact structure.

## Step 2: Write a FAILING test FIRST (Red phase)
- Match the EXACT pattern of existing tests. Do NOT invent your own patterns.
- For API tests (ship/api/): Copy the pattern from ship/api/src/__tests__/auth.test.ts:
  - Import from "vitest": { describe, it, expect, beforeAll, afterAll }
  - Import request from "supertest"
  - Import express from "express"
  - Import pg from "pg"
  - Create a testPool with TEST_DATABASE_URL
  - Create a mini express app: const app = express(); app.use(express.json()); app.use("/api/...", createRouter(testPool));
  - Use beforeAll/afterAll to create and drop test tables
  - Use .set("x-session-token", token) for auth (NOT cookies, NOT "Authorization: Bearer")
- For frontend tests (ship/web/): Use vitest with React Testing Library.
- Do NOT import from files that don't exist. Do NOT use placeholder routes.

## Step 3: Implement the MINIMUM code to make the test pass (Green phase)
- Only write the code needed to pass the tests.
- Follow existing patterns in the codebase (read the neighboring files first).
- Do NOT create documentation files (.md) or README files.
- Do NOT add comments that say "Replace with..." or "Adjust based on..." — use real values.

## Step 4: Verify
- After implementation, run the test suite to confirm:
  - Backend: run_command("npx vitest run --reporter=verbose") in ship/api/ directory
  - Frontend: run_command("npx vitest run --reporter=verbose") in ship/web/ directory

"""

# ---------------------------------------------------------------------------
# Task definitions — dependency-ordered
# ---------------------------------------------------------------------------

TASKS = [
    # =========================================================================
    # KANBAN TRACK (Tasks 1-4)
    # =========================================================================
    {
        "id": 1,
        "name": "Kanban migration + issues route update",
        "prompt": TDD_PREAMBLE + """\
Task: Expand issue statuses from 4 to 7 for a kanban board, and add assignee support.

Steps:
1. Read ship/api/src/db/migrations/002_separate_tables.sql to see the current issues table schema.
2. Read ship/api/src/routes/issues.ts to see the current route implementation.
3. Read ship/api/src/__tests__/auth.test.ts for the exact test pattern.

4. Create ship/api/src/db/migrations/013_expand_issue_statuses_for_kanban.sql:
   - ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_status_check;
   - ALTER TABLE issues ADD CONSTRAINT issues_status_check CHECK (status IN ('triage', 'backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled'));
   - UPDATE issues SET status = 'triage' WHERE status = 'open';
   - UPDATE issues SET status = 'cancelled' WHERE status = 'closed';
   - ALTER TABLE issues ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES users(id) ON DELETE SET NULL;
   - CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
   - CREATE INDEX IF NOT EXISTS idx_issues_assignee ON issues(assignee_id);

5. Modify ship/api/src/routes/issues.ts:
   - Change VALID_STATUSES to ["triage", "backlog", "todo", "in_progress", "in_review", "done", "cancelled"]
   - Add assignee_id to POST and PUT handlers (optional field)
   - Add a new PATCH /:id/status endpoint:
     - Accepts { status: string } in body
     - Validates status against VALID_STATUSES
     - Updates only status and updated_at
     - Returns the updated issue
     - Returns 404 if issue not found or deleted
   - Add ?assignee_id= filter to GET /

6. Create ship/api/src/__tests__/issues-kanban.test.ts following the EXACT auth.test.ts pattern:
   - Create testPool with TEST_DATABASE_URL || "postgresql://ship:ship@localhost:5433/ship_test"
   - Create mini express app with issues router
   - beforeAll: CREATE issues table with the NEW status constraint and assignee_id column
   - afterAll: DROP TABLE issues CASCADE; pool.end()
   - Test cases:
     - POST /api/issues with status "triage" returns 201
     - POST /api/issues with status "backlog" returns 201
     - POST /api/issues with old status "open" returns 400
     - GET /api/issues returns all issues
     - GET /api/issues?status=triage returns filtered list
     - PATCH /api/issues/:id/status with { status: "in_progress" } returns 200
     - PATCH /api/issues/:id/status with { status: "invalid" } returns 400
     - PATCH /api/issues/:id/status for nonexistent ID returns 404
     - PUT /api/issues/:id with assignee_id updates correctly
     - DELETE /api/issues/:id soft deletes

7. Run: run_command("npx vitest run src/__tests__/issues-kanban.test.ts --reporter=verbose") from ship/api/
""",
    },
    {
        "id": 2,
        "name": "Install @dnd-kit + kanban client API",
        "prompt": TDD_PREAMBLE + """\
Task: Install drag-and-drop library and add kanban client API functions.

Steps:
1. Read ship/web/src/api/client.ts to understand the existing client pattern.
2. Read ship/web/src/context/AuthContext.tsx to understand authFetch.

3. Install @dnd-kit dependencies:
   - run_command("pnpm add @dnd-kit/core @dnd-kit/sortable") from ship/web/ directory

4. Add to ship/web/src/api/client.ts:
   - Import { authFetch } from "../context/AuthContext" at the top (if not already imported)
   - Add this function:
     ```
     export async function updateIssueStatus(id: string, status: string): Promise<any> {
       const res = await authFetch(`/api/issues/${id}/status`, {
         method: 'PATCH',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ status }),
       });
       if (!res.ok) throw new Error('Failed to update issue status');
       return res.json();
     }
     ```

5. Verify: run_command("npx tsc --noEmit") from ship/web/ to check TypeScript compiles.
""",
    },
    {
        "id": 3,
        "name": "KanbanBoard components",
        "prompt": TDD_PREAMBLE + """\
Task: Build KanbanBoard, KanbanColumn, and KanbanCard components using @dnd-kit.

Steps:
1. Read ship/web/src/components/DocumentList.tsx for existing component patterns.
2. Read ship/web/src/pages/IssuesPage.tsx to understand the Issue type shape.

3. Create ship/web/src/components/KanbanCard.tsx:
   - Import { useDraggable } from "@dnd-kit/core"
   - Props: issue: { id: string; title: string; status: string; priority: string; assignee_id?: string }
   - Use useDraggable({ id: issue.id })
   - Render a card with bg-white rounded-lg shadow-sm border p-3 cursor-grab
   - Show title (truncated with line-clamp-2)
   - Show priority badge with color: low=gray-100/gray-800, medium=blue-100/blue-800, high=orange-100/orange-800, urgent=red-100/red-800
   - If assignee_id present, show a small avatar placeholder

4. Create ship/web/src/components/KanbanColumn.tsx:
   - Import { useDroppable } from "@dnd-kit/core"
   - Props: id: string, title: string, issues: Issue[], count: number
   - Use useDroppable({ id })
   - Render column header with title and count badge (bg-gray-200 rounded-full px-2)
   - Container: min-w-[280px] bg-gray-50 rounded-lg p-3 flex-shrink-0 h-full
   - When isOver (from useDroppable), add ring-2 ring-blue-400 visual indicator
   - Map issues to KanbanCard components

5. Create ship/web/src/components/KanbanBoard.tsx:
   - Import { DndContext, DragEndEvent, closestCenter } from "@dnd-kit/core"
   - Props: issues: Issue[], onStatusChange: (issueId: string, newStatus: string) => Promise<void>
   - Define KANBAN_COLUMNS = [
       { id: "triage", label: "Triage" },
       { id: "backlog", label: "Backlog" },
       { id: "todo", label: "To Do" },
       { id: "in_progress", label: "In Progress" },
       { id: "in_review", label: "In Review" },
       { id: "done", label: "Done" },
       { id: "cancelled", label: "Cancelled" },
     ]
   - Group issues by status using useMemo
   - handleDragEnd: extract issueId from active.id, newStatus from over.id, call onStatusChange if status changed
   - Render: flex overflow-x-auto gap-4 p-4 h-[calc(100vh-200px)]
   - Render one KanbanColumn per column with its filtered issues

6. Verify: run_command("npx tsc --noEmit") from ship/web/
""",
    },
    {
        "id": 4,
        "name": "IssuesPage kanban/list view toggle",
        "prompt": TDD_PREAMBLE + """\
Task: Add a list/board toggle to the existing IssuesPage.

Steps:
1. Read ship/web/src/pages/IssuesPage.tsx to understand the current implementation.
2. Read ship/web/src/components/KanbanBoard.tsx to understand its props.
3. Read ship/web/src/api/client.ts for updateIssueStatus.

4. Modify ship/web/src/pages/IssuesPage.tsx:
   - Add import for KanbanBoard from "../components/KanbanBoard"
   - Add import for updateIssueStatus from "../api/client"
   - Add state: const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
   - Update VALID_STATUSES constant (or equivalent) to: ["triage", "backlog", "todo", "in_progress", "in_review", "done", "cancelled"]
   - Update any STATUS_COLORS or status display mapping to include all 7 statuses:
     triage=purple, backlog=gray, todo=blue, in_progress=yellow, in_review=indigo, done=green, cancelled=red
   - Add toggle buttons in the header area (next to the "+ Create" button):
     ```
     <div className="flex bg-gray-100 rounded-lg p-1">
       <button
         onClick={() => setViewMode('list')}
         className={`px-3 py-1 rounded-md text-sm font-medium ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
       >List</button>
       <button
         onClick={() => setViewMode('kanban')}
         className={`px-3 py-1 rounded-md text-sm font-medium ${viewMode === 'kanban' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
       >Board</button>
     </div>
     ```
   - When viewMode === 'kanban', render:
     ```
     <KanbanBoard
       issues={issues}
       onStatusChange={async (issueId, newStatus) => {
         await updateIssueStatus(issueId, newStatus);
         fetchIssues(); // re-fetch to update the list
       }}
     />
     ```
   - When viewMode === 'list', render the existing table/list view
   - Update the status filter dropdown to show all 7 statuses

5. Verify:
   - run_command("npx tsc --noEmit") from ship/web/
   - run_command("npx vite build") from ship/web/ to check production build
""",
    },

    # =========================================================================
    # STANDUPS TRACK (Tasks 5-7)
    # =========================================================================
    {
        "id": 5,
        "name": "Standups migration + API route",
        "prompt": TDD_PREAMBLE + """\
Task: Create the standups database table and full API route with authentication.

Steps:
1. Read ship/api/src/db/migrations/002_separate_tables.sql for migration patterns.
2. Read ship/api/src/routes/issues.ts for route patterns.
3. Read ship/api/src/middleware/auth.ts for auth middleware usage.
4. Read ship/api/src/__tests__/auth.test.ts for the EXACT test pattern.

5. Create ship/api/src/db/migrations/014_create_standups_table.sql:
   ```sql
   CREATE TABLE IF NOT EXISTS standups (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     standup_date DATE NOT NULL DEFAULT CURRENT_DATE,
     yesterday TEXT NOT NULL DEFAULT '',
     today TEXT NOT NULL DEFAULT '',
     blockers TEXT NOT NULL DEFAULT '',
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW(),
     deleted_at TIMESTAMPTZ DEFAULT NULL,
     UNIQUE(user_id, standup_date)
   );
   CREATE INDEX IF NOT EXISTS idx_standups_user_date ON standups(user_id, standup_date);
   CREATE INDEX IF NOT EXISTS idx_standups_date ON standups(standup_date);
   CREATE INDEX IF NOT EXISTS idx_standups_deleted_at ON standups(deleted_at);
   ```

6. Create ship/api/src/routes/standups.ts:
   - Import { Router, Request, Response, NextFunction } from "express"
   - Import pg from "pg"
   - Import { createAuthMiddleware } from "../middleware/auth.js"
   - Export function createStandupsRouter(pool: pg.Pool): Router
   - Apply auth middleware to all routes: const auth = createAuthMiddleware(pool); router.use(auth);

   Endpoints:
   - GET / — list standups. Optional query params: date (YYYY-MM-DD), user_id, from, to.
     Join with users table: SELECT s.*, u.username FROM standups s JOIN users u ON s.user_id = u.id
     Filter by deleted_at IS NULL. Order by standup_date DESC, created_at DESC.

   - GET /status — check if current user submitted today.
     Query: SELECT * FROM standups WHERE user_id = $1 AND standup_date = CURRENT_DATE AND deleted_at IS NULL
     Return { due: true } if no rows, { due: false, standup: row } if found.

   - POST / — create standup.
     Requires yesterday, today, blockers in body.
     Use INSERT ... ON CONFLICT (user_id, standup_date) DO UPDATE SET yesterday=$2, today=$3, blockers=$4, updated_at=NOW()
     Set user_id from req.user.id. standup_date defaults to CURRENT_DATE if not provided.
     Return 201 with the standup.

   - PUT /:id — update standup.
     Check user_id = req.user.id, return 403 if not author.
     Update yesterday, today, blockers, updated_at.
     Return 200 with updated standup.

   - DELETE /:id — soft delete.
     Check user_id = req.user.id, return 403 if not author.
     SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL
     Return 200.

7. Modify ship/api/src/app.ts:
   - Add import: import { createStandupsRouter } from "./routes/standups.js";
   - Add route: app.use("/api/standups", createStandupsRouter(pool));
   - Place it after the other API routes.

8. Create ship/api/src/__tests__/standups.test.ts following the auth.test.ts pattern:
   - Create testPool, mini express app with BOTH auth router and standups router
   - beforeAll: CREATE users table (with role column), sessions table, AND standups table
   - Register a test user, login to get session token
   - Tests:
     - GET /api/standups without token → 401
     - GET /api/standups with token → 200 (empty array)
     - POST /api/standups with { yesterday: "Did X", today: "Will do Y", blockers: "None" } → 201
     - POST /api/standups again same day → 200 (upsert, updates content)
     - GET /api/standups → 200, returns array with 1 standup
     - GET /api/standups/status → 200, { due: false, standup: {...} }
     - PUT /api/standups/:id with { today: "Updated" } → 200
     - DELETE /api/standups/:id → 200
     - GET /api/standups → 200, empty array (soft deleted)

9. Run: run_command("npx vitest run src/__tests__/standups.test.ts --reporter=verbose") from ship/api/
""",
    },
    {
        "id": 6,
        "name": "Standups client API + StandupForm",
        "prompt": TDD_PREAMBLE + """\
Task: Create frontend client API functions for standups and a StandupForm component.

Steps:
1. Read ship/web/src/api/client.ts for the existing client pattern.
2. Read ship/web/src/context/AuthContext.tsx — authFetch is exported here.
3. Read ship/web/src/components/DocumentForm.tsx for the form component pattern.

4. Add standup functions to ship/web/src/api/client.ts:
   - Import { authFetch } from "../context/AuthContext" if not already imported
   - Add these functions:
     ```
     export async function getStandups(filters?: { date?: string; user_id?: string; from?: string; to?: string }): Promise<any[]> {
       const params = new URLSearchParams();
       if (filters?.date) params.set('date', filters.date);
       if (filters?.user_id) params.set('user_id', filters.user_id);
       if (filters?.from) params.set('from', filters.from);
       if (filters?.to) params.set('to', filters.to);
       const query = params.toString();
       const res = await authFetch(`/api/standups${query ? '?' + query : ''}`);
       if (!res.ok) throw new Error('Failed to fetch standups');
       return res.json();
     }

     export async function getStandupStatus(): Promise<{ due: boolean; standup?: any }> {
       const res = await authFetch('/api/standups/status');
       if (!res.ok) throw new Error('Failed to fetch standup status');
       return res.json();
     }

     export async function createStandup(data: { yesterday: string; today: string; blockers: string }): Promise<any> {
       const res = await authFetch('/api/standups', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(data),
       });
       if (!res.ok) throw new Error('Failed to create standup');
       return res.json();
     }

     export async function updateStandup(id: string, data: { yesterday?: string; today?: string; blockers?: string }): Promise<any> {
       const res = await authFetch(`/api/standups/${id}`, {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(data),
       });
       if (!res.ok) throw new Error('Failed to update standup');
       return res.json();
     }

     export async function deleteStandup(id: string): Promise<void> {
       const res = await authFetch(`/api/standups/${id}`, { method: 'DELETE' });
       if (!res.ok) throw new Error('Failed to delete standup');
     }
     ```

5. Create ship/web/src/components/StandupForm.tsx:
   - Import useState from "react"
   - Props interface:
     ```
     interface StandupFormProps {
       initialValues?: { yesterday: string; today: string; blockers: string };
       standupId?: string;
       onSubmit: (data: { yesterday: string; today: string; blockers: string }) => Promise<void>;
       onCancel?: () => void;
     }
     ```
   - Three textarea fields with labels: "What did you do yesterday?", "What are you doing today?", "Any blockers?"
   - Submit button: "Submit Standup" or "Update Standup" based on whether standupId is provided
   - Cancel button if onCancel is provided
   - Submitting state that disables the button and shows "Submitting..."
   - Error state that shows error message in red
   - Use Tailwind classes consistent with DocumentForm:
     - Container: space-y-4
     - Labels: block text-sm font-medium text-gray-700 mb-1
     - Textareas: w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500
     - Submit button: bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50

6. Verify: run_command("npx tsc --noEmit") from ship/web/
""",
    },
    {
        "id": 7,
        "name": "StandupsPage + StandupFeed + nav integration",
        "prompt": TDD_PREAMBLE + """\
Task: Build the StandupsPage with date navigation, team feed, and wire into app navigation.

Steps:
1. Read ship/web/src/pages/IssuesPage.tsx for the page pattern.
2. Read ship/web/src/components/Layout.tsx to see how sidebar nav items are defined.
3. Read ship/web/src/App.tsx to see how routes are configured.
4. Read ship/web/src/components/StandupForm.tsx for the form component you'll use.
5. Read ship/web/src/api/client.ts for getStandups, getStandupStatus, createStandup, updateStandup.

6. Create ship/web/src/components/StandupFeed.tsx:
   - Props: standups: Array<{ id: string; username: string; yesterday: string; today: string; blockers: string; standup_date: string; created_at: string }>
   - If standups is empty, show: <p className="text-gray-500 text-center py-8">No standups submitted for this date.</p>
   - Map standups to cards, each with:
     - Header: username in bold + timestamp
     - Three sections with labels: "Yesterday", "Today", "Blockers"
     - Each section text in text-gray-700
     - Blockers section: highlight in red-50 if not empty/not "None"
     - Card style: bg-white rounded-lg shadow-sm border p-4 space-y-3

7. Create ship/web/src/pages/StandupsPage.tsx:
   - State: selectedDate (Date, default today), standups (array), standupStatus, loading, editing
   - Format date as YYYY-MM-DD for API calls
   - Date navigation header:
     ```
     <div className="flex items-center gap-4 mb-6">
       <button onClick={prevDay} className="p-2 hover:bg-gray-100 rounded">←</button>
       <h2 className="text-lg font-semibold">{formatDisplayDate(selectedDate)}</h2>
       <button onClick={nextDay} className="p-2 hover:bg-gray-100 rounded" disabled={isToday}>→</button>
       {!isToday && <button onClick={goToToday} className="text-sm text-blue-600 hover:underline">Today</button>}
     </div>
     ```
   - formatDisplayDate: "Friday, March 27, 2026" format using toLocaleDateString
   - On mount and when selectedDate changes: fetch standups for that date using getStandups({ date })
   - If selectedDate is today:
     - Call getStandupStatus() to check if user already submitted
     - If due (no standup): show StandupForm with onSubmit that calls createStandup then refetches
     - If not due (already submitted): show the user's standup with an "Edit" button
     - If editing: show StandupForm with initialValues and onSubmit that calls updateStandup
   - Below the form/status area: show StandupFeed with all team standups for the selected date
   - Page wrapper: <main className="p-8"><h1 className="text-3xl font-bold mb-6">Standups</h1>...</main>

8. Modify ship/web/src/components/Layout.tsx:
   - Find the navItems array (or equivalent sidebar navigation links)
   - Add a new item for Standups AFTER "Teams": { path: '/standups', label: 'Standups', icon: '🧍' }
   - Follow the exact same pattern as existing nav items

9. Modify ship/web/src/App.tsx:
   - Add import: import StandupsPage from './pages/StandupsPage'
   - Add route inside the Layout routes (where other pages like IssuesPage are):
     <Route path="standups" element={<StandupsPage />} />

10. Verify:
    - run_command("npx tsc --noEmit") from ship/web/
    - run_command("npx vite build") from ship/web/ to check production build succeeds
""",
    },
]

# ---------------------------------------------------------------------------
# Runner (copied from run_tasks.py)
# ---------------------------------------------------------------------------


def run_task(task: dict, graph, trace_collector: TraceCollector) -> dict:
    """Run a single task through the supervisor graph."""
    print(f"\n{'='*70}")
    print(f"TASK {task['id']}: {task['name']}")
    print(f"{'='*70}\n")

    trace_collector.start_trace(f"kanban_standup_task_{task['id']}_{task['name']}")
    start = time.time()

    result = graph.invoke({
        "messages": [HumanMessage(content=task["prompt"])],
        "context": "",
        "memories": "",
        "rules": "",
        "trace_steps": [],
        "tasks": [],
        "current_task_index": 0,
        "codebase_patterns": "",
    })

    elapsed = time.time() - start
    last_msg = result["messages"][-1].content

    # Save trace
    trace_path = trace_collector.save_trace()

    # Save result to file
    result_file = Path(f"traces/kanban_standup_task_{task['id']}_result.md")
    result_file.parent.mkdir(exist_ok=True)
    result_file.write_text(
        f"# Task {task['id']}: {task['name']}\n\n"
        f"**Duration:** {elapsed:.1f}s\n"
        f"**Trace:** {trace_path}\n\n"
        f"## Agent Output\n\n{last_msg}\n"
    )

    print(f"\n{last_msg}")
    print(f"\n[Completed in {elapsed:.1f}s | trace: {trace_path}]")

    return {
        "id": task["id"],
        "name": task["name"],
        "duration": elapsed,
        "trace": str(trace_path),
        "output": last_msg,
    }


def main():
    parser = argparse.ArgumentParser(description="Run kanban + standups tasks through the Shipyard agent")
    parser.add_argument("--task", type=int, help="Run a specific task by ID (1-7)")
    parser.add_argument("--dry-run", action="store_true", help="Print prompts without invoking")
    parser.add_argument("--start-from", type=int, default=1, help="Start from task N")
    args = parser.parse_args()

    if args.dry_run:
        tasks = [TASKS[args.task - 1]] if args.task else TASKS
        for t in tasks:
            print(f"\n{'='*70}")
            print(f"TASK {t['id']}: {t['name']}")
            print(f"{'='*70}")
            print(t["prompt"])
        return

    set_workspace(Path.cwd())
    graph = build_supervisor_graph()
    trace_collector = TraceCollector()
    results = []

    if args.task:
        task = TASKS[args.task - 1]
        result = run_task(task, graph, trace_collector)
        results.append(result)
    else:
        for task in TASKS:
            if task["id"] < args.start_from:
                continue
            result = run_task(task, graph, trace_collector)
            results.append(result)

    # Save summary
    summary_path = Path("traces/kanban_standup_run_summary.json")
    summary_path.write_text(json.dumps(results, indent=2))
    print(f"\n\nRun summary saved to {summary_path}")
    print(f"Total tasks: {len(results)}")
    print(f"Total time: {sum(r['duration'] for r in results):.1f}s")


if __name__ == "__main__":
    main()

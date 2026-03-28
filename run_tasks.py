"""Batch runner — feeds the 10-task Ship feature plan to the Shipyard agent.

Each task prompt enforces TDD: write tests first, then implement.
Uses the supervisor (multi-agent) graph so tasks are decomposed to workers.

Usage:
    python run_tasks.py                # run all tasks sequentially
    python run_tasks.py --task 1       # run a specific task
    python run_tasks.py --dry-run      # print prompts without invoking
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
  - Import supertest: import request from "supertest"
  - Import express: import express from "express"
  - Import pg: import pg from "pg"
  - Create a testPool with TEST_DATABASE_URL
  - Create a mini express app: const app = express(); app.use(express.json()); app.use("/api/...", createRouter(testPool));
  - Use beforeAll/afterAll to create and drop test tables
  - Use .set("x-session-token", token) for auth (NOT cookies, NOT "Authorization: Bearer")
- For frontend tests (ship/web/): Use vitest with React Testing Library.
- Do NOT import from files that don't exist. Do NOT use placeholder routes like '/admin/some-protected-route'.

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
    {
        "id": 1,
        "name": "Rewrite caia-auth middleware",
        "prompt": TDD_PREAMBLE + """\
Task: Add role-based access control (RBAC) tests for the auth middleware in ship/api/src/middleware/auth.ts.

NOTE: The implementation is ALREADY DONE — createRoleMiddleware already exists in auth.ts with role on req.user.
Your ONLY job is to write proper tests for it.

Steps:
1. Read ship/api/src/__tests__/auth.test.ts to see the EXACT test pattern used in this project.
2. Read ship/api/src/middleware/auth.ts to see the current implementation.
3. Read ship/api/src/routes/auth.ts to understand the auth router (register, login, etc).

4. Create ship/api/src/__tests__/auth-middleware.test.ts following the EXACT pattern from auth.test.ts:
   - Import { describe, it, expect, beforeAll, afterAll } from "vitest"
   - Import request from "supertest"
   - Import express from "express"
   - Import pg from "pg"
   - Import { createAuthMiddleware, createRoleMiddleware } from "../middleware/auth.js"
   - Import { createAuthRouter } from "../routes/auth.js"
   - Create testPool: new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL || "postgresql://ship:ship@localhost:5433/ship_test" })
   - Create a mini express app with auth routes AND a test-only admin route:
     ```
     const authMiddleware = createAuthMiddleware(testPool);
     app.use("/api/auth", createAuthRouter(testPool));
     app.get("/api/admin/test", authMiddleware, createRoleMiddleware(["admin"]), (req, res) => res.json({ ok: true }));
     ```
   - In beforeAll: CREATE users table WITH a `role VARCHAR(50) DEFAULT 'user'` column, and sessions table
   - In afterAll: DROP tables, pool.end()

5. Write these test cases:
   - Register a user, login, GET /api/admin/test with x-session-token → expect 403 (role is 'user')
   - Manually UPDATE the user's role to 'admin' via testPool.query, GET /api/admin/test → expect 200
   - GET /api/admin/test without token → expect 401
   - GET /api/admin/test with expired session → expect 401

6. Run: run_command("npx vitest run src/__tests__/auth-middleware.test.ts --reporter=verbose") from ship/api/
""",
    },
    {
        "id": 2,
        "name": "Establish ArchivedPersonsContext",
        "prompt": TDD_PREAMBLE + """\
Task: Create an ArchivedPersonsContext in ship/web/src/context/ArchivedPersonsContext.tsx.

Steps:
1. Read ship/web/src/context/AuthContext.tsx — this is the pattern to follow exactly.
2. Read ship/web/src/api/client.ts to see how API calls are made.

3. Create ship/web/src/__tests__/ArchivedPersonsContext.test.tsx:
   - Import { describe, it, expect, vi, beforeEach } from "vitest"
   - Import { render, screen, waitFor } from "@testing-library/react" (this is already a dev dependency)
   - Import React from "react"
   - Mock the global fetch with vi.fn() to return mock archived persons data
   - Create a test component that uses the useArchivedPersons hook and renders the data
   - Test: renders loading state initially
   - Test: renders archived persons after fetch completes
   - Test: handles fetch error gracefully
   - Test: refetch() triggers a new fetch

4. Create ship/web/src/context/ArchivedPersonsContext.tsx:
   - Follow the EXACT structure of AuthContext.tsx:
     - createContext<ArchivedPersonsContextType | null>(null)
     - useArchivedPersons hook with null check and throw
     - ArchivedPersonsProvider component with useState + useEffect
   - Use authFetch (imported from './AuthContext') to GET /api/programs/archived-persons
   - State: archivedPersons (array), loading (boolean), error (string | null)
   - Export: useArchivedPersons hook and ArchivedPersonsProvider component
""",
    },
    {
        "id": 3,
        "name": "Complete programs context management",
        "prompt": TDD_PREAMBLE + """\
Task: Create a ProgramsContext in ship/web/src/context/ProgramsContext.tsx.

1. First, read AuthContext.tsx and the ArchivedPersonsContext.tsx to follow the established pattern.
2. Read ship/api/src/routes/programs.ts to understand the API contract.

3. Write a test in ship/web/src/__tests__/ProgramsContext.test.tsx that:
   - Tests that usePrograms hook provides programs list, loading state, and CRUD operations
   - Tests createProgram calls POST /api/programs and refreshes the list
   - Tests updateProgram calls PUT /api/programs/:id and refreshes the list
   - Tests deleteProgram calls DELETE /api/programs/:id and refreshes the list

4. Implement the context:
   - Fetch programs from /api/programs on mount using authFetch
   - Expose: programs, loading, error, createProgram, updateProgram, deleteProgram, refetch
   - All mutations should optimistically update the local state then refetch
""",
    },
    {
        "id": 4,
        "name": "Implement accountability API routes",
        "prompt": TDD_PREAMBLE + """\
Task: Create accountability API routes in ship/api/src/routes/accountability.ts.

Steps:
1. Read ship/api/src/routes/documents.ts — this is the EXACT pattern to follow for the router.
2. Read ship/api/src/__tests__/auth.test.ts — this is the EXACT pattern to follow for tests.
3. Read ship/api/src/app.ts to see how routes are mounted.

4. Create ship/api/src/__tests__/accountability.test.ts:
   - Import { describe, it, expect, beforeAll, afterAll } from "vitest"
   - Import request from "supertest", express from "express", pg from "pg"
   - Import { createAccountabilityRouter } from "../routes/accountability.js"
   - Create testPool with TEST_DATABASE_URL || "postgresql://ship:ship@localhost:5433/ship_test"
   - Create mini app: const app = express(); app.use(express.json()); app.use("/api/accountability", createAccountabilityRouter(testPool));
   - beforeAll: CREATE documents table with columns (id UUID DEFAULT gen_random_uuid(), title VARCHAR, content TEXT, document_type VARCHAR, status VARCHAR, properties JSONB, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP)
   - afterAll: DROP TABLE documents CASCADE; pool.end()
   - Tests:
     - POST /api/accountability with { title: "Review Q1", content: "...", assignee_id: "user-1" } → 201
     - GET /api/accountability → 200, returns array with the created record
     - GET /api/accountability/:id → 200, returns single record
     - GET /api/accountability?status=overdue → 200, filters by status
     - PUT /api/accountability/:id with { title: "Updated" } → 200
     - DELETE /api/accountability/:id → 200 (soft delete)
     - GET /api/accountability/:id after delete → 404
     - POST /api/accountability without title → 400

5. Create ship/api/src/routes/accountability.ts:
   - Follow the EXACT pattern of documents.ts
   - export function createAccountabilityRouter(pool: pg.Pool): Router
   - All queries filter by document_type = 'accountability' AND deleted_at IS NULL
   - POST sets document_type = 'accountability', stores assignee_id in properties JSONB
   - Support ?status query param filter

6. Edit ship/api/src/app.ts:
   - Add import: import { createAccountabilityRouter } from "./routes/accountability.js"
   - Add route: app.use("/api/accountability", createAccountabilityRouter(pool));

7. Run: run_command("npx vitest run src/__tests__/accountability.test.ts --reporter=verbose") from ship/api/
""",
    },
    {
        "id": 5,
        "name": "Migrate documents API integration",
        "prompt": TDD_PREAMBLE + """\
Task: Create a documents API client module in ship/web/src/api/documents.ts.

Steps:
1. Read ship/web/src/api/client.ts — this is the existing API client pattern.
2. Read ship/web/src/context/AuthContext.tsx — authFetch is exported from here.
3. Read ship/api/src/routes/documents.ts to understand the API contract.

4. Create ship/web/src/__tests__/documents-api.test.ts:
   - Import { describe, it, expect, vi, beforeEach } from "vitest"
   - Mock global.fetch using vi.fn() in beforeEach
   - Import the functions from "../api/documents"
   - Tests:
     - fetchDocuments() calls fetch with "/api/documents" and returns parsed JSON array
     - fetchDocuments({ type: "issue" }) calls fetch with "/api/documents?type=issue"
     - fetchDocument("abc-123") calls fetch with "/api/documents/abc-123"
     - createDocument({ title: "Test", content: "", document_type: "doc" }) calls POST /api/documents with JSON body
     - updateDocument("abc-123", { title: "Updated" }) calls PUT /api/documents/abc-123
     - deleteDocument("abc-123") calls DELETE /api/documents/abc-123
     - fetchDocuments() throws with error message when response is not ok

5. Create ship/web/src/api/documents.ts:
   - Import { authFetch } from "../context/AuthContext"
   - Define interfaces: DocumentFilters { type?: string; status?: string }, DocumentInput { title: string; content?: string; document_type: string }, DocumentResponse { id: string; title: string; content: string; document_type: string; status: string; created_at: string; updated_at: string }
   - Export async functions: fetchDocuments(filters?), fetchDocument(id), createDocument(input), updateDocument(id, input), deleteDocument(id)
   - Each function uses authFetch, checks response.ok, throws on error
   - Build query params with URLSearchParams for filters
""",
    },
    {
        "id": 6,
        "name": "Create AccountabilityBanner component",
        "prompt": TDD_PREAMBLE + """\
Task: Create an AccountabilityBanner component in ship/web/src/components/AccountabilityBanner.tsx.

1. First, read existing components (DocumentList.tsx, Layout.tsx) for patterns.

2. Write tests in ship/web/src/__tests__/AccountabilityBanner.test.tsx:
   - Renders nothing when there are no overdue items
   - Renders a warning banner when there are overdue accountability items
   - Displays the count of overdue items
   - Renders each overdue item's title
   - Has a dismiss button that hides the banner

3. Implement the component:
   - Props: items (array of { id, title, assignee_id, status, due_date })
   - Show a yellow/amber banner at the top with TailwindCSS
   - Display "X items need attention" header
   - List each overdue item title
   - Dismiss button sets local state to hidden
   - If items is empty or all items are not overdue, render null
""",
    },
    {
        "id": 7,
        "name": "Develop AdminDashboard page",
        "prompt": TDD_PREAMBLE + """\
Task: Create an AdminDashboard page in ship/web/src/pages/AdminDashboardPage.tsx.

1. First, read DashboardPage.tsx and the existing page patterns.
2. Read ship/web/src/App.tsx to see how routes are configured.

3. Write tests in ship/web/src/__tests__/AdminDashboardPage.test.tsx:
   - Renders a loading state while data is fetching
   - Renders the dashboard with sections: "Programs Overview", "Accountability", "Recent Activity"
   - Renders the AccountabilityBanner when there are overdue items
   - Shows program count and active programs list

4. Implement the page:
   - Fetch from /api/dashboard/summary, /api/programs, /api/accountability using authFetch
   - Use useEffect + useState for data fetching (follow DashboardPage pattern)
   - Layout: grid with 3 sections using TailwindCSS
   - Include AccountabilityBanner at the top
   - Show programs overview with count cards
   - Show recent activity feed

5. Add the route to App.tsx:
   - Import AdminDashboardPage
   - Add route: /admin → AdminDashboardPage
""",
    },
    {
        "id": 8,
        "name": "Setup useDashboardActionItems hook",
        "prompt": TDD_PREAMBLE + """\
Task: Extract dashboard data fetching into a reusable hook: ship/web/src/hooks/useDashboardActionItems.ts.

1. First, read the AdminDashboardPage.tsx to see what data fetching logic to extract.

2. Write tests in ship/web/src/__tests__/useDashboardActionItems.test.ts:
   - Hook returns { actionItems, loading, error, refetch }
   - On mount, fetches from /api/dashboard/summary
   - Transforms summary.myWork into actionItems array
   - Each actionItem has: id, title, status, priority, projectTitle, type
   - Handles fetch errors gracefully (sets error, actionItems stays empty)
   - refetch() re-fetches the data

3. Implement the hook:
   - Use authFetch to call /api/dashboard/summary
   - Transform the response into a flat actionItems array
   - Return { actionItems, loading, error, refetch }
   - Export the hook and the ActionItem type

4. Refactor AdminDashboardPage to use this hook instead of inline fetching.
""",
    },
    {
        "id": 9,
        "name": "Implement bulk actions in BulkActionBar",
        "prompt": TDD_PREAMBLE + """\
Task: Create a BulkActionBar component in ship/web/src/components/BulkActionBar.tsx.

1. First, read DocumentList.tsx to understand the list component pattern.

2. Write tests in ship/web/src/__tests__/BulkActionBar.test.tsx:
   - Renders nothing when no items are selected (selectedIds is empty)
   - Shows "{count} selected" when items are selected
   - Has "Delete Selected" button that calls onBulkDelete with selected IDs
   - Has "Change Status" dropdown that calls onBulkStatusChange with selected IDs and new status
   - Has "Select All" / "Deselect All" toggle
   - "Delete Selected" shows a confirmation before executing

3. Implement the component:
   - Props: selectedIds (string[]), onBulkDelete(ids), onBulkStatusChange(ids, status), onSelectAll(), onDeselectAll(), totalCount (number)
   - Sticky bar at bottom of screen using TailwindCSS (fixed bottom-0)
   - Status options: open, in_progress, done, archived
   - Confirmation dialog for delete (simple window.confirm)
""",
    },
    {
        "id": 10,
        "name": "Expand document-tabs tests",
        "prompt": TDD_PREAMBLE + """\
Task: Add comprehensive test coverage for the documents API routes and the new components.

1. Read ship/api/src/__tests__/unified-document-model.test.ts to understand existing test patterns.

2. Add tests in ship/api/src/__tests__/documents-crud.test.ts:
   - POST /api/documents with missing title returns 400
   - POST /api/documents with invalid document_type returns 400
   - GET /api/documents?type=issue filters correctly
   - GET /api/documents?status=open filters correctly
   - PUT /api/documents/:id with no fields returns 400
   - DELETE /api/documents/:id on already-deleted doc returns 404
   - GET /api/documents/:id/associations returns related documents
   - GET /api/documents/:id/comments returns comments for that document

3. Add tests in ship/web/src/__tests__/DocumentList.test.tsx:
   - Renders a list of documents
   - Shows empty state when no documents
   - Clicking a document navigates to detail page
   - Supports selecting multiple documents (checkbox per row)
   - Renders BulkActionBar when items are selected

4. Run all tests:
   - Backend: run_command("npx vitest run") from ship/api/
   - Frontend: run_command("npx vitest run") from ship/web/
""",
    },
]

# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------


def run_task(task: dict, graph, trace_collector: TraceCollector) -> dict:
    """Run a single task through the supervisor graph."""
    print(f"\n{'='*70}")
    print(f"TASK {task['id']}: {task['name']}")
    print(f"{'='*70}\n")

    trace_collector.start_trace(f"task_{task['id']}_{task['name']}")
    start = time.time()

    result = graph.invoke({
        "messages": [HumanMessage(content=task["prompt"])],
        "context": "",
        "memories": "",
        "rules": "",
        "trace_steps": [],
        "tasks": [],
        "current_task_index": 0,
    })

    elapsed = time.time() - start
    last_msg = result["messages"][-1].content

    # Save trace
    trace_path = trace_collector.save_trace()

    # Save result to file
    result_file = Path(f"traces/task_{task['id']}_result.md")
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
    parser = argparse.ArgumentParser(description="Run Ship feature tasks through the Shipyard agent")
    parser.add_argument("--task", type=int, help="Run a specific task by ID (1-10)")
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
    summary_path = Path("traces/run_summary.json")
    summary_path.write_text(json.dumps(results, indent=2))
    print(f"\n\nRun summary saved to {summary_path}")
    print(f"Total tasks: {len(results)}")
    print(f"Total time: {sum(r['duration'] for r in results):.1f}s")


if __name__ == "__main__":
    main()

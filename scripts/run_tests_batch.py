"""Batch runner — generate tests for 5 routes missing test coverage.

Usage:
    python run_tests_batch.py                # run all
    python run_tests_batch.py --task 1       # run specific
    python run_tests_batch.py --dry-run      # print prompts only
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
IMPORTANT — Match the EXACT test pattern from ship/api/src/__tests__/auth.test.ts.

## Test Pattern (MUST follow exactly):
- Import from "vitest": { describe, it, expect, beforeAll, afterAll }
- Import request from "supertest"
- Import express from "express"
- Import pg from "pg"
- Create testPool: new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL || "postgresql://ship:ship@localhost:5433/ship_test" })
- Create mini express app: const app = express(); app.use(express.json());
- Wire the auth router AND the route under test into the app
- beforeAll: CREATE necessary tables (users, sessions, + route-specific tables)
- Register a test user, login to get session token
- Use .set("x-session-token", token) for authenticated requests
- afterAll: DROP tables CASCADE, pool.end()
- Use `const id = req.params.id as string;` pattern (NOT destructuring)

## Rules:
- Read the route file FIRST to understand endpoints and expected behavior
- Read ship/api/src/__tests__/auth.test.ts to copy the EXACT test setup pattern
- Test both authenticated and unauthenticated requests
- Test CRUD operations and edge cases
- Do NOT import from files that don't exist

"""

TASKS = [
    {
        "id": 1,
        "name": "Tests for org-chart route",
        "prompt": TDD_PREAMBLE + """\
Task: Write tests for ship/api/src/routes/org-chart.ts

Read the route file first to understand all endpoints.
Read ship/api/src/__tests__/auth.test.ts for the exact test pattern.

Create ship/api/src/__tests__/org-chart.test.ts:

Test cases:
- GET /api/org-chart without token → 401
- GET /api/org-chart with token → 200, returns { tree: [], departments: [] } (empty)
- GET /api/org-chart with users that have reports_to → returns tree structure
- GET /api/org-chart/user/:id → returns user with manager and direct_reports
- GET /api/org-chart/user/:nonexistent → 404
- PUT /api/org-chart/user/:id with { title, department } → 200, updates user
- PUT /api/org-chart/user/:id with { reports_to: self } → should handle gracefully

beforeAll: CREATE users table with title, department, reports_to columns. Insert 3 test users (one manager, two reports).
""",
    },
    {
        "id": 2,
        "name": "Tests for notifications route",
        "prompt": TDD_PREAMBLE + """\
Task: Write tests for ship/api/src/routes/notifications.ts

Read the route file first to understand all endpoints.
Read ship/api/src/__tests__/auth.test.ts for the exact test pattern.

Create ship/api/src/__tests__/notifications.test.ts:

Test cases:
- GET /api/notifications without token → 401
- GET /api/notifications with token → 200, returns { notifications: [], unread_count: 0 }
- POST /api/notifications creates a notification → 201
- GET /api/notifications returns the created notification
- GET /api/notifications/unread-count → returns { count: 1 }
- PATCH /api/notifications/:id/read → marks as read (200)
- GET /api/notifications/unread-count after read → { count: 0 }
- PATCH /api/notifications/read-all → marks all as read (200)
- GET /api/notifications?unread_only=true → returns only unread

beforeAll: CREATE users, sessions, notifications tables. Register test user + login.
""",
    },
    {
        "id": 3,
        "name": "Tests for settings route",
        "prompt": TDD_PREAMBLE + """\
Task: Write tests for ship/api/src/routes/settings.ts

Read the route file first to understand all endpoints.
Read ship/api/src/__tests__/auth.test.ts for the exact test pattern.

Create ship/api/src/__tests__/settings.test.ts:

Test cases:
- GET /api/settings without token → 401
- GET /api/settings with token → 200, returns defaults (theme: 'light', notifications_enabled: true, etc.)
- PUT /api/settings with { theme: 'dark' } → 200, returns updated settings
- GET /api/settings after update → returns { theme: 'dark', ... }
- PUT /api/settings with { notifications_enabled: false, email_digest: 'weekly' } → 200
- PUT /api/settings with invalid theme value → 400 or ignores invalid field
- PUT /api/settings with { default_view: 'kanban' } → 200

beforeAll: CREATE users, sessions, user_settings tables. Register test user + login.
""",
    },
    {
        "id": 4,
        "name": "Tests for setup route",
        "prompt": TDD_PREAMBLE + """\
Task: Write tests for ship/api/src/routes/setup.ts

Read the route file first to understand all endpoints.
Read ship/api/src/__tests__/auth.test.ts for the exact test pattern.

Create ship/api/src/__tests__/setup.test.ts:

Test cases:
- GET /api/setup/status without token → 401
- GET /api/setup/status with token → 200, returns { completed: false, steps: [...] }
- POST /api/setup/complete → 200, marks setup as done
- GET /api/setup/status after complete → { completed: true }
- Steps should reflect actual data: create_team done if teams exist, etc.

beforeAll: CREATE users, sessions, user_settings, teams, projects, standups tables. Register test user + login.
""",
    },
    {
        "id": 5,
        "name": "Tests for sprint-reviews route",
        "prompt": TDD_PREAMBLE + """\
Task: Write tests for ship/api/src/routes/sprint-reviews.ts

Read the route file first to understand all endpoints.
Read ship/api/src/__tests__/auth.test.ts for the exact test pattern.

Create ship/api/src/__tests__/sprint-reviews.test.ts:

Test cases:
- GET /api/sprint-reviews without token → 401
- GET /api/sprint-reviews with token → 200, returns empty array
- POST /api/sprint-reviews with { week_id, summary, accomplishments, challenges, next_steps, team_rating: 4 } → 201
- GET /api/sprint-reviews → returns array with 1 review, status 'draft'
- GET /api/sprint-reviews/:id → returns the specific review
- PUT /api/sprint-reviews/:id with { summary: 'Updated' } → 200
- PATCH /api/sprint-reviews/:id/submit → changes status to 'submitted', sets submitted_at
- PATCH /api/sprint-reviews/:id/submit on already submitted → 400
- DELETE /api/sprint-reviews/:id → 200 (soft delete)
- GET /api/sprint-reviews after delete → empty array

beforeAll: CREATE users, sessions, weeks, sprint_reviews tables. Register test user + login. Create a test week.
""",
    },
]

TASK_TIMEOUT = 600


def run_task(task, graph, trace_collector):
    print(f"\n{'='*70}")
    print(f"TASK {task['id']}: {task['name']}")
    print(f"{'='*70}\n")

    trace_collector.start_trace(f"tests_batch_{task['id']}_{task['name']}")
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
    print(f"\n{last_msg}")
    print(f"\n[Completed in {elapsed:.1f}s | trace: {trace_path}]")

    return {"id": task["id"], "name": task["name"], "duration": elapsed}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--task", type=int, help="Run specific task (1-5)")
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

    print(f"\n\nTotal tasks: {len(results)}")
    print(f"Total time: {sum(r['duration'] for r in results):.1f}s")


if __name__ == "__main__":
    main()

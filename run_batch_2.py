"""Batch runner 2 — fills remaining Ship feature gaps.

Features:
  1. MyWeek Page — personal weekly dashboard (standup + plan + retro in one view)
  2. Status Overview — project/team health metrics dashboard
  3. User Profile — profile page with edit capability
  4. Invitations — invite users to the app, accept invites
  5. Associations — link issues to projects, track relationships

Usage:
    python run_batch_2.py                # run all tasks
    python run_batch_2.py --task 1       # run specific task
    python run_batch_2.py --dry-run      # print prompts only
"""

import argparse
import json
import signal
import sys
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
- Use search_files to find existing test files, imports, and conventions.
- Read at least ONE existing file in the same directory to copy its exact structure.

## Step 2: Write tests FIRST, then implement
- For API tests: Copy pattern from ship/api/src/__tests__/auth.test.ts
- Use vitest + supertest + testPool pattern
- Use .set("x-session-token", token) for auth

## Step 3: Implement matching existing patterns
- Backend routes: use factory function pattern (export function createXRouter(pool))
- Register route in ship/api/src/app.ts with import + app.use line
- Frontend pages: add route in ship/web/src/App.tsx + nav in ship/web/src/components/Layout.tsx
- Use `const id = req.params.id as string;` for route params (NOT destructuring)
- Use `const val = req.query.field as string | undefined;` for query params

## Step 4: Verify
- Backend: run_command("npx tsc --noEmit") from ship/api/
- Frontend: run_command("npx tsc --noEmit") from ship/web/

"""

TASKS = [
    # =========================================================================
    # 1. MY WEEK PAGE
    # =========================================================================
    {
        "id": 1,
        "name": "MyWeek — personal weekly dashboard",
        "prompt": TDD_PREAMBLE + """\
Task: Build a MyWeek page that shows the current user's standup, weekly plan, and weekly retro in a single view.

## No new database tables needed — this aggregates existing data.

## Backend Route
Create ship/api/src/routes/my-week.ts:
- export function createMyWeekRouter(pool: pg.Pool): Router
- Apply auth middleware
- GET / — return current user's week summary
  - Query params: week_id (optional, defaults to current week)
  - Fetch from standups WHERE user_id = req.user.id AND standup_date = CURRENT_DATE
  - Fetch from weekly_plans WHERE user_id = req.user.id AND week_id = $1
  - Fetch from weekly_retros WHERE user_id = req.user.id AND week_id = $1
  - Also fetch current week from weeks table (latest by start_date)
  - Return: { week: {...}, standup: {...} | null, plan: {...} | null, retro: {...} | null }

Register in ship/api/src/app.ts:
- import { createMyWeekRouter } from "./routes/my-week.js";
- app.use("/api/my-week", createMyWeekRouter(pool));

## Frontend
Add to ship/web/src/api/client.ts:
- getMyWeek(weekId?: string): Promise<{ week: any, standup: any, plan: any, retro: any }>

Create ship/web/src/pages/MyWeekPage.tsx:
- Fetch from /api/my-week on mount
- Three-column layout (or stacked on mobile):
  - Left: Today's Standup (yesterday/today/blockers) with edit button
  - Center: Weekly Plan (plan_content, status) with submit button if draft
  - Right: Weekly Retro (went_well/to_improve/action_items) with submit button if draft
- If any section is null, show "+ Create" button
- Week selector at top (prev/next arrows + week label)
- Status indicators: draft=gray dot, submitted=blue dot, approved=green dot

Add route to ship/web/src/App.tsx: <Route path="my-week" element={<MyWeekPage />} />
Add to Layout.tsx nav: { path: '/my-week', label: 'My Week', icon: '📆' } — place near top, after Dashboard
""",
    },

    # =========================================================================
    # 2. STATUS OVERVIEW
    # =========================================================================
    {
        "id": 2,
        "name": "Status Overview — project and team health",
        "prompt": TDD_PREAMBLE + """\
Task: Build a Status Overview page showing project and team health metrics.

## No new database tables needed — this aggregates existing data.

## Backend Route
Create ship/api/src/routes/status-overview.ts:
- export function createStatusOverviewRouter(pool: pg.Pool): Router
- Apply auth middleware
- GET / — return aggregated status metrics
  - Issues by status: SELECT status, COUNT(*) FROM issues WHERE deleted_at IS NULL GROUP BY status
  - Issues by priority: SELECT priority, COUNT(*) FROM issues WHERE deleted_at IS NULL GROUP BY priority
  - Projects count: SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL
  - Teams count: SELECT COUNT(*) FROM teams WHERE deleted_at IS NULL
  - Active users (submitted standup today): SELECT COUNT(DISTINCT user_id) FROM standups WHERE standup_date = CURRENT_DATE AND deleted_at IS NULL
  - Pending reviews: SELECT COUNT(*) FROM weekly_plans WHERE status = 'submitted' AND deleted_at IS NULL
  - Return: { issues_by_status: {...}, issues_by_priority: {...}, project_count, team_count, active_users_today, pending_reviews }

Register in ship/api/src/app.ts:
- import { createStatusOverviewRouter } from "./routes/status-overview.js";
- app.use("/api/status-overview", createStatusOverviewRouter(pool));

## Frontend
Add to ship/web/src/api/client.ts:
- getStatusOverview(): Promise<StatusOverview>

Create ship/web/src/pages/StatusOverviewPage.tsx:
- Stat cards row: Projects (count), Teams (count), Active Today (count), Pending Reviews (count)
  - Each card: bg-white rounded-lg shadow-sm border p-6, icon + big number + label
- Issues by Status section: horizontal bar chart (CSS only, no chart library)
  - Each status gets a colored bar proportional to count, with label and number
  - Colors: triage=purple, backlog=gray, todo=blue, in_progress=yellow, in_review=indigo, done=green, cancelled=red
- Issues by Priority section: similar bar chart
  - Colors: low=gray, medium=blue, high=orange, urgent=red
- All data fetched from GET /api/status-overview

Add route to ship/web/src/App.tsx: <Route path="status" element={<StatusOverviewPage />} />
Add to Layout.tsx nav: { path: '/status', label: 'Status', icon: '📊' } — after Dashboard
""",
    },

    # =========================================================================
    # 3. USER PROFILE
    # =========================================================================
    {
        "id": 3,
        "name": "User Profile — view and edit profile",
        "prompt": TDD_PREAMBLE + """\
Task: Build a user profile page where users can view and edit their profile information.

## Database
Create migration ship/api/src/db/migrations/026_add_user_profile_fields.sql:
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(100) DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500) DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20) DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(100) DEFAULT '';
```

## Backend Route
Create ship/api/src/routes/profile.ts:
- export function createProfileRouter(pool: pg.Pool): Router
- Apply auth middleware
- GET / — get current user's profile
  - SELECT id, username, email, display_name, bio, avatar_url, phone, location, title, department, role, created_at FROM users WHERE id = req.user.id
  - Return user object
- PUT / — update current user's profile
  - Updatable fields: display_name, bio, avatar_url, phone, location
  - Do NOT allow updating username, email, or role via this endpoint
  - Return updated user
- GET /:id — get another user's public profile
  - Same fields but read-only
  - Return 404 if user not found

Register in ship/api/src/app.ts:
- import { createProfileRouter } from "./routes/profile.js";
- app.use("/api/profile", createProfileRouter(pool));

## Frontend
Add to ship/web/src/api/client.ts:
- getProfile(): Promise<UserProfile>
- updateProfile(data: { display_name?, bio?, avatar_url?, phone?, location? }): Promise<UserProfile>
- getUserProfile(id: string): Promise<UserProfile>

Create ship/web/src/pages/ProfilePage.tsx:
- Two modes: view and edit (toggle button)
- View mode:
  - Avatar placeholder (large circle with initials, or avatar_url if set)
  - Display name (large), username (gray, smaller)
  - Bio paragraph
  - Info grid: Email, Phone, Location, Department, Title
  - "Edit Profile" button
- Edit mode:
  - Form with inputs for: display_name, bio, phone, location
  - Avatar URL input
  - Save and Cancel buttons
  - Success banner on save

Add route to ship/web/src/App.tsx: <Route path="profile" element={<ProfilePage />} />
Add to Layout.tsx nav: { path: '/profile', label: 'Profile', icon: '👤' }
""",
    },

    # =========================================================================
    # 4. INVITATIONS
    # =========================================================================
    {
        "id": 4,
        "name": "Invitations — invite and accept users",
        "prompt": TDD_PREAMBLE + """\
Task: Build an invitation system to invite new users to the app.

## Database
Create migration ship/api/src/db/migrations/027_create_invitations.sql:
```sql
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  token VARCHAR(64) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  accepted_at TIMESTAMPTZ DEFAULT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);
```

## Backend Route
Create ship/api/src/routes/invitations.ts:
- export function createInvitationsRouter(pool: pg.Pool): Router
- Apply auth middleware (except GET /accept/:token)
- GET / — list all invitations (admin only, or invited_by = current user)
  - Join with users for invited_by username
  - Filter by deleted_at IS NULL, order by created_at DESC
- POST / — create invitation
  - Body: { email, role }
  - Generate random 64-char hex token
  - Check email not already invited (pending status)
  - Check email not already a registered user
  - Return 201 with invitation (include token in response)
- GET /accept/:token — accept an invitation (NO auth required)
  - Find invitation by token where status = 'pending' and expires_at > NOW()
  - Return 404 if not found or expired
  - Return invitation details (email, role) for the accept page to display
- POST /accept/:token — complete acceptance (NO auth required)
  - Body: { username, password }
  - Create user with the invitation's email and role
  - Update invitation status to 'accepted', set accepted_at
  - Return the created user
- DELETE /:id — revoke invitation (invited_by only)
  - Set status to 'revoked'

Register in ship/api/src/app.ts:
- import { createInvitationsRouter } from "./routes/invitations.js";
- app.use("/api/invitations", createInvitationsRouter(pool));

## Frontend
Add to ship/web/src/api/client.ts:
- getInvitations(): Promise<any[]>
- createInvitation(data: { email: string, role: string }): Promise<any>
- getInvitationByToken(token: string): Promise<any>
- acceptInvitation(token: string, data: { username: string, password: string }): Promise<any>
- revokeInvitation(id: string): Promise<void>

Create ship/web/src/pages/InvitationsPage.tsx:
- List of sent invitations with status badges (pending=yellow, accepted=green, expired=gray, revoked=red)
- "+ Invite User" button opens inline form: email input + role dropdown (member/admin)
- Each pending invitation shows: email, role, sent date, "Revoke" button
- Accepted invitations show: email, accepted date, username

Create ship/web/src/pages/AcceptInvitePage.tsx:
- Public page (no auth required) at route /invite/:token
- Fetches invitation details from GET /api/invitations/accept/:token
- If valid: shows form with email (pre-filled, disabled), username input, password input, "Join" button
- If expired/invalid: shows error message
- On success: redirects to /login

Add routes to App.tsx:
- <Route path="invitations" element={<InvitationsPage />} /> (inside Layout)
- <Route path="/invite/:token" element={<AcceptInvitePage />} /> (outside Layout, public)
Add to Layout.tsx nav: { path: '/invitations', label: 'Invitations', icon: '✉️' }
""",
    },

    # =========================================================================
    # 5. ASSOCIATIONS
    # =========================================================================
    {
        "id": 5,
        "name": "Associations — link entities together",
        "prompt": TDD_PREAMBLE + """\
Task: Build an associations system to link entities together (e.g., issue belongs to project).

## Database
Create migration ship/api/src/db/migrations/028_create_associations.sql:
```sql
CREATE TABLE IF NOT EXISTS associations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type VARCHAR(30) NOT NULL CHECK (source_type IN ('issue', 'project', 'document', 'ship', 'program')),
  source_id UUID NOT NULL,
  target_type VARCHAR(30) NOT NULL CHECK (target_type IN ('issue', 'project', 'document', 'ship', 'program', 'team')),
  target_id UUID NOT NULL,
  relationship VARCHAR(30) NOT NULL DEFAULT 'related' CHECK (relationship IN ('related', 'blocks', 'blocked_by', 'parent', 'child', 'implements', 'depends_on')),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_type, source_id, target_type, target_id, relationship)
);
CREATE INDEX IF NOT EXISTS idx_associations_source ON associations(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_associations_target ON associations(target_type, target_id);
```

## Backend Route
Create ship/api/src/routes/associations.ts:
- export function createAssociationsRouter(pool: pg.Pool): Router
- Apply auth middleware
- GET / — list associations for an entity
  - Query params: entity_type, entity_id (required)
  - Find all where (source_type, source_id) OR (target_type, target_id) matches
  - Return array of association objects with entity titles resolved via subquery
- POST / — create association
  - Body: { source_type, source_id, target_type, target_id, relationship }
  - Set created_by from req.user.id
  - Return 201, or 409 if duplicate
- DELETE /:id — remove association
  - Only creator can delete
  - Return 200

Register in ship/api/src/app.ts.

## Frontend
Add to ship/web/src/api/client.ts:
- getAssociations(entityType: string, entityId: string): Promise<any[]>
- createAssociation(data: { source_type, source_id, target_type, target_id, relationship }): Promise<any>
- deleteAssociation(id: string): Promise<void>

Create ship/web/src/components/AssociationsList.tsx:
- Props: entityType: string, entityId: string
- Fetch associations on mount
- Show list grouped by relationship type (Related, Blocks, Blocked By, etc.)
- Each item: entity type icon + title (linked) + relationship badge + delete button
- "+ Add Association" button opens a form:
  - Target type dropdown (issue, project, document, ship, program, team)
  - Target selector (search/dropdown of entities of that type)
  - Relationship dropdown
  - Save button

This component is meant to be embedded in detail pages (DocumentDetailPage, etc.), not a standalone page.
""",
    },
]

TASK_TIMEOUT = 600


def run_task(task, graph, trace_collector):
    print(f"\n{'='*70}")
    print(f"TASK {task['id']}: {task['name']}")
    print(f"{'='*70}\n")

    trace_collector.start_trace(f"batch2_task_{task['id']}_{task['name']}")
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
        last_msg = f"TIMEOUT: Task exceeded {TASK_TIMEOUT}s limit. Files may have been partially created."
        print(f"\n⚠️  {last_msg}")
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, old_handler)

    elapsed = time.time() - start
    trace_path = trace_collector.save_trace()

    result_file = Path(f"traces/batch2_task_{task['id']}_result.md")
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

    summary_path = Path("traces/batch2_run_summary.json")
    summary_path.write_text(json.dumps(results, indent=2))
    print(f"\n\nTotal tasks: {len(results)}")
    print(f"Total time: {sum(r['duration'] for r in results):.1f}s")


if __name__ == "__main__":
    main()

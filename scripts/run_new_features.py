"""Batch runner — feeds 6 new Ship features to the Shipyard agent.

Tests the reliability improvements (shared contract, smarter context,
project state scanner, enhanced verify_task) against real feature work.

Features:
  1. Activity Feed — recent changes across all entities
  2. File Attachments — upload files to issues/projects
  3. Sprint Reviews — iteration-level summaries
  4. Workspace Settings — user preferences, team config
  5. Notifications — in-app alerts for assignments, comments, reviews
  6. Org Chart — team hierarchy visualization

Usage:
    python run_new_features.py                # run all tasks sequentially
    python run_new_features.py --task 1       # run a specific task
    python run_new_features.py --dry-run      # print prompts without invoking
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
- CRITICAL: Read at least ONE existing file in the same directory to copy its exact structure.

## Step 2: Write a FAILING test FIRST (Red phase)
- Match the EXACT pattern of existing tests. Do NOT invent your own patterns.
- For API tests (ship/api/): Copy the pattern from ship/api/src/__tests__/auth.test.ts:
  - Import from "vitest": { describe, it, expect, beforeAll, afterAll }
  - Import request from "supertest"
  - Import express from "express"
  - Import pg from "pg"
  - Create a testPool with TEST_DATABASE_URL
  - Create a mini express app
  - Use .set("x-session-token", token) for auth
- For frontend tests (ship/web/): Use vitest with React Testing Library.

## Step 3: Implement the MINIMUM code to make the test pass (Green phase)
- Only write the code needed to pass the tests.
- Follow existing patterns in the codebase (read the neighboring files first).

## Step 4: Verify
- Backend: run_command("npx vitest run --reporter=verbose --passWithNoTests") from ship/api/
- Frontend: run_command("npx tsc --noEmit") from ship/web/

"""

# ---------------------------------------------------------------------------
# Task definitions
# ---------------------------------------------------------------------------

TASKS = [
    # =========================================================================
    # 1. ACTIVITY FEED
    # =========================================================================
    {
        "id": 1,
        "name": "Activity Feed — migration, API route, frontend page",
        "prompt": TDD_PREAMBLE + """\
Task: Build an Activity Feed that shows recent changes across all entities.

## Database
Create migration ship/api/src/db/migrations/020_create_activity_log.sql:
```sql
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'commented', 'status_changed', 'assigned')),
  entity_type VARCHAR(30) NOT NULL CHECK (entity_type IN ('issue', 'project', 'document', 'comment', 'standup', 'weekly_plan', 'weekly_retro')),
  entity_id UUID NOT NULL,
  entity_title VARCHAR(255) DEFAULT '',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);
```

## Backend Route
Create ship/api/src/routes/activity.ts:
- export function createActivityRouter(pool: pg.Pool): Router
- Apply auth middleware
- GET / — list recent activity. Query params: limit (default 50), offset, entity_type, user_id
  - Join with users: SELECT a.*, u.username FROM activity_log a JOIN users u ON a.user_id = u.id
  - ORDER BY created_at DESC
  - Return { activities: [...], total: count }
- GET /mine — list current user's activity only
- POST / — create activity entry (for internal use by other routes)
  - Body: { action, entity_type, entity_id, entity_title, metadata }
  - Set user_id from req.user.id

Wire into app.ts: app.use("/api/activity", createActivityRouter(pool));

## Frontend
Create ship/web/src/pages/ActivityPage.tsx:
- Fetch from /api/activity on mount
- Show activity items in a timeline layout:
  - Each item: avatar placeholder + "username action entity_type entity_title" + relative timestamp
  - Action verb mapping: created="created", updated="updated", deleted="deleted", commented="commented on", status_changed="changed status of", assigned="was assigned to"
  - Color coding by action: created=green, deleted=red, updated=blue, commented=purple, status_changed=yellow, assigned=indigo
- Filter tabs: All, Issues, Projects, Documents
- Pagination with "Load more" button

Add to ship/web/src/api/client.ts:
- getActivities(filters?: { limit?, offset?, entity_type?, user_id? }): Promise<{ activities: any[], total: number }>

Add route to App.tsx: <Route path="activity" element={<ActivityPage />} />
Add to Layout.tsx nav: { path: '/activity', label: 'Activity', icon: '📋' }
""",
    },

    # =========================================================================
    # 2. FILE ATTACHMENTS
    # =========================================================================
    {
        "id": 2,
        "name": "File Attachments — migration, upload API, frontend component",
        "prompt": TDD_PREAMBLE + """\
Task: Add file attachment support to issues and projects.

## Database
Create migration ship/api/src/db/migrations/021_create_attachments.sql:
```sql
CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('issue', 'project', 'document')),
  entity_id UUID NOT NULL,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes INTEGER NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id);
```

## Backend Route
Create ship/api/src/routes/attachments.ts:
- export function createAttachmentsRouter(pool: pg.Pool): Router
- Apply auth middleware
- GET /?entity_type=issue&entity_id=UUID — list attachments for an entity
  - Filter by deleted_at IS NULL
  - Return array of attachment records
- POST / — upload attachment (use express built-in for JSON metadata, store file info only — no actual file storage for MVP)
  - Body: { entity_type, entity_id, filename, original_name, mime_type, size_bytes }
  - Set uploaded_by from req.user.id
  - Return 201 with attachment record
- DELETE /:id — soft delete (set deleted_at)
  - Only the uploader can delete
  - Return 200

Wire into app.ts: app.use("/api/attachments", createAttachmentsRouter(pool));

## Frontend
Create ship/web/src/components/AttachmentList.tsx:
- Props: entityType: string, entityId: string
- Fetch attachments on mount from /api/attachments?entity_type=X&entity_id=Y
- Show list of files with: icon (based on mime_type), original_name, size (formatted), upload date
- Delete button (only shown for files uploaded by current user)
- "Attach file" button that opens a form to add metadata (MVP — no actual upload, just records)
- File type icons: 📄 for documents, 🖼️ for images, 📊 for spreadsheets, 📁 for others

Add to ship/web/src/api/client.ts:
- getAttachments(entityType: string, entityId: string): Promise<any[]>
- createAttachment(data: { entity_type, entity_id, filename, original_name, mime_type, size_bytes }): Promise<any>
- deleteAttachment(id: string): Promise<void>
""",
    },

    # =========================================================================
    # 3. SPRINT REVIEWS
    # =========================================================================
    {
        "id": 3,
        "name": "Sprint Reviews — migration, API, frontend page",
        "prompt": TDD_PREAMBLE + """\
Task: Build a Sprint Reviews feature for iteration-level summaries and retrospectives.

## Database
Create migration ship/api/src/db/migrations/022_create_sprint_reviews.sql:
```sql
CREATE TABLE IF NOT EXISTS sprint_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id UUID NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  summary TEXT NOT NULL DEFAULT '',
  accomplishments TEXT NOT NULL DEFAULT '',
  challenges TEXT NOT NULL DEFAULT '',
  next_steps TEXT NOT NULL DEFAULT '',
  team_rating INTEGER CHECK (team_rating BETWEEN 1 AND 5),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'finalized')),
  submitted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  UNIQUE(week_id, author_id)
);
CREATE INDEX IF NOT EXISTS idx_sprint_reviews_week ON sprint_reviews(week_id);
CREATE INDEX IF NOT EXISTS idx_sprint_reviews_author ON sprint_reviews(author_id);
```

## Backend Route
Create ship/api/src/routes/sprint-reviews.ts:
- export function createSprintReviewsRouter(pool: pg.Pool): Router
- Apply auth middleware
- GET / — list sprint reviews. Optional filters: week_id, status, author_id
  - Join with users and weeks tables for display names
  - Filter by deleted_at IS NULL
- GET /:id — get single sprint review
- POST / — create sprint review
  - Body: { week_id, summary, accomplishments, challenges, next_steps, team_rating }
  - Set author_id from req.user.id, status defaults to 'draft'
  - Use ON CONFLICT (week_id, author_id) DO UPDATE for upsert
- PUT /:id — update (author only)
- PATCH /:id/submit — change status to 'submitted', set submitted_at
  - Author only, must be in 'draft' status
- DELETE /:id — soft delete (author only)

Wire into app.ts: app.use("/api/sprint-reviews", createSprintReviewsRouter(pool));

## Frontend
Create ship/web/src/pages/SprintReviewsPage.tsx:
- List view of sprint reviews grouped by week
- Each review card shows: author, week label, status badge, team_rating as stars, summary preview
- Status badges: draft=gray, submitted=blue, finalized=green
- "+ New Review" button opens an inline form with:
  - Week selector dropdown (fetch from /api/weeks)
  - Summary textarea
  - Accomplishments textarea
  - Challenges textarea
  - Next Steps textarea
  - Team Rating: 1-5 star selector
  - Save (draft) and Submit buttons

Add to ship/web/src/api/client.ts:
- getSprintReviews(filters?): Promise<any[]>
- createSprintReview(data): Promise<any>
- updateSprintReview(id, data): Promise<any>
- submitSprintReview(id): Promise<any>
- deleteSprintReview(id): Promise<void>

Add route to App.tsx: <Route path="sprint-reviews" element={<SprintReviewsPage />} />
Add to Layout.tsx nav: { path: '/sprint-reviews', label: 'Sprint Reviews', icon: '🏁' }
""",
    },

    # =========================================================================
    # 4. WORKSPACE SETTINGS
    # =========================================================================
    {
        "id": 4,
        "name": "Workspace Settings — migration, API, settings page",
        "prompt": TDD_PREAMBLE + """\
Task: Build a Workspace Settings page for user preferences and team configuration.

## Database
Create migration ship/api/src/db/migrations/023_create_user_settings.sql:
```sql
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  theme VARCHAR(10) NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system')),
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  email_digest VARCHAR(10) NOT NULL DEFAULT 'daily' CHECK (email_digest IN ('none', 'daily', 'weekly')),
  default_view VARCHAR(10) NOT NULL DEFAULT 'list' CHECK (default_view IN ('list', 'kanban', 'calendar')),
  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Backend Route
Create ship/api/src/routes/settings.ts:
- export function createSettingsRouter(pool: pg.Pool): Router
- Apply auth middleware
- GET / — get current user's settings
  - If no row exists, return defaults: { theme: 'light', notifications_enabled: true, email_digest: 'daily', default_view: 'list', timezone: 'UTC' }
- PUT / — update current user's settings
  - Upsert: INSERT ... ON CONFLICT (user_id) DO UPDATE
  - Body: { theme?, notifications_enabled?, email_digest?, default_view?, timezone? }
  - Validate each field against its CHECK constraint values
  - Return updated settings

Wire into app.ts: app.use("/api/settings", createSettingsRouter(pool));

## Frontend
Create ship/web/src/pages/SettingsPage.tsx:
- Fetch settings on mount from GET /api/settings
- Form sections:
  1. **Appearance**: Theme toggle (Light / Dark / System) — radio buttons
  2. **Notifications**: Enable/disable toggle, Email digest frequency (None / Daily / Weekly)
  3. **Display**: Default view preference (List / Kanban / Calendar)
  4. **Regional**: Timezone dropdown (show common timezones: UTC, America/New_York, America/Chicago, America/Denver, America/Los_Angeles, Europe/London, Asia/Tokyo)
- Save button that calls PUT /api/settings
- Success toast: "Settings saved" (just a green banner that fades after 3s)
- Page layout: max-w-2xl mx-auto, sections separated by borders

Add to ship/web/src/api/client.ts:
- getUserSettings(): Promise<UserSettings>
- updateUserSettings(data: Partial<UserSettings>): Promise<UserSettings>

Add route to App.tsx: <Route path="settings" element={<SettingsPage />} />
Add to Layout.tsx nav: { path: '/settings', label: 'Settings', icon: '⚙️' }
""",
    },

    # =========================================================================
    # 5. NOTIFICATIONS
    # =========================================================================
    {
        "id": 5,
        "name": "Notifications — migration, API, bell icon with dropdown",
        "prompt": TDD_PREAMBLE + """\
Task: Build in-app notifications for assignments, comments, reviews, and mentions.

## Database
Create migration ship/api/src/db/migrations/024_create_notifications.sql:
```sql
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL CHECK (type IN ('assignment', 'comment', 'review_request', 'review_decision', 'mention', 'status_change')),
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  entity_type VARCHAR(30) DEFAULT NULL,
  entity_id UUID DEFAULT NULL,
  read_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;
```

## Backend Route
Create ship/api/src/routes/notifications.ts:
- export function createNotificationsRouter(pool: pg.Pool): Router
- Apply auth middleware
- GET / — list notifications for current user
  - Query params: unread_only (boolean), limit (default 20), offset
  - ORDER BY created_at DESC
  - Return { notifications: [...], unread_count: number }
- GET /unread-count — return { count: number } for badge display
- POST / — create notification (internal use)
  - Body: { user_id, type, title, body, entity_type, entity_id }
- PATCH /:id/read — mark as read (set read_at = NOW())
  - Must be the notification's user_id
- PATCH /read-all — mark all as read for current user
  - UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL

Wire into app.ts: app.use("/api/notifications", createNotificationsRouter(pool));

## Frontend
Create ship/web/src/components/NotificationBell.tsx:
- Polls GET /api/notifications/unread-count every 30 seconds
- Shows bell icon (🔔) with red badge showing unread count (hidden if 0)
- On click: toggles a dropdown panel (absolute positioned, right-aligned)
- Dropdown: fetches GET /api/notifications?limit=10
  - Each notification: title, body preview (truncated), relative time, read/unread dot
  - Click notification: marks as read + navigates to entity (if entity_type/entity_id set)
  - "Mark all as read" link at bottom
  - "View all" link → /notifications
- Close dropdown when clicking outside

Create ship/web/src/pages/NotificationsPage.tsx:
- Full list of all notifications with pagination
- Filter tabs: All, Unread
- Each notification card: type icon, title, body, timestamp, read/unread status
- Type icons: assignment=👤, comment=💬, review_request=📝, review_decision=✅, mention=@, status_change=🔄
- "Mark all as read" button

Add NotificationBell to Layout.tsx header (top-right, next to user info).

Add to ship/web/src/api/client.ts:
- getNotifications(filters?): Promise<{ notifications: any[], unread_count: number }>
- getUnreadCount(): Promise<{ count: number }>
- markNotificationRead(id: string): Promise<void>
- markAllNotificationsRead(): Promise<void>
- createNotification(data): Promise<any>

Add route to App.tsx: <Route path="notifications" element={<NotificationsPage />} />
""",
    },

    # =========================================================================
    # 6. ORG CHART
    # =========================================================================
    {
        "id": 6,
        "name": "Org Chart — migration, API, tree visualization",
        "prompt": TDD_PREAMBLE + """\
Task: Build an Org Chart showing team hierarchy with reporting relationships.

## Database
Create migration ship/api/src/db/migrations/025_add_org_chart_fields.sql:
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS title VARCHAR(100) DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100) DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS reports_to UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_reports_to ON users(reports_to);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);
```

## Backend Route
Create ship/api/src/routes/org-chart.ts:
- export function createOrgChartRouter(pool: pg.Pool): Router
- Apply auth middleware
- GET / — return full org tree
  - Query all users: SELECT id, username, email, title, department, reports_to FROM users
  - Build tree structure in code: find roots (reports_to IS NULL), recursively attach children
  - Return { tree: [...], departments: string[] }
- GET /user/:id — return a user's direct reports and manager
  - Return { user: {...}, manager: {...} | null, direct_reports: [...] }
- PUT /user/:id — update org chart fields (admin only or self)
  - Body: { title?, department?, reports_to? }
  - Prevent circular reporting (user can't report to themselves or their reports)
  - Return updated user

Wire into app.ts: app.use("/api/org-chart", createOrgChartRouter(pool));

## Frontend
Create ship/web/src/pages/OrgChartPage.tsx:
- Fetch org tree from GET /api/org-chart
- Two view modes: Tree view and List view (toggle button)

**Tree view:**
- Render hierarchical card layout using CSS flexbox
- Each person card: name (bold), title (gray), department badge
- Lines connecting manager to reports (use border-left + border-top CSS trick)
- Root nodes at top, reports below
- Expandable/collapsible nodes (click to toggle children)

**List view:**
- Table: Name, Title, Department, Reports To, Direct Reports count
- Sortable by each column
- Filter by department (dropdown)

**Person card component** (ship/web/src/components/OrgCard.tsx):
- Props: user: { id, username, title, department, reports_to }
- Avatar placeholder (first letter of username in colored circle)
- Username in bold
- Title in text-gray-600
- Department as small badge (bg-blue-100 text-blue-800)
- Click → expand to show edit form (title, department, reports_to dropdown)

Add to ship/web/src/api/client.ts:
- getOrgChart(): Promise<{ tree: any[], departments: string[] }>
- getOrgUser(id: string): Promise<{ user: any, manager: any, direct_reports: any[] }>
- updateOrgUser(id: string, data: { title?, department?, reports_to? }): Promise<any>

Add route to App.tsx: <Route path="org-chart" element={<OrgChartPage />} />
Add to Layout.tsx nav: { path: '/org-chart', label: 'Org Chart', icon: '🏢' }
""",
    },
]

# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------


TASK_TIMEOUT = 600  # 10 minutes per task


def run_task(task: dict, graph, trace_collector: TraceCollector) -> dict:
    """Run a single task through the supervisor graph."""
    import signal

    print(f"\n{'='*70}")
    print(f"TASK {task['id']}: {task['name']}")
    print(f"{'='*70}\n")

    trace_collector.start_trace(f"new_feature_task_{task['id']}_{task['name']}")
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

    # Save trace
    trace_path = trace_collector.save_trace()

    # Save result to file
    result_file = Path(f"traces/new_feature_task_{task['id']}_result.md")
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
    parser = argparse.ArgumentParser(description="Run new feature tasks through the Shipyard agent")
    parser.add_argument("--task", type=int, help="Run a specific task by ID (1-6)")
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

    # Always use the script's directory as workspace root, not CWD
    # (CWD can shift if user runs `cd ship/web && npx tsc` before this script)
    set_workspace(Path(__file__).resolve().parent)
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
    summary_path = Path("traces/new_features_run_summary.json")
    summary_path.write_text(json.dumps(results, indent=2))
    print(f"\n\nRun summary saved to {summary_path}")
    print(f"Total tasks: {len(results)}")
    print(f"Total time: {sum(r['duration'] for r in results):.1f}s")


if __name__ == "__main__":
    main()

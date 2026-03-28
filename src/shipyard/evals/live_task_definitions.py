"""Live evaluation tasks — run against the real Ship codebase with real LLM calls.

These tasks test the actual failure modes observed in the kanban/standups sprint:
- Schema/contract blindness: does the agent use exact values from the prompt?
- Pattern following: does the agent match existing codebase conventions?
- Compilation: does the generated code compile?
- Migration correctness: does the migration follow existing conventions?

Usage:
    python -m shipyard.evals --live    # runs these tasks (costs ~$2-3)
"""

from shipyard.evals.tasks import EvalTask, Expectation

LIVE_EVAL_TASKS: list[EvalTask] = [
    # =========================================================================
    # CONTRACT ADHERENCE — does the agent use exact values from the prompt?
    # =========================================================================
    EvalTask(
        name="contract_enum_values",
        category="contract_adherence",
        instruction=(
            'Create a new file ship/api/src/routes/notifications.ts with an Express route.\n'
            'It MUST have: VALID_TYPES = ["email", "sms", "push", "webhook"]\n'
            'It MUST export: export function createNotificationsRouter(pool: pg.Pool): Router\n'
            'Endpoints: GET / (list all), POST / (create with type, recipient, message fields)\n'
            'Validate type against VALID_TYPES. Return 400 for invalid type.\n'
            'Follow the exact pattern of existing routes in ship/api/src/routes/.\n'
            'Do NOT create tests or migrations. Just the route file.'
        ),
        setup_files=[],
        expectations=[
            Expectation(type="file_exists", path="ship/api/src/routes/notifications.ts"),
            Expectation(type="file_contains", path="ship/api/src/routes/notifications.ts", value='"email"'),
            Expectation(type="file_contains", path="ship/api/src/routes/notifications.ts", value='"sms"'),
            Expectation(type="file_contains", path="ship/api/src/routes/notifications.ts", value='"push"'),
            Expectation(type="file_contains", path="ship/api/src/routes/notifications.ts", value='"webhook"'),
            Expectation(type="file_not_contains", path="ship/api/src/routes/notifications.ts", value="export default"),
        ],
        live=True,
    ),
    EvalTask(
        name="contract_field_names",
        category="contract_adherence",
        instruction=(
            'Create a new file ship/api/src/routes/retrospectives.ts with an Express route.\n'
            'It MUST export: export function createRetrospectivesRouter(pool: pg.Pool): Router\n'
            'POST / creates a retrospective with these exact fields: went_well (TEXT), to_improve (TEXT), action_items (TEXT)\n'
            'Do NOT use fields named "title", "content", "description", or "body".\n'
            'Follow the exact pattern of existing routes in ship/api/src/routes/.\n'
            'Do NOT create tests or migrations. Just the route file.'
        ),
        setup_files=[],
        expectations=[
            Expectation(type="file_exists", path="ship/api/src/routes/retrospectives.ts"),
            Expectation(type="file_contains", path="ship/api/src/routes/retrospectives.ts", value="went_well"),
            Expectation(type="file_contains", path="ship/api/src/routes/retrospectives.ts", value="to_improve"),
            Expectation(type="file_contains", path="ship/api/src/routes/retrospectives.ts", value="action_items"),
            Expectation(type="file_not_contains", path="ship/api/src/routes/retrospectives.ts", value="export default"),
        ],
        live=True,
    ),

    # =========================================================================
    # PATTERN FOLLOWING — does the agent match existing codebase conventions?
    # =========================================================================
    EvalTask(
        name="route_export_pattern",
        category="pattern_following",
        instruction=(
            'Create a new API route file at ship/api/src/routes/sprints.ts.\n'
            'It MUST follow the EXACT pattern used by other route files in ship/api/src/routes/.\n'
            'Read ship/api/src/routes/teams.ts first to understand the pattern.\n'
            'The route should have: GET / (list), POST / (create with title, start_date, end_date), DELETE /:id (soft delete)\n'
            'Do NOT create tests or migrations. Just the route file.'
        ),
        setup_files=[],
        expectations=[
            Expectation(type="file_exists", path="ship/api/src/routes/sprints.ts"),
            Expectation(
                type="file_matches_pattern",
                path="ship/api/src/routes/sprints.ts",
                value=r"export function create\w+Router\(pool:\s*pg\.Pool\):\s*Router",
            ),
            Expectation(type="file_contains", path="ship/api/src/routes/sprints.ts", value='import pg from "pg"'),
            Expectation(type="file_contains", path="ship/api/src/routes/sprints.ts", value="deleted_at"),
            Expectation(type="file_not_contains", path="ship/api/src/routes/sprints.ts", value="export default"),
            Expectation(type="file_not_contains", path="ship/api/src/routes/sprints.ts", value="new Pool"),
        ],
        live=True,
    ),
    EvalTask(
        name="component_pattern",
        category="pattern_following",
        instruction=(
            'Create a new React component at ship/web/src/components/StatusBadge.tsx.\n'
            'Read ship/web/src/components/DocumentForm.tsx first to understand the component pattern.\n'
            'Props: status (string), size ("sm" | "md" | "lg", default "md")\n'
            'Renders a colored badge span with the status text. Use TailwindCSS classes.\n'
            'Export as default. Do NOT create tests.'
        ),
        setup_files=[],
        expectations=[
            Expectation(type="file_exists", path="ship/web/src/components/StatusBadge.tsx"),
            Expectation(type="file_contains", path="ship/web/src/components/StatusBadge.tsx", value="status"),
            Expectation(type="file_contains", path="ship/web/src/components/StatusBadge.tsx", value="size"),
            Expectation(
                type="file_matches_pattern",
                path="ship/web/src/components/StatusBadge.tsx",
                value=r"export default",
            ),
        ],
        live=True,
    ),

    # =========================================================================
    # COMPILATION — does the generated code compile?
    # =========================================================================
    EvalTask(
        name="backend_compilation",
        category="compilation",
        instruction=(
            'Create a new API route file at ship/api/src/routes/activity.ts.\n'
            'It MUST export: export function createActivityRouter(pool: pg.Pool): Router\n'
            'Endpoints: GET / (list activity entries), GET /:id (single entry)\n'
            'Follow the exact pattern of existing routes. Use proper TypeScript types.\n'
            'Do NOT create tests or migrations. Just the route file.'
        ),
        setup_files=[],
        expectations=[
            Expectation(type="file_exists", path="ship/api/src/routes/activity.ts"),
            Expectation(
                type="file_matches_pattern",
                path="ship/api/src/routes/activity.ts",
                value=r"export function createActivityRouter",
            ),
            Expectation(type="command_succeeds", value="cd ship/api && npx tsc --noEmit"),
        ],
        live=True,
    ),
    EvalTask(
        name="frontend_compilation",
        category="compilation",
        instruction=(
            'Create a new React component at ship/web/src/components/ProgressBar.tsx.\n'
            'Props: value (number 0-100), label (string, optional), color (string, default "blue")\n'
            'Renders a horizontal progress bar with TailwindCSS.\n'
            'Use proper TypeScript types for all props. Export as default.\n'
            'Do NOT create tests.'
        ),
        setup_files=[],
        expectations=[
            Expectation(type="file_exists", path="ship/web/src/components/ProgressBar.tsx"),
            Expectation(type="file_contains", path="ship/web/src/components/ProgressBar.tsx", value="value"),
            Expectation(type="command_succeeds", value="cd ship/web && npx tsc -b"),
        ],
        live=True,
    ),

    # =========================================================================
    # MIGRATION CORRECTNESS — does it follow existing conventions?
    # =========================================================================
    EvalTask(
        name="migration_conventions",
        category="migration_correctness",
        instruction=(
            'Create a new migration at ship/api/src/db/migrations/015_create_activity_log.sql.\n'
            'Read the existing migration files first to understand the conventions.\n'
            'Table: activity_log with columns:\n'
            '  - id (UUID primary key with gen_random_uuid default)\n'
            '  - user_id (UUID, references users, ON DELETE CASCADE)\n'
            '  - action (VARCHAR(100), NOT NULL)\n'
            '  - entity_type (VARCHAR(50), NOT NULL)\n'
            '  - entity_id (UUID)\n'
            '  - created_at (TIMESTAMPTZ, default NOW)\n'
            'Add an index on user_id and created_at.\n'
            'Use IF NOT EXISTS. Do NOT create route files or tests.'
        ),
        setup_files=[],
        expectations=[
            Expectation(type="file_exists", path="ship/api/src/db/migrations/015_create_activity_log.sql"),
            Expectation(type="file_contains", path="ship/api/src/db/migrations/015_create_activity_log.sql", value="gen_random_uuid()"),
            Expectation(type="file_contains", path="ship/api/src/db/migrations/015_create_activity_log.sql", value="TIMESTAMPTZ"),
            Expectation(type="file_contains", path="ship/api/src/db/migrations/015_create_activity_log.sql", value="IF NOT EXISTS"),
            Expectation(type="file_contains", path="ship/api/src/db/migrations/015_create_activity_log.sql", value="ON DELETE CASCADE"),
            Expectation(type="file_not_contains", path="ship/api/src/db/migrations/015_create_activity_log.sql", value="SERIAL"),
            Expectation(type="file_not_contains", path="ship/api/src/db/migrations/015_create_activity_log.sql", value="TIMESTAMP)"),
        ],
        live=True,
    ),
]

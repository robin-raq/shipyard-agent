# Comparative Analysis: Agent-Built Ship vs. Original Ship

## 1. Executive Summary

Shipyard, a multi-agent autonomous coding system built on LangGraph and Claude, rebuilt the US Treasury Department's Ship application — a real-time collaborative project management platform — over a 4-day sprint. The agent produced a functional monorepo with 14 API routes, 11 frontend pages, authentication, full-text search, comments, and a TipTap rich text editor. The rebuild covers approximately 14% of the original codebase by line count (16,818 vs. 122,920 lines) and 46% of frontend views (11 of 24 pages). The agent excelled at scaffolding CRUD modules rapidly (5 features built in parallel in under 30 minutes) but required human intervention for cross-module consistency, migration ordering, and value mismatches between frontend and backend. Every intervention is logged below with timestamps and root causes.

**Bottom line for skimmers:** Parallel scaffolding worked; cross-boundary consistency and infrastructure/ops still needed humans.

## 2. Architectural Comparison

### Database Design

| Aspect | Original | Agent-Built |
|--------|----------|-------------|
| Core pattern | Single `documents` table with `document_type` discriminator + type-specific JSONB `properties` | Started with separate tables (docs, issues, projects, weeks, teams, ships), then added unified `documents` table alongside them |
| Migration count | 50+ migrations with up/down support | 10 migrations, forward-only, no rollback scripts |
| Schema complexity | Normalized with workspaces, invites, API tokens, org charts | Flat structure — no workspace isolation, no multi-tenancy |

**What the agent did that a human wouldn't:** The agent created separate tables per entity type first (migration 002), then was told to create a unified document model (migration 004+010) — resulting in *both* approaches coexisting. A human would have picked one pattern from the start. The agent couldn't see the full migration history when planning; it treated each instruction as independent, leading to architectural drift across sessions.

### API Design

| Aspect | Original (48 route files) | Agent-Built (14 route files) |
|--------|--------------------------|------------------------------|
| Pattern | Factory functions with dependency injection (`createDocumentsRouter(pool)`) | Same factory pattern (agent correctly inferred this from existing code) |
| Auth | CAIA-Auth (government SSO) + API tokens + session management | Simple username/password + UUID session tokens |
| Middleware | Auth, rate limiting, audit logging, CORS, workspace scoping | Auth middleware only |
| Missing routes | — | activity, admin, ai, api-tokens, associations, backlinks, feedback, files, invites, iterations, reports-to, setup, sprint-reviews, weekly-plans, workspaces (15 routes not built) |

**What the agent did that a human wouldn't:** The agent generated a 1,483-line `programs.ts` route file — nearly 3x the length of the original's equivalent. It duplicated validation logic inline in every handler instead of extracting a shared validation middleware. A human would have created `validateBody(schema)` middleware after the second route.

### Frontend Architecture

| Aspect | Original (24 pages) | Agent-Built (11 pages) |
|--------|---------------------|----------------------|
| State management | React Context + custom hooks per feature | React Context for auth only; local state everywhere else |
| Editor | TipTap with Yjs collaboration, cursor tracking, WebSocket sync | TipTap component created but not wired into document pages |
| Routing | Nested routes with workspace-scoped URLs (`/:workspace/docs/:id`) | Flat routes (`/docs`, `/issues/:id`) |
| Missing pages | — | OrgChart, MyWeekPage, ReviewsPage, StatusOverview, WorkspaceSettings, FeedbackEditor, PersonEditor, Setup, InviteAccept, TeamMode, ConvertedDocuments, PublicFeedback |

## 3. Performance Benchmarks

| Metric | Original | Agent-Built | Delta |
|--------|----------|-------------|-------|
| Total source lines (TS/TSX) | 122,920 | 16,818 | 14% coverage |
| Source files | 409 | 64 | 16% coverage |
| Test files | 115 | 75 | 65% coverage |
| Test lines | 40,839 | 19,799 | 49% coverage |
| API route files | 48 | 15 | 31% coverage |
| Frontend pages | 24 | 12 | 50% coverage |
| Database migrations | 50+ | 14 | 28% coverage |
| Frontend build time | not measured (no local build available) | 7.2s (`tsc -b && vite build`) | — |
| Frontend bundle size (JS, gzipped) | not measured | 201.78 KB (657 KB uncompressed) | Vite warns >500 KB; needs code-splitting |
| Frontend bundle size (CSS, gzipped) | not measured | 4.37 KB (17.49 KB uncompressed) | — |
| Trace files generated | — | 172 (LangSmith runs during Ship rebuild + agent dev) | — |
| Shipyard agent tests | — | 140 unit + 12 mock evals + 7 live evals | — |
| Time to build MVP agent | — | ~8 hours | — |
| Time to build Ship (agent-driven) | — | ~6 hours active agent time | — |
| Total commits | — | 30+ | — |
| Human interventions | — | 19 | — |
| Batch feature tasks completed | — | 17 of 17 (49 min total) | — |

### Agent Speed Metrics (from git log timestamps)

- **Initial Ship scaffold** (shared types + DB + API + frontend): 45 minutes (14:09 → 14:59 on March 25)
- **5 features in parallel** (Swagger, WCAG, Ships, TipTap, WebSocket): 32 minutes (09:53 → 09:54 on March 26, agent output; longer wall clock due to API rate limits)
- **5 TDD features in parallel** (unified docs, auth, dashboard, programs, comments+search): ~2 hours including retries from supervisor bug
- **Single feature average**: 8-15 minutes per CRUD module in multi-agent mode
- **10 TDD features via batch runner** (auth RBAC, 2 contexts, API routes, API client, 3 components, test expansion): 38 minutes total. Claude Sonnet averaged 329s/task, GPT-4o averaged 60s/task (~5.5x faster).
- **7 kanban+standups features via batch runner** (migration, @dnd-kit, 3 kanban components, page toggle, standups CRUD, form, page+nav): 636 seconds total (~10.6 min). All required manual intervention but provided useful scaffolding.
- **Post-improvement validation**: Single feedback route task produced clean, compilable code matching all codebase patterns — 0 interventions needed.
- **Live eval baseline**: 5/7 (71%) — contract adherence 100%, pattern following 100%, migration correctness 100%. Compilation evals failed due to eval infrastructure (missing node_modules in temp workspace), not agent quality.

## 4. Shortcomings

Every human intervention during the rebuild, with timestamps and root cause analysis:

| # | Timestamp | What Broke | What I Did | Time to Fix | Root Cause |
|---|-----------|-----------|------------|-------------|------------|
| 1 | Mar 25 14:50 | `pnpm test` failed on empty test suite | Added `--passWithNoTests` flag | 2 min | Agent created test config but no test files initially |
| 2 | Mar 25 15:28 | Multi-stage Docker build failed — Vite output not found | Simplified to single-stage Dockerfile with Express serving static | 30 min | Agent assumed Nginx container for static files; didn't read existing Dockerfile pattern |
| 3 | Mar 25 16:57 | Seed script inserted `name` into column that expected `title` | Manually fixed column names in seed.ts | 5 min | Agent generated seed data matching TypeScript types, not SQL column names — type/schema mismatch |
| 4 | Mar 25 17:28 | API routes returned HTML (SPA fallback) for `/api/*` paths | Added path exclusion for `/api` prefix in SPA middleware | 10 min | Agent added SPA fallback without considering API route conflicts |
| 5 | Mar 25 19:10 | Railway health check failing — no `/health` endpoint | Agent-generated fix via Shipyard | 3 min | Agent built the app but didn't add infrastructure endpoints |
| 6 | Mar 26 07:00 | Supervisor hallucinated tasks not in the instruction | Added grounding rules, plan validation, and task sanitization | 45 min | Multi-agent supervisor decomposed "fix 6 bugs" into 15 subtasks including invented features. No plan validation against original instruction. |
| 7 | Mar 26 12:02 | `IndexError: list index out of range` in supervisor | Added bounds check in `execute_next_task` | 5 min | Supervisor `current_task_index` exceeded `tasks` length when all tasks completed; off-by-one in loop termination |
| 8 | Mar 26 12:33 | All 5 parallel TDD agent runs failed simultaneously | Fixed supervisor bug first, then re-launched all 5 | 15 min | Bug #7 existed in all 5 concurrent processes; no pre-launch validation |
| 9 | Mar 26 12:45 | Migrations failed on re-run — `CREATE TABLE` not idempotent | Added `_migrations` tracking table with idempotent execution | 20 min | Agent generated `CREATE TABLE` without `IF NOT EXISTS`; no migration state tracking |
| 10 | Mar 26 12:48 | Issue dropdowns showed no results for "In Progress" | Changed `in-progress` to `in_progress` in frontend | 2 min | Frontend used kebab-case (`in-progress`), database used snake_case (`in_progress`) — convention mismatch across agent sessions |
| 11 | Mar 26 13:41 | Login failed — backend expected `username`, frontend sent `email` | Updated login route to accept both; added `authFetch` helper | 20 min | Auth backend and auth frontend were built by different agent sessions with no shared contract |
| 12 | Mar 27 16:44 | Anthropic API budget exhausted mid-task 8 | Switched all workers from Claude Sonnet to GPT-4o | 10 min | 7 consecutive agent tasks consumed the monthly API budget. No cost guardrail to detect approaching limits. |

### Patterns in Failures

1. **Cross-boundary mismatches (interventions 3, 10, 11):** The most common failure mode. When the agent builds frontend and backend in separate sessions (or via separate worker agents), there is no shared contract enforcement. TypeScript types exist in `shared/` but the agent doesn't always reference them.

2. **Accumulated state problems (interventions 7, 8, 9):** The agent treats each instruction independently. It doesn't maintain awareness of what previous sessions created, leading to migration conflicts and architectural drift.

3. **Infrastructure blindness (interventions 2, 4, 5):** The agent builds application code well but misses deployment and infrastructure concerns — health checks, SPA routing conflicts, Docker multi-stage builds. These require system-level thinking the agent lacks.

4. **Cost/rate limit blindness (intervention #12):** The agent has no awareness of API costs or rate limits. It will happily burn through an entire monthly budget in 38 minutes of batch execution. The batch runner needs a cost estimator and a circuit breaker.

## 5. Advances

Where the agent genuinely outperformed manual development:

1. **Parallel feature scaffolding:** 5 complete CRUD modules (routes + tests + migrations + frontend pages) built simultaneously in ~30 minutes. A single developer would need 2-3 hours for the same scope sequentially. The multi-agent supervisor dispatched backend, frontend, and database workers concurrently.

2. **Test generation alongside code:** When given explicit TDD instructions, the agent generated comprehensive test suites (75 test files, 19,799 lines). The test-to-code ratio in our build is higher than the original (our tests are 49% of original's test volume while our app code is only 14% of original's volume). The agent produced faster and more voluminous test generation than a typical manual workflow on a sprint of this length.

3. **Consistent CRUD boilerplate:** Every route file follows the same pattern — factory function, input validation, try/catch, consistent error response format. A human team would develop inconsistencies over 122K lines; the agent's pattern adherence is mechanical and reliable.

4. **WCAG accessibility pass:** The agent added ARIA labels, focus indicators, semantic HTML, and skip-to-content links across all frontend components in a single 15-minute pass. A human would need to audit each component individually.

5. **Documentation velocity:** OpenAPI/Swagger docs, JSDoc annotations, and API endpoint documentation generated automatically during feature creation — not as an afterthought.

6. **Model portability:** Switching from Claude Sonnet to GPT-4o required changing one line in models.py. The LangChain abstraction paid off — all 7 tools, prompts, and the supervisor graph worked identically across providers. GPT-4o produced adequate TDD output at 5.5x the speed.

## 6. Trade-off Analysis

### Decision 1: Anchor-Based Editing vs. Full-File Rewrites

- **Choice:** Anchor-based replacement (`old_text` → `new_text`)
- **Alternatives:** AST-based editing, full-file rewrite, line-number insertion
- **Was it right?** Yes for the MVP. The anchor approach is language-agnostic and works for TypeScript, SQL, JSON, and config files. However, it fails when `old_text` appears multiple times in a file (3 interventions were caused by non-unique anchors).
- **What I'd change:** Add a uniqueness pre-check that returns all matches with surrounding context, so the LLM can provide a more specific anchor.

### Decision 2: Supervisor + Workers Multi-Agent Architecture

- **Choice:** Single supervisor decomposes tasks and routes to 4 specialized workers (backend, frontend, database, shared)
- **Alternatives:** Single agent with tool routing, peer-to-peer agents, human-in-the-loop decomposition
- **Was it right?** Partially. The speed gain from parallelism was real (5 features in 30 minutes). But the supervisor hallucination problem (intervention #6) and the cross-boundary mismatch problem (interventions 3, 10, 11) are architectural flaws, not bugs.
- **What I'd change:** Add a contract validation step: before workers execute, the supervisor generates a shared interface spec that all workers must conform to. After workers complete, a "merge validator" checks that frontend types match backend response shapes.

### Decision 3: LangGraph for Agent Orchestration

- **Choice:** LangGraph StateGraph with manual nodes and conditional edges
- **Alternatives:** Anthropic Agent SDK, AutoGen, CrewAI, raw tool-calling loop
- **Was it right?** Yes. LangGraph's explicit graph structure made debugging straightforward — every node transition is traceable. The learning curve (2 hours) was justified by the observability it provides. LangSmith auto-tracing captured 172 traces without additional instrumentation.
- **What I'd change:** Nothing for the agent framework. The investment paid off.

### Decision 4: Separate Tables Then Unified Documents

- **Choice:** Started with separate tables (docs, issues, projects), then added a unified `documents` table
- **Was it right?** No. This was the single worst architectural decision. It happened because the MVP was built with separate tables (simpler, faster), and the final version required a unified model (matching the original). Now both exist and the codebase has two competing data access patterns.
- **What I'd change:** Start with the unified document model from day 1, even in the MVP. The extra 30 minutes upfront would have saved 2+ hours of migration work.

### Decision 5: All-OpenAI Model Configuration
- **Choice:** Switched all workers (including backend/frontend) from Claude Sonnet to GPT-4o
- **Alternatives:** Keep Claude for complex editing, use GPT-4o-mini for everything, hybrid per-task routing
- **Was it right?** Yes for sprint velocity. GPT-4o was 5.5x faster per task and avoided the Anthropic budget limit. Code quality was adequate for TDD tasks where the tests validate correctness. For more nuanced architectural decisions, Claude's output was noticeably better.
- **What I'd change:** Add a cost-aware model router that tracks spend per provider and auto-switches when approaching limits, rather than requiring manual intervention.

## 7. If You Built It Again

### Agent Architecture Changes

1. **Shared contract enforcement:** Before multi-agent execution, generate a contract file (`contracts/feature-name.ts`) with TypeScript interfaces for request/response shapes. All workers import from this contract. Post-execution validation checks conformance. This alone would have prevented interventions #3, #10, and #11.

2. **Migration awareness:** Give the agent a `list_migrations` tool that reads the current migration state before generating new ones. Current agent generates `CREATE TABLE` without knowing what tables already exist.

3. **Pre-flight validation:** Before launching 5 parallel agent sessions, run a quick single-agent "plan review" that checks: Do the instructions conflict? Will the outputs touch the same files? Are there dependency ordering constraints?

### File Editing Strategy Changes

4. **Context window management:** The agent's biggest limitation is not seeing enough of the codebase at once. When editing `IssuesPage.tsx`, it didn't see the database seed values. Solution: before any edit, automatically inject the related files (if editing a frontend page, inject the corresponding API route and database schema).

5. **Post-edit integration check:** After every multi-agent batch, run `pnpm build && pnpm test` automatically. Currently, build failures are only discovered when a human runs them manually.

### Context Management Changes

6. **Session continuity:** The agent has no memory between sessions. Each agent run starts fresh, which is why it creates duplicate structures. Solution: persistent project memory that stores "what exists" — tables, routes, pages, types — and is loaded at the start of every session.

7. **Token budget allocation:** The multi-agent sessions hit Anthropic's 450K input tokens/minute rate limit repeatedly. Solution: stagger parallel agents by 30 seconds, or use a smaller model (Haiku) for simple tasks like `list_files` and reserve Sonnet for `edit_file` calls.

### Agent Capability Gaps Identified (2026-03-27)

8. **No search capability:** The original 5 tools (read, create, list, edit, run_command) had no grep/search. The agent could only read files it already knew about — it couldn't discover patterns, find imports, or locate conventions. This directly caused the test quality problem: the agent invented its own test patterns instead of finding and copying existing ones.

9. **Insufficient read and timeout limits:** `MAX_READ_LINES=500` truncated most real-world files. `COMMAND_TIMEOUT=30s` killed every `npm install` and `pnpm build`. The agent couldn't read its context or verify its work.

10. **Wrong workspace paths:** Worker prompts referenced `api/` and `web/` but the Ship app lives at `ship/api/` and `ship/web/`. Every worker was targeting the wrong directory.

**Resolution:** Added `search_files` (regex grep with glob filtering), `scan_workspace` (directory tree), bumped limits (2000 lines, 120s timeout), fixed paths. All 170 agent tests passing.

### Prompt Engineering Findings (2026-03-27 — Task 1 Retrospective)

The agent's first attempt at Task 1 (auth middleware RBAC) revealed a critical pattern:

**Problem:** Given a generic TDD instruction ("write tests first"), the agent produced scaffold tests with:
- Imports from nonexistent utilities (`createAdminSession` from `../utils/session`)
- Placeholder routes (`/admin/some-protected-route` with "Replace with..." comments)
- Wrong auth pattern (cookies instead of `x-session-token` header)
- Missing vitest imports (used bare `describe/it/expect` without importing from "vitest")

**Root cause:** The agent didn't read existing tests before writing its own. Despite having `search_files` available, it wasn't instructed to use it for pattern discovery.

**Fix:** Rewrote TDD preamble to:
1. REQUIRE reading at least one existing test file before writing any test
2. Specify exact import patterns: `import { describe, it, expect } from "vitest"`
3. Specify exact test infrastructure: testPool, mini express app, beforeAll/afterAll table management
4. Ban placeholder code: "Do NOT add comments that say 'Replace with...' — use real values"
5. Provide the exact file path of the reference test to copy from

**Lesson:** Autonomous agents need *exemplar-driven prompts*, not *instruction-driven prompts*. Saying "write tests" produces generic scaffolds. Saying "copy the pattern from auth.test.ts using vitest + supertest + testPool" produces runnable tests. The agent is a pattern replicator, not a pattern inventor.

This matches intervention #11 from the original rebuild — when the auth frontend and backend were built by different agent sessions with no shared reference, they disagreed on the contract. The fix is the same: give every agent session an explicit exemplar to copy from.

### Kanban + Standups Feature Sprint (2026-03-28)

Added two major features from the original Ship app via the Shipyard agent's batch runner (`run_kanban_standups.py`): a 7-column Kanban board for issues and a daily Standups system.

**7 tasks executed, ~636 seconds total agent time:**

| Task | Duration | Agent Result | Interventions Needed |
|------|----------|-------------|---------------------|
| 1. Kanban migration + issues route | 36.9s | Created migration + PATCH endpoint | Wrong statuses (used "review"/"blocked" instead of kanban 7). Wrong migration SQL (ADD COLUMN instead of ALTER CONSTRAINT). Fixed migration and VALID_STATUSES manually. |
| 2. Install @dnd-kit + client API | 17.4s | Client function added | pnpm install failed (workspace resolution). Installed @dnd-kit manually. |
| 3. KanbanBoard components | 29.2s | 3 components created | Used wrong column names ("To Do"/"In Progress"/"Done" instead of 7 kanban statuses). Full rewrite of KanbanBoard, KanbanColumn, KanbanCard. |
| 4. IssuesPage view toggle | 45.3s | Toggle added, JSX broken | Mismatched ternary nesting caused TS1005 syntax error. Old statuses in filter dropdown. Fixed JSX structure and status values. |
| 5. Standups migration + route | 35.8s | Files created | Migration used SERIAL instead of UUID, `date` instead of `standup_date`, no UNIQUE constraint, no soft delete. Route created its own Pool() instead of accepting parameter, no GET /status endpoint, hard deletes. Full rewrite of both files. |
| 6. Standups client + form | 39.8s | Functions and form created | Client used wrong shape ({title, content} instead of {yesterday, today, blockers}). Form had 2 fields instead of 3. Rewrote both. |
| 7. StandupsPage + nav | 432.4s | Page/feed/nav created | Task 9 (App.tsx route) failed due to max_tokens. StandupFeed used wrong interface. Rewrote StandupFeed, StandupsPage. Added route manually. |

**Autonomous success rate: 0 of 7 tasks completed without intervention (0%).** Every task required manual fixes. However, the agent provided useful scaffolding in all cases — it identified the right files to create/modify and generated ~60-70% correct code, which was faster to fix than writing from scratch.

**New intervention patterns identified:**

5. **Schema/contract blindness (tasks 1, 3, 5, 6):** The agent doesn't retain the specific schema from the prompt. When told to use 7 kanban statuses, it used 3. When told to use `yesterday/today/blockers`, it used `title/content`. The agent falls back to common patterns it has seen in training rather than following the exact specification.

6. **Export pattern mismatch (task 5):** The agent used `export default router` instead of the codebase's factory function pattern (`export function createXRouter(pool)`). It also created `const pool = new Pool()` at module level instead of accepting pool as a dependency injection parameter — the opposite of the pattern used in every other route file.

7. **Token limit failures (task 7):** Long-running tasks (432s) hit the model's max_tokens limit, causing subtasks to fail silently. The agent continued to the next subtask instead of retrying.

**What shipped:**
- 7-column kanban board with drag-and-drop (@dnd-kit)
- Issues PATCH /status endpoint for quick status changes
- Standups CRUD with auth, idempotent upsert, author-only mutations
- GET /status endpoint (has user submitted today?)
- StandupsPage with date navigation and team feed
- Standups in sidebar navigation

**Updated metrics after this sprint:**

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| API routes | 14 | 15 (+standups) | +1 |
| Frontend pages | 11 | 12 (+standups) | +1 |
| Frontend components | 10 | 16 (+kanban 3, standup 2, admin 1) | +6 |
| Issue statuses | 4 (open/in_progress/done/closed) | 7 (triage/backlog/todo/in_progress/in_review/done/cancelled) | +3 |
| Human interventions (total) | 12 | 19 (+7 kanban/standups tasks) | +7 |
| Agent tasks run (total) | 10 | 17 (+7) | +7 |

### Agent Improvement Sprint (2026-03-28)

Diagnosed the 0/7 autonomous rate and implemented three targeted fixes to the supervisor graph, plus a live evaluation framework to measure impact.

**Root cause analysis:** The agent's failures weren't capability problems — it *could* find patterns via `search_files` and `read_file`. The problem was it **didn't bother looking** before writing code. It fell back to LLM training defaults instead of following the exact values and patterns specified in prompts and present in the codebase.

**Decision: No RAG.** The rebuild is ~17K lines across ~64 files. `search_files` (regex grep) is sufficient for discovery. The problem was behavioral (agent not reading), not infrastructural (agent unable to find). Adding a vector database would have been over-engineering.

#### Three Fixes Implemented

**Fix 1 — Pre-scan context injection (`gather_context` node):**
A new deterministic node between `decompose` and `execute_next_task`. It scans task descriptions for keywords ("route", "migration", "component", "page"), reads one exemplar file of each type from the workspace, and injects the first 30 lines as `## Codebase Patterns` in every worker's context. No LLM call — purely pattern-matching + file reads.

- When task mentions "route" → reads `ship/api/src/routes/teams.ts`
- When task mentions "migration" → reads the latest `.sql` migration
- When task mentions "component" → reads `ship/web/src/components/DocumentForm.tsx`
- When task mentions "page" → reads `ship/web/src/pages/IssuesPage.tsx`

**Fix 2 — Contract extraction (`extract_contract` function):**
Regex-extracts critical values from task descriptions — quoted enum lists, field definitions, export patterns, constant assignments — and appends them as a `## Contract (MUST match exactly)` block at the END of each task description. This exploits LLM primacy/recency attention bias: values at the end of the prompt are more likely to be used in generation than values buried in the middle.

**Fix 3 — Post-task build verification (`verify_task` node):**
A new node between `execute_next_task` and `check_if_done`. After each backend/frontend task completes, runs `npx tsc --noEmit` in the appropriate directory. If compilation fails and retries < 2, sets the task back to "pending" with the compiler error appended to the description, decrements `current_task_index`, creating a self-healing retry loop.

**Updated supervisor graph:**
```
START → decompose → gather_context → execute_next_task → verify_task → check_if_done ──→ execute_next_task
                                                                                └──→ validate → END
```

#### Live Evaluation Framework

Built 7 live eval tasks that test the actual failure modes, run against a copy of the real Ship codebase with real LLM calls (~$2-3 per full suite):

| # | Task | Category | What It Tests |
|---|------|----------|---------------|
| 1 | contract_enum_values | contract_adherence | Uses exact enum values from prompt, not training defaults |
| 2 | contract_field_names | contract_adherence | Uses exact field names from prompt (went_well/to_improve, not title/content) |
| 3 | route_export_pattern | pattern_following | Matches `export function createXRouter(pool)` not `export default` |
| 4 | component_pattern | pattern_following | Follows existing React component conventions |
| 5 | backend_compilation | compilation | Generated TS route compiles with tsc |
| 6 | frontend_compilation | compilation | Generated TSX component compiles with tsc |
| 7 | migration_conventions | migration_correctness | Uses UUID (not SERIAL), TIMESTAMPTZ, IF NOT EXISTS |

Run with: `python -m shipyard.evals --live`

#### Results: Before vs After

| Category | Before Fixes (kanban sprint) | After Fixes (live evals) |
|----------|----------------------------|-------------------------|
| Contract adherence | 0% — agent ignored prompt values in 4/7 tasks | **100% (2/2)** — exact enum values and field names |
| Pattern following | 0% — agent used `export default` and `new Pool()` | **100% (2/2)** — matched factory function pattern |
| Migration correctness | 0% — SERIAL, wrong columns, no constraints | **100% (1/1)** — UUID, TIMESTAMPTZ, IF NOT EXISTS |
| Compilation | Not tested | 0% (2/2) — infra issue: temp workspace lacks node_modules |
| **Overall live eval score** | N/A | **71% (5/7)** |

**Validation test:** Re-ran the agent with improvements on a new task (create `feedback.ts` route). The agent:
- Read `teams.ts` exemplar before writing (gather_context worked)
- Used exact statuses from prompt: `["pending", "reviewed", "resolved"]`
- Matched export pattern: `export function createFeedbackRouter(pool: pg.Pool): Router`
- Used `pool` parameter (not `new Pool()`)
- Followed soft-delete, `next(err)`, parameterized query patterns

The 2 compilation failures are eval infrastructure issues (temp workspace doesn't have `node_modules`), not agent quality issues.

**Key insight:** The biggest impact came from the simplest fix — `gather_context` just reads an existing file and shows it to the worker. No RAG, no embeddings, no vector database. The agent is a pattern replicator; it just needs to see the pattern first.

#### Updated Test Metrics

| Metric | Before | After |
|--------|--------|-------|
| Agent unit tests | 137 | 140 (+3 for new nodes) |
| Mock eval tasks | 12 (100% passing) | 12 (100% passing) |
| Live eval tasks | 0 | 7 (71% passing) |
| Supervisor graph nodes | 4 (decompose, execute, check, validate) | 6 (+gather_context, +verify_task) |

### What Would Actually Ship

If this were a production product and not a class project, the agent needs three things it currently lacks:
1. **Rollback capability** — the agent can create and edit files but has no concept of "undo the last 5 changes"
2. **Integration testing** — unit tests pass but the agent never runs the full app to verify features work end-to-end
3. **Cost guardrails** — the rebuild consumed an estimated $15-25 in API costs across 172 traces; at scale, each feature costs $2-5 in tokens, which is economically viable but needs monitoring

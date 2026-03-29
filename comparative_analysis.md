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
| Total source lines (TS/TSX) | 122,920 | 27,890 | 23% coverage |
| Source files | 409 | 64+ | 16% coverage |
| Test files | 115 | 114 | 99% coverage |
| API route files | 48 | 18 | 38% coverage |
| Frontend pages | 24 | 12+ | 50% coverage |
| Database migrations | 50+ | 14 | 28% coverage |
| Frontend build time | not measured (no local build available) | 7.2s (`tsc -b && vite build`) | — |
| Frontend bundle size (JS, gzipped) | not measured | 201.78 KB (657 KB uncompressed) | Vite warns >500 KB; needs code-splitting |
| Frontend bundle size (CSS, gzipped) | not measured | 4.37 KB (17.49 KB uncompressed) | — |
| Trace files generated | — | 214 (LangSmith runs during Ship rebuild + agent dev) | — |
| Shipyard agent tests | — | 184 unit + mock evals + 7 live evals | — |
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

### Reliability Sprint Results (2026-03-28 — 6 New Features)

After implementing 6 reliability improvements (shared contract, smarter gather_context, project state scanner, enhanced verify_task with vitest, cross-boundary consistency check, browser_check tool), ran the agent on 6 new Ship features to validate.

#### 6 Features Built via Agent

| # | Feature | Duration | Files Created | Compiles? | Intervention Needed |
|---|---------|----------|--------------|-----------|-------------------|
| 1 | Activity Feed | ~600s | Migration + Route + Page + wiring | Yes (clean) | **None** |
| 2 | File Attachments | 441s | Migration + Route + Component + client API | After fixes | Move files + cast query params |
| 3 | Sprint Reviews | 937s | Migration + Route + Page + nav + client API | After fixes | Move files + cast query params |
| 4 | Workspace Settings | 710s | Migration + Route + Page + client API | After fixes | Move files + wire app.ts |
| 5 | Notifications | 634s | Migration + Route + Bell + Page + client API | After fixes | Move files + wire app.ts |
| 6 | Org Chart | 649s | Migration + Route + Page + OrgCard + client API | After fixes | Move files + wire app.ts |

**Total: 6 features, ~3,970s (~66 min), all compiling after fixes.**

#### What the Improvements Fixed (vs. Previous Sprint)

| Failure Mode | Previous Sprint (0/7) | This Sprint (6/6 code correct) |
|---|---|---|
| Field name mismatches | 4/7 tasks used wrong names | **0** — shared contract enforced exact values |
| Pattern blindness | 5/7 tasks ignored codebase patterns | **0** — full exemplars + dynamic selection |
| Export pattern mismatch | Used `export default` instead of factory | **0** — exemplar showed factory pattern |
| Schema/contract blindness | Used 3 statuses instead of 7 | **0** — contract extracted all enum values |

#### What Still Broke (New Failure Mode Discovered)

**Worker path resolution bug (5/6 tasks):** Backend workers created files under `ship/web/ship/api/` instead of `ship/api/`. The supervisor graph runs workers relative to the workspace root, but workers resolved paths relative to their scoped directory. Files needed manual relocation.

**Root cause:** The worker prompts say "Only modify files in ship/api/" but the workspace root for file operations was set to the Ship web directory for frontend workers. When the backend worker ran next, it inherited the frontend worker's CWD context.

**Cross-boundary check correctly detected:** The validate node flagged "Frontend calls /api/settings but no backend route registered" — catching exactly the kind of wiring gap the agent left behind. This check was added in this sprint and worked as designed.

**Query param type casting:** All new routes had the same TypeScript error — `req.params.id` typed as `string | string[]` but passed to functions expecting `string`. A systematic agent pattern issue (8 occurrences across 4 files), fixable with a one-line cast per occurrence.

#### Intervention Count Comparison

| Sprint | Tasks | Autonomous (no intervention) | Intervention Rate |
|--------|-------|----------------------------|------------------|
| Kanban/Standups (before improvements) | 7 | 0 (0%) | 100% needed help |
| Reliability Sprint (after improvements) | 6 | 1 (17% fully autonomous) | 83% needed path/wiring fixes only |

**The nature of interventions changed fundamentally.** Before: the agent produced wrong code (wrong field names, wrong patterns, wrong exports). After: the agent produces correct code in the wrong location. Content quality is solved; file routing is the remaining gap.

#### Updated Metrics

| Metric | Before Sprint | After Sprint |
|--------|--------------|-------------|
| API routes | 18 | 24 (+activity, attachments, sprint-reviews, settings, notifications, org-chart) |
| Frontend pages | 12 | 16 (+ActivityPage, SprintReviewsPage, SettingsPage, NotificationsPage, OrgChartPage) |
| Frontend components | 16 | 19 (+AttachmentList, NotificationBell, OrgCard) |
| Database migrations | 14 | 20 (+6 new tables) |
| Agent unit tests | 184 | 219 |
| Supervisor graph nodes | 6 | 7 (+generate_shared_contract) |

### What Would Actually Ship

If this were a production product and not a class project, the agent needs three things it currently lacks:
1. **Rollback capability** — the agent can create and edit files but has no concept of "undo the last 5 changes"
2. **Integration testing** — unit tests pass but the agent never runs the full app to verify features work end-to-end
3. **Cost guardrails** — the rebuild consumed an estimated $15-25 in API costs across 172 traces; at scale, each feature costs $2-5 in tokens, which is economically viable but needs monitoring
4. **Worker path isolation** — workers need sandboxed CWD that matches their prompt scoping. The current shared workspace root causes path resolution bugs when multiple workers run sequentially.

### Batch 2 Results (2026-03-29 — 5 Features, 100% Autonomous)

After implementing 5 targeted fixes (path resolution, iteration limits, auto-wiring, query param pattern, supervisor wiring rules), ran the agent on 5 more features.

#### 5 Features Built — Zero Interventions

| # | Feature | Duration | Files Created | Correct Path? | Compiles? | Auto-wired? |
|---|---------|----------|--------------|--------------|-----------|-------------|
| 1 | MyWeek (personal dashboard) | 4403s | Route + Test + Page + client | Yes | Yes | Yes |
| 2 | Status Overview (health metrics) | 5381s | Route + Page + client | Yes | Yes | Yes |
| 3 | User Profile (view/edit) | 993s | Migration + Route + Test + Page | Yes | Yes | Yes |
| 4 | Invitations (invite/accept flow) | 1923s | Migration + Route + Test + 2 Pages | Yes | Yes | Yes |
| 5 | Associations (entity linking) | 1195s | Migration + Route + Test + Component | Yes | Yes | Yes |

**Total: 5 features, ~13,900s (~3.9 hours), zero manual fixes. 100% autonomous.**

#### Fix Validation: Before vs After

| Fix Applied | Batch 1 Result (before) | Batch 2 Result (after) |
|---|---|---|
| Path resolution (set_workspace walks to project root) | 5/6 files in wrong directory | **0/5 wrong** |
| Auto-wiring (validate scans for unwired routes/pages) | 3/6 routes missing from app.ts | **0/5 missing** |
| Query param pattern (as string in worker prompt) | 8 TS2345 errors across 4 files | **0 errors** |
| Supervisor wiring rules (explicit ownership) | Workers skipped app.ts/App.tsx | **All wired by workers or auto-wirer** |
| Iteration limit (recursion_limit=50) | Task 1 hung for 15+ min | **No hangs** (tasks 1-2 slow but completed) |

#### Autonomous Rate Progression

| Sprint | Tasks | Autonomous | Rate |
|--------|-------|-----------|------|
| Kanban/Standups (pre-improvements) | 7 | 0 | **0%** |
| Batch 1 (shared contract + context) | 6 | 1 | **17%** |
| Batch 2 (+ path fix + auto-wiring) | 5 | 5 | **100%** |

**The agent went from 0% to 100% autonomous in two improvement sprints.** The key was addressing each failure mode systematically based on observed data rather than hypothetical risks.

#### What Made the Difference

The three highest-impact fixes, in order:
1. **Path resolution** — `set_workspace` now walks up to find `pyproject.toml`/`.git`. Eliminated the #1 failure mode from Batch 1 (83% of interventions).
2. **Auto-wiring** — `validate` node scans for new route/page files and adds imports + registrations. Eliminated the #2 failure mode.
3. **Shared contract** — LLM generates TypeScript interfaces shared by all workers. Eliminated field name mismatches (the #1 failure mode from the original kanban sprint).

The remaining fixes (iteration limit, query param pattern, supervisor wiring rules) provided defense-in-depth but the first three drove the autonomous rate from 17% to 100%.

#### Updated Totals (All Sprints Combined)

| Metric | After Original Build | After Batch 1 | After Batch 2 | After Batch 3 |
|--------|---------------------|---------------|---------------|---------------|
| API Routes | 18 | 24 | 29 | **37+** |
| Frontend Pages | 12 | 16 | 22 | **27** |
| Frontend Components | 16 | 19 | 22 | **25+** |
| Database Migrations | 14 | 20 | 28 | **32** |
| Agent-generated features | — | 6 | 11 | **24** |
| Autonomous rate | 52% (original) | 17% (batch 1) | 100% (batch 2) | **85% (batch 3)** |

### Batch 3 Results (2026-03-29 — 13 Features, FleetGraph + Infrastructure)

Largest batch yet: 13 features including FleetGraph integration, middleware, and infrastructure features. Tested performance improvements (smart verify, role-scoped context) alongside harder task types (editing existing files, cross-service integration).

#### 13 Features Built — 11 Fully Autonomous

| # | Feature | Duration | Type | Autonomous? |
|---|---------|----------|------|-------------|
| 1 | Team People endpoint | 185s | New route | Yes |
| 2 | Admin User Management | 446s | Route + page edit | Yes |
| 3 | Rate Limiting middleware | 234s | New middleware | Yes |
| 4 | Audit Logging middleware + route | 589s | Migration + middleware + route | Yes |
| 5 | Backlinks tracking | 784s | Migration + route + component | Yes |
| 6 | API Token management | 270s | Migration + route + page | Yes |
| 7 | Setup Wizard | 158s | Route + page | Yes |
| 8 | Iterations/Sprints | 421s | Migration + route + page | Yes |
| 9 | FleetGraph Chat Panel | 293s | Component + hook (external API) | Yes |
| 10 | FleetGraph Layout Wiring | 96s | Edit existing component | Yes |
| 11 | Approvals Page | 130s | New page (external API) | Yes |
| 12 | WebSocket Document Wiring | 337s | Edit existing page | **No** — broke IssuesPage ternary |
| 13 | API Shape Compatibility | 229s | Edit existing routes | **No** — missing client.ts exports |

**Total: 13 features, 4,172s (~70 min), 11/13 autonomous (85%).**

#### Performance Breakthrough: 8.7x Faster

| Metric | Batch 2 | Batch 3 | Improvement |
|--------|---------|---------|-------------|
| Avg time per task | 2,780s | 321s | **8.7x faster** |
| Total batch time | 13,900s (3.9 hrs) | 4,172s (70 min) | **3.3x faster** |
| Slowest task | 5,381s (90 min) | 784s (13 min) | **6.9x faster** |
| Fastest task | 993s (17 min) | 96s (1.6 min) | **10x faster** |

**Root cause:** Smart verify skips `tsc --noEmit` + `vitest run` for tasks that only create new files (can't break existing compilation). Batch 2 ran full verification after every worker; Batch 3 only verifies when files were edited.

#### New Failure Modes Discovered

**1. Incomplete JSX edit (Task 12):** Agent edited IssuesPage.tsx to add a KanbanBoard view toggle but left an incomplete ternary — opened the `list ? (` branch but cut off the `: (board)` branch. This is an **edit-specific** failure: the agent's anchor-based replacement removed the closing branch.

**Root cause:** The agent replaced a section of JSX but didn't include enough context in the `old_text` anchor to capture the full ternary structure. When editing complex nested JSX, the agent needs larger anchors that include the complete conditional block.

**2. Missing cross-file exports (Task 13):** Multiple components imported functions from `client.ts` that were referenced in the task prompts but not actually added to client.ts by previous workers. The agent created the consumers before the producers.

**Root cause:** Tasks 9-13 ran sequentially but the frontend worker for Task 9 created `FleetGraphPanel.tsx` importing from `client.ts`, while the client.ts additions were specified in Task 10. The supervisor ordered tasks correctly but the frontend worker in Task 9 pre-emptively imported functions it expected Task 10 to create. Fixed by adding stub implementations to client.ts.

#### What This Reveals About Agent Limitations

| Task type | Autonomous rate | Evidence |
|-----------|----------------|---------|
| Create new files | **100%** | Tasks 1-11 (all new routes, pages, migrations, components) |
| Edit existing files | **50%** | Tasks 12-13 (1 syntax error, 1 missing exports) |
| External service integration | **100%** | Tasks 9-11 (FleetGraph chat, approvals — all correct) |

The agent is **production-grade for greenfield CRUD** and **good for external API integration** (when given exact type definitions in the prompt). It's **weaker at surgical edits** to existing complex files — the anchor-based replacement can clip surrounding context.

#### FleetGraph Integration Quality

The FleetGraph tasks (9-11) were the first test of the agent building **external service integration** (not Ship's own backend). Results:

- `FleetGraphPanel.tsx`: correct chat UI with severity badges, findings cards, loading states
- `useFleetGraph.ts`: correctly parses URL for entity context, sends to FleetGraph API
- `ApprovalsPage.tsx`: correct HITL queue with approve/reject buttons, filter tabs
- Layout.tsx: ⚡ button correctly wired to toggle panel

The embedded FleetGraph type definitions in the prompts worked — the agent used exact field names (`findings`, `severity`, `chatResponse`, `needsApproval`) matching the FleetGraph API contract. **Providing complete type definitions in the prompt is as effective as the shared contract for external service integration.**

#### Autonomous Rate Progression (Full History)

| Sprint | Tasks | Type | Autonomous | Rate |
|--------|-------|------|-----------|------|
| Kanban (pre-improvements) | 7 | CRUD | 0 | **0%** |
| Batch 1 (shared contract + context) | 6 | CRUD | 1 | **17%** |
| Batch 2 (+ path fix + auto-wiring) | 5 | CRUD | 5 | **100%** |
| Batch 3 (+ smart verify + FleetGraph) | 13 | Mixed (CRUD + edits + integration) | 11 | **85%** |

The drop from 100% to 85% is expected — Batch 3 included fundamentally harder tasks (editing existing files, cross-file coordination). The 100% rate on new-file tasks held.

### Post-Deploy Fixes (2026-03-29 — Production Issues)

After deploying Batch 3 to Railway, 6 categories of production issues were discovered that the agent's local verification didn't catch.

#### Issues Found and Fixed

| # | Issue | Root Cause | Fix | Agent's Fault? |
|---|-------|-----------|-----|----------------|
| 1 | `api_tokens` table does not exist (500) | Agent created the route (`api-tokens.ts`) but never created migration `031_create_api_tokens.sql` | Created the missing migration | **Yes** — missed a file |
| 2 | 401 on notifications, org-chart, sprint-reviews, settings | 4 components used raw `fetch()` instead of `authFetch()`, so session token wasn't sent | Replaced `fetch` with `authFetch` in NotificationsPage, NotificationBell, OrgCard, AttachmentList | **Yes** — inconsistent auth pattern |
| 3 | `column w.status does not exist` on weeks page (500) | Agent added `w.status` to weeks query for FleetGraph compatibility, but weeks table has no status column | Replaced with computed CASE expression based on dates | **Yes** — referenced nonexistent column |
| 4 | FleetGraph approvals `ERR_CONNECTION_REFUSED` | Frontend defaults to `localhost:4000` for FleetGraph URL; env var `VITE_FLEETGRAPH_URL` not set in Railway | Set env var in Railway (infrastructure, not code) | **No** — deployment config |
| 5 | Docker build failed: `pnpm-lock.yaml out of date` | Agent added `happy-dom@^13.10.2` to package.json (version doesn't exist) without running `pnpm install` | Fixed version to `^20.8.0`, ran `pnpm install` to sync lockfile | **Yes** — hallucinated version |
| 6 | Migrations 013/019 failing on deploy | Existing issue data had `blocked`/NULL statuses that violated new CHECK constraint | Created migration 033 to force-fix all statuses, then migration 012 for NULL handling | **Partially** — pre-existing data issue |

#### What This Reveals About Deployment Gaps

The agent's verification (`tsc --noEmit` + smart verify) catches **compile-time** errors but misses **deploy-time** and **runtime** errors:

| Error Category | Caught by tsc? | Caught by vitest? | Caught by deploy? | How to prevent |
|---------------|----------------|-------------------|-------------------|----------------|
| Missing migration file | No | No | Yes (500 at runtime) | Post-task check: every route that queries a table should have a corresponding migration |
| Wrong auth function (fetch vs authFetch) | No | No | Yes (401 at runtime) | Lint rule or worker prompt enforcement |
| Nonexistent column in SQL | No | No | Yes (500 at runtime) | Test that queries against real DB schema |
| Hallucinated package version | No | No | Yes (build failure) | **Fixed**: worker prompt rule 7 + lockfile check in verify_task |
| Stale lockfile | No | No | Yes (build failure) | **Fixed**: verify_task now runs `pnpm install --frozen-lockfile` |
| Missing env vars | No | No | Yes (connection refused) | Deployment checklist / env var validation at startup |

**Key insight:** The gap between "compiles locally" and "works in production" is the largest remaining weakness. The agent produces code that passes TypeScript compilation but fails at runtime because:
1. SQL queries reference columns/tables that don't exist
2. Auth patterns are inconsistent (some use `authFetch`, others use raw `fetch`)
3. Package versions are hallucinated without verification

#### Issue 7: Agent didn't write tests for 5 of 13 routes

The agent created test files for some routes during Batch 3 (my-week, profile, associations, invitations, status-overview) but **skipped tests entirely for 5 routes**: org-chart, notifications, settings, setup, sprint-reviews. These were the exact routes that shipped with broken auth middleware — if tests had existed and hit the endpoints with an auth token, the custom-auth-vs-shared-auth mismatch would have been caught before deploy.

**Root cause:** The task prompts included "Write tests FIRST" in the TDD preamble, but the supervisor decomposed some tasks without a dedicated test subtask. When the frontend worker was busy creating pages, the backend worker moved on without writing tests. The TDD instruction was advisory, not enforced.

**What this cost:** 5 routes deployed with broken authentication. All returned 401 for logged-in users. Required a manual fix across all 5 files.

**Fix:** Created a dedicated test generation batch (`run_tests_batch.py`) to retroactively generate tests for the 5 missing routes. Future improvement: add a post-task check that verifies a test file exists for every new route file.

#### Issue 8: Custom auth middleware instead of shared middleware

5 of the Batch 3 routes (org-chart, notifications, settings, setup, sprint-reviews) implemented their own `requireAuth` and `getAuthUserId` functions instead of using the shared `createAuthMiddleware(pool)`. The custom functions checked `req.user?.id` but `req.user` was never populated because the real auth middleware wasn't applied. The routes compiled fine — `req.user` is typed as optional, so TypeScript didn't catch it.

**Root cause:** The agent pattern-matched on the wrong exemplar. Some older routes in the codebase had inline auth checks, and the agent copied that pattern instead of the `createAuthMiddleware` import pattern. The `gather_context` exemplar selection picked files that happened to use the old pattern.

**What this cost:** Every new route returned 401 for authenticated users. 5 files needed manual fixes.

**Fix:** Updated all 5 routes to use `createAuthMiddleware(pool)`. Future prevention: add to the backend worker prompt that auth MUST use `createAuthMiddleware` — never define custom auth functions.

#### Preventive Measures Implemented

1. **Worker prompt rule 7**: "Never add dependencies without running `pnpm install` and checking the version exists first"
2. **verify_task lockfile guard**: If worker output mentions `package.json`, automatically runs `pnpm install --frozen-lockfile` and fixes if out of sync
3. **Migration 033**: Force-fix pattern for data integrity issues

#### Still Needed (Not Yet Implemented)

1. **Runtime verification**: Start the app in verify_task, curl the new endpoints, check for 200s
2. **Migration-route consistency check**: Every route that creates a table should have a migration, and vice versa
3. **Auth pattern linting**: Grep for raw `fetch('/api/` in frontend files — all should use `authFetch`
4. **Package version validation**: `pnpm view <package> version` before adding to package.json
5. **Test file enforcement**: Every new route file must have a corresponding test file — fail the task if missing
6. **Auth middleware enforcement**: Backend worker prompt must specify `createAuthMiddleware(pool)` — never define custom auth functions

#### Updated Intervention Counts

| Sprint | Tasks | Code Autonomous | Post-Deploy Fixes | Total Interventions |
|--------|-------|----------------|-------------------|-------------------|
| Kanban | 7 | 0% | N/A | 7 |
| Batch 1 | 6 | 17% | 5 (path fixes) | 10 |
| Batch 2 | 5 | 100% | 0 | 0 |
| Batch 3 | 13 | 85% | 8 (auth, migration, lockfile, schema, missing tests) | 10 |
| **Total** | **31** | **55% fully autonomous** | **13 post-deploy fixes** | **27 total interventions** |

The agent is excellent at generating correct TypeScript that compiles — but "compiles" ≠ "works in production." The biggest gaps are now:
1. **Missing tests** — the agent doesn't consistently write tests for every route
2. **Wrong auth pattern** — copies whichever exemplar `gather_context` picks, even if it's the wrong pattern
3. **No runtime verification** — tsc passes but endpoints return 401/404/500 at runtime

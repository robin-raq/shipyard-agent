# Comparative Analysis: Agent-Built Ship vs. Original Ship

## 1. Executive Summary

Shipyard, a multi-agent autonomous coding system built on LangGraph and Claude, rebuilt the US Treasury Department's Ship application — a real-time collaborative project management platform — over a 4-day sprint. The agent produced a functional monorepo with 14 API routes, 11 frontend pages, authentication, full-text search, comments, and a TipTap rich text editor. The rebuild covers approximately 14% of the original codebase by line count (16,818 vs. 122,920 lines) and 46% of frontend views (11 of 24 pages). The agent excelled at scaffolding CRUD modules rapidly (5 features built in parallel in under 30 minutes) but required human intervention for cross-module consistency, migration ordering, and value mismatches between frontend and backend. **In short:** parallel scaffolding worked; cross-boundary consistency and infrastructure/ops still needed humans. Every intervention from the initial rebuild is logged below with timestamps and root causes; **follow-on sprints, batch runs, and post-deploy fixes** are documented in [`comparative_analysis_supplement.md`](comparative_analysis_supplement.md).

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

### Agent Speed Metrics (highlights)

- **Initial scaffold** (shared types + DB + API + frontend): ~45 minutes (Mar 25).
- **Parallel feature bursts:** 5 features in ~32 min; later **10 TDD features** via batch runner in ~38 min (Claude ~329s/task, GPT-4o ~60s/task, ~5.5× faster).
- **Typical CRUD in multi-agent mode:** ~8–15 minutes per module.
- **Live evals (post-improvements):** **5/7 (71%)** — strong on contract/pattern/migration categories; two compilation evals failed for **eval infrastructure** (temp workspace without full `node_modules`), not judged as agent failure.

*(Sprint-by-sprint timing, Kanban batch, and autonomy progression tables are in the [supplement](comparative_analysis_supplement.md).)*

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

**Additional interventions** from later feature sprints and production deploys (27 total across all sprints, with post-deploy auth/migration issues) are itemized in [`comparative_analysis_supplement.md`](comparative_analysis_supplement.md).

## 5. Advances

Where the agent genuinely outperformed manual development:

1. **Parallel feature scaffolding:** 5 complete CRUD modules (routes + tests + migrations + frontend pages) built simultaneously in ~30 minutes. A single developer would need 2-3 hours for the same scope sequentially. The multi-agent supervisor dispatched backend, frontend, and database workers concurrently.

2. **Test generation alongside code:** When given explicit TDD instructions, the agent generated comprehensive test suites (75 test files, 19,799 lines). The test-to-code ratio in our build is higher than the original (our tests are 49% of original's test volume while our app code is only 14% of original's volume). The agent produced faster and more voluminous test generation than a typical manual workflow on a sprint of this length.

3. **Consistent CRUD boilerplate:** Every route file follows the same pattern — factory function, input validation, try/catch, consistent error response format. A human team would develop inconsistencies over 122K lines; the agent's pattern adherence is mechanical and reliable.

4. **WCAG accessibility pass:** The agent added ARIA labels, focus indicators, semantic HTML, and skip-to-content links across all frontend components in a single 15-minute pass. A human would need to audit each component individually.

5. **Documentation velocity:** OpenAPI/Swagger docs, JSDoc annotations, and API endpoint documentation generated automatically during feature creation — not as an afterthought.

6. **Model portability:** Switching from Claude Sonnet to GPT-4o required changing one line in models.py. The LangChain abstraction paid off — all 7 tools, prompts, and the supervisor graph worked identically across providers. GPT-4o produced adequate TDD output at 5.5x the speed.

**Net:** Shipyard is best understood as a **fast, inspectable force multiplier** on **well-scoped, pattern-heavy** coding. **Architecture, shared contracts, infrastructure, and ambiguous specs** still need humans — consistent with §4. Later sprint results (autonomy rates after supervisor improvements) are in the [supplement](comparative_analysis_supplement.md).

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

### Production-grade gaps (brief)

A shipping-quality agent would still need **rollback beyond per-file `.bak`**, **integration/E2E verification** (not only `tsc`), and **cost guardrails** — expanded in the supplement alongside post-rebuild tooling (`search_files`, `gather_context`, `extract_contract`, `verify_task`) and sprint outcomes.

---

**Extended evidence:** [`comparative_analysis_supplement.md`](comparative_analysis_supplement.md) — capability-gap notes, prompt-engineering retrospective, Kanban/standups sprint, reliability and batch results, FleetGraph/post-deploy analysis, and cumulative intervention totals.

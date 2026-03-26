# Comparative Analysis — Shipyard Agent vs Original Ship App

## 1. Architectural Decisions

### Schema: Separate Tables vs Single Discriminator Table

**Original Ship app:** Uses a single `documents` table with a `document_type` discriminator column. All entity types (docs, issues, projects, weeks, teams) share the same table and columns.

**Agent rebuild (initial):** Followed the PRD and implemented the same discriminator pattern. One table, one set of CRUD routes, type filtering via query parameter.

**Agent rebuild (refactored):** Switched to separate tables per entity type after evaluating the trade-offs during development.

**Why we changed:**
- The discriminator pattern forces type-specific fields (status, priority, assignee, start_date) into nullable columns or a JSON blob — neither is clean
- No foreign key constraints between types (e.g., an issue can't reference its parent project)
- Validation logic becomes a tangle of conditionals in a single route handler
- Separate tables produce self-documenting schemas — each table declares exactly what that entity needs

**What we gained:**
- Proper columns with NOT NULL constraints where appropriate
- Foreign keys: issues belong to projects, teams have members
- Dedicated API routes (`/api/issues`, `/api/projects`) with type-specific validation
- Each route handler is simpler and single-purpose

**What we lost:**
- Can no longer query "all documents" across types in one query
- More tables, more route files, more code overall
- Diverges from the original Ship app's architecture (intentional — documents the trade-off)

**Verdict:** A human developer would likely make this same refactoring decision. The discriminator pattern works for prototyping but doesn't scale well when entity types have meaningfully different fields. The agent initially followed the spec literally; the human operator intervened to improve the architecture.

---

## 2. Agent Observations (Running Log)

### What the agent did well
- Generated correct TypeScript types on first attempt (9/9 tests passed)
- Created PostgreSQL migration with proper constraints, indexes, and CHECK clause
- Built 13-test supertest suite and all routes passed on first try
- React frontend with 4 views, routing, and API client — all generated in one agent call
- Dockerfile with multi-stage build — mostly correct, needed one fix (missing node_modules path)

### Where human intervention was needed
- **Port conflict:** Local PostgreSQL was running on port 5432, conflicting with Docker. Agent couldn't diagnose this — human identified via `lsof -i :5432` and switched Docker to port 5433.
- **Architecture decision:** Agent followed the PRD's discriminator pattern literally. Human decided to refactor to separate tables for better schema design.
- **Dockerfile fix:** Agent-generated Dockerfile tried to COPY `shared/node_modules` which didn't exist (shared has no runtime deps). Human removed the line.
- **Nginx complexity:** Agent added nginx to the Dockerfile for serving static files. Human simplified to serve from Express directly.
- **`run_command` blocked `cd`:** Agent tried `cd ship && pnpm test` but `cd` isn't in the command allowlist. It self-corrected to use `pnpm --filter`.

### What this reveals about the agent
- Follows specs literally — doesn't question architectural decisions
- Handles happy-path code generation very well
- Struggles with environment-specific issues (port conflicts, Docker networking)
- Self-corrects on tool errors (blocked commands, missing files) without human help
- Doesn't optimize Dockerfiles for production without explicit guidance

### Multi-Agent vs Single-Agent Bug Fixing (March 26)

Six bugs were discovered in the Ship app rebuild — all caused by the same root issue: migration 002 split the `documents` table into separate entity tables, but routes, seed data, tests, and API client weren't fully updated to match the new column names.

**Bugs found:**
1. `teams.ts` route: INSERT/UPDATE used `(title, content)` instead of `(name, description)`
2. `projects.ts` route: INSERT/UPDATE used `content` instead of `description`
3. `seed.ts`: INSERT INTO teams used `(title, content)` instead of `(name, description)`
4. `client.ts`: `createTeam`/`updateTeam` sent `{ name, content }` instead of `{ name, description }`
5. `issues.ts`: VALID_STATUSES missing "done" — DB schema allows it, validation rejected it
6. `routes.test.ts` + `db.test.ts`: Still referenced the dropped `documents` table

**Single-agent mode (3 separate runs):** Fixed bugs #1, #4, and #6. Each was given one precise instruction. All three completed correctly — zero hallucination, zero cleanup needed.

**Multi-agent mode (1 run):** Was given all 5 remaining bugs as a single instruction. Results:
- Fixed bugs #2, #3, #5 correctly (projects, seed, issues)
- **Hallucinated an entire "Ships" feature** — the supervisor decomposed "fix bugs in the Ship app" into tasks about building a ships CRUD endpoint, ShipList component, ShipDetailPage, database migration (003_create_ships.sql), test suite, and documentation. None of this was requested.
- Created 10 new files, modified 3 existing files (App.tsx, Layout.tsx, app.ts) to wire in the hallucinated feature
- All hallucinated files had to be manually removed

**Why the hallucination happened:**
The supervisor's task decomposition step takes the user instruction and asks Claude to break it into worker-appropriate subtasks. The word "Ship" in "Ship app" triggered the model to generate ship-related features rather than parsing the numbered bug list. The supervisor prompt didn't constrain decomposition tightly enough — it allowed creative interpretation of the user's intent.

**What this reveals:**
- **Simpler architectures outperform multi-agent when tasks are well-specified.** Single-agent mode was 100% accurate on every task.
- **The supervisor is where errors get amplified.** A bad decomposition fans out incorrect work to every worker.
- **Multi-agent adds value for genuinely decomposable tasks** (e.g., "build the Issues feature" → database schema + API routes + frontend + types). It adds risk for repair/debugging tasks where precision matters more than parallelism.
- **Guardrails needed:** The supervisor should validate its decomposition against the original instruction before dispatching. A simple "does each subtask map to something the user explicitly asked for?" check would have caught this.

**Fix applied — Plan Validation Gate:**
After this incident, two changes were made to prevent recurrence:
1. **Supervisor prompt rewrite** — Added "Grounding Rules" requiring every subtask to trace back to something the user explicitly said. Added anti-hallucination rules: "Never create new features unless explicitly asked" and "When in doubt, do less."
2. **Plan validation step** — After decomposition, a second LLM call compares the proposed task plan against the original instruction. Any task that doesn't map to an explicit user request is removed before dispatch. This is a lightweight "self-check" pattern — the supervisor validates its own plan before acting on it.

**Trade-off:** The validation step adds one extra LLM call (~$0.01) and ~2 seconds latency per multi-agent invocation. This is worth it — a hallucinated task that creates 10 wrong files costs far more in human cleanup time.

**Trace evidence:**
- Single-agent traces: `trace_20260326_033058.json`, `trace_20260326_112437.json`, `trace_20260326_112921.json`
- Multi-agent trace: `trace_20260326_034211.json` (contains hallucinated task plans)

---

## 3. Cost Data

*(To be filled in from LangSmith dashboard)*

| Metric | Value |
|--------|-------|
| Total agent invocations | TBD |
| Total input tokens | TBD |
| Total output tokens | TBD |
| Total API cost | TBD |
| Average tokens per invocation | TBD |
| Model split (Claude vs GPT-4o-mini) | TBD |

---

## 4. Performance Benchmarks

*(To be filled in after Phase 2)*

| Metric | Original Ship | Agent Rebuild |
|--------|--------------|---------------|
| Lines of code | TBD | TBD |
| Number of files | TBD | TBD |
| Test count | TBD | 28 (shared: 9, API: 19) |
| Build time | TBD | TBD |
| Bundle size (frontend) | TBD | TBD |

---

## 5. Shortcomings

*(To be updated as rebuild continues)*

- No real-time collaboration yet (TipTap/Yjs — Phase 2)
- No rich text editing — plain textarea only
- ~~No status/priority fields on issues~~ (fixed — issues now have status and priority with validation)
- No cross-linking between entities
- No accessibility features (WCAG 2.1 AA)
- No session management or authentication
- Basic UI — functional but not polished

---

## 6. If You Built It Again

*(To be filled in after project completion)*

# AI Development Log — Shipyard Agent

## 1. Tools & Workflow

| Tool | Role | How It Was Used |
|---|---|---|
| **Claude Sonnet 4.5** | Primary agent LLM | Powers single-agent loop and backend/frontend workers for surgical edits. |
| **GPT-4o / GPT-5** | Multi-agent workers | Backend/frontend workers in batches 2-3. 5.5x faster than Sonnet per task. |
| **GPT-4o-mini** | Cost-optimized tasks | Supervisor decomposition, shared types, database workers. ~20x cheaper than Sonnet. |
| **LangGraph** | Agent orchestration | StateGraph with 7 nodes: decompose → generate_shared_contract → gather_context → execute_next_task → verify_task → check_if_done → validate. |
| **LangSmith** | Observability | Auto-tracing via `LANGSMITH_TRACING=true`. 243+ traces captured across all sprints. |
| **Claude Code (CLI)** | Development environment | Wrote the agent itself, managed codebase, iterated on prompts. Meta: an AI coding tool building an AI coding tool. |

**Workflow:** Claude Code wrote the agent code (TDD). The Shipyard agent rebuilt the Ship app across 4 batch sprints. Human intervention happened for auth pattern fixes, missing migrations, lockfile desync, and deployment config.

---

## 2. Effective Prompts

**Prompt 1 — Core rules (drove correct agent behavior):**
```
1. Always read before editing. Never guess file contents.
2. Use exact anchors — old_text must be copied verbatim.
3. Verify after editing — re-read the file and confirm.
```
*Why it worked:* Eliminated the most common failure mode — LLM guessing file contents.

**Prompt 2 — Supervisor grounding rules (prevented hallucination):**
```
Only decompose what was explicitly requested. Every subtask MUST trace back
to something the user actually said. Do NOT invent features.
```
*Why it worked:* Reduced hallucinated task generation to near-zero after the "Ships" feature incident.

**Prompt 3 — Shared contract generation (eliminated cross-boundary mismatches):**
```
Generate a TypeScript interface contract from the task plan. ALL workers
must follow these exact field names, enum values, and API shapes.
```
*Why it worked:* The #1 failure mode (10/19 interventions) was frontend/backend disagreeing on field names. The shared contract LLM call (~$0.004) gave every worker the same canonical interface.

**Prompt 4 — Worker prompt rule 7 (prevented lockfile desync):**
```
Never add dependencies to package.json without running pnpm install.
Check version exists with pnpm view <package> version before adding.
```
*Why it worked:* Agent hallucinated `happy-dom@^13.10.2` (doesn't exist), broke Docker build. This rule + verify_task lockfile check prevents recurrence.

**Prompt 5 — Supervisor wiring rules (ensured app.ts/App.tsx registration):**
```
Backend worker is responsible for creating routes AND registering them in
ship/api/src/app.ts. Frontend worker must add routes in App.tsx AND nav
items in Layout.tsx. Do NOT create separate tasks for wiring.
```
*Why it worked:* Workers consistently created files but forgot to wire them. Explicit ownership + auto-wiring in validate eliminated this.

---

## 3. Code Analysis

| Category | Approximate % |
|---|---|
| **Agent-generated (via Shipyard agent)** — 24 features across 4 batch sprints: routes, migrations, pages, components, client API | ~50% |
| **Claude Code-generated (via CLI)** — agent core, supervisor, tools, tests, prompts, reliability improvements | ~40% |
| **Hand-written** — .env config, Docker/Railway, architectural decisions, prompt refinements, post-deploy fixes | ~10% |

Out of 127 total commits: ~35 are agent-generated via the Shipyard agent, ~92 via Claude Code or human edits.

---

## 4. Strengths & Limitations

**Where the tools excelled:**
- 100% autonomous on greenfield CRUD features (Batch 2: 5/5 tasks, zero fixes)
- 13 features in 70 minutes in Batch 3 (avg 321s/task)
- FleetGraph external service integration worked perfectly with embedded type definitions
- Consistent factory function pattern across all 36 route files
- 8.7x performance improvement from smart verify optimization
- Model portability: switched Claude → GPT-4o with one config change

**Where the tools fell short:**
- **Editing existing files:** 50% autonomous (vs 100% on new files). Anchor-based replacement clips surrounding JSX context.
- **Auth pattern copying:** 5 routes copied custom auth instead of shared `createAuthMiddleware`. Compiled fine, returned 401 at runtime.
- **Missing files:** Agent created routes but forgot corresponding migration (api_tokens) and test files (5 routes).
- **Package version hallucination:** Added `happy-dom@^13.10.2` (doesn't exist), broke Docker build.
- **Runtime vs compile:** tsc passes but endpoints fail at runtime. The gap between "compiles" and "works in production" is the biggest remaining weakness.

---

## 5. Key Learnings

1. **Systematic improvement beats ad-hoc fixes.** Analyzing failure data → implementing targeted fixes → measuring results took autonomous rate from 0% to 100% in two sprints. Each improvement addressed a specific failure mode with evidence.

2. **Shared contracts are the highest-leverage improvement.** One cheap LLM call ($0.004) generating a TypeScript interface prevented 10 of 19 interventions. The agent is a pattern replicator — give it the pattern.

3. **Auto-wiring eliminates human busywork.** The validate node scanning for unwired routes/pages removed the most tedious manual fix. Deterministic post-processing > hoping the LLM remembers.

4. **Smart verify is critical for speed.** Skipping tsc+vitest for new-file-only tasks reduced average time from 2,780s to 321s (8.7x). Full suite verification after every worker is wasteful.

5. **"Compiles" ≠ "works."** The biggest remaining gap. Five routes passed tsc but returned 401 because they used custom auth instead of the shared middleware. Runtime verification (curl the endpoints) is the next frontier.

6. **Embedding external type definitions works as well as shared contracts.** FleetGraph integration tasks were 100% autonomous because we put exact `FleetResult`, `Finding`, `ApprovalRecord` types directly in the prompts.

---

## 6. Rebuild Session Log

### Original Build (Mar 25–27)
21 actions, 11 interventions (52% autonomous). See CODEAGENT.md for full log.

### Reliability Sprint + Feature Batches (Mar 28–29)

| Sprint | Tasks | Features | Autonomous | Avg Time/Task | Key Improvement |
|--------|-------|----------|-----------|---------------|----------------|
| Kanban (baseline) | 7 | Kanban, standups | 0/7 (0%) | — | — |
| Batch 1 | 6 | Activity, attachments, sprint reviews, settings, notifications, org chart | 1/6 (17%) | 2,780s | Shared contract + context |
| Batch 2 | 5 | MyWeek, status overview, profile, invitations, associations | 5/5 (100%) | 2,780s | Path fix + auto-wiring |
| Batch 3 | 13 | FleetGraph, admin, rate limiting, audit, backlinks, API tokens, setup, iterations, team people, WebSocket, API compat | 11/13 (85%) | 321s | Smart verify + FleetGraph types |
| Tests | 5 | Test files for 5 routes | 5/5 (100%) | — | — |

### Post-Deploy Fixes (8 additional interventions)
Wrong auth middleware (5 routes), missing api_tokens migration, lockfile desync (hallucinated version), wrong SQL column names.

---

## 7. Final Statistics

| Metric | Value |
|--------|-------|
| Total development time | 6 days (Mar 23–29) |
| Commits | 127 |
| Agent-generated features | 24 (across 4 batch sprints) |
| Ship API routes | 36 |
| Ship frontend pages | 30 |
| Ship components | 24 |
| Database migrations | 38 |
| Agent tests | 211 (14 files) |
| Ship test files | 27 |
| LangSmith traces | 243+ |
| Autonomous rate | 0% → 17% → 100% → 85% |
| Human interventions | 27 total (19 original + 8 post-deploy) |
| API cost | ~$15 (blended across all models) |
| Deployed URL | https://ship-app-production-fd9d.up.railway.app |

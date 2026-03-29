# CODEAGENT.md — Shipyard Agent Documentation

> Autonomous coding agent built on LangGraph + Claude

## Agent Architecture

### Overview

Shipyard is a **dual-mode coding agent** built on LangGraph's `StateGraph`. It supports single-agent mode (one tool-calling loop) and multi-agent mode (supervisor decomposes tasks and dispatches to specialized workers). The agent runs in a persistent REPL loop, accepting natural language instructions and executing them by calling tools (read, edit, create files; run commands). Tool calls are displayed in real time so you can watch the agent's reasoning.

### Graph Structure

```
START → agent → should_continue() → tools → agent (loop)
                        ↓
                       END (no tool calls)
```

- **`agent` node:** Prepends the system prompt (with optional injected context) to the conversation, then calls Claude via `ChatAnthropic`. Claude decides whether to respond directly or call tools.
- **`tools` node:** LangGraph's `ToolNode` executes whatever tool calls Claude requested. Results are appended as `ToolMessage`s.
- **`should_continue()` edge:** If the last `AIMessage` has `tool_calls`, route to `tools`. Otherwise, route to `END`.

The agent loops (agent → tools → agent → tools → ...) until Claude responds with plain text (no tool calls), at which point the graph terminates.

### State Schema

```python
class AgentState(TypedDict):
    messages: Annotated[list, add_messages]  # Full conversation history
    context: str                              # Injected context (cleared after use)
    trace_steps: list[dict]                   # Local trace data
```

`messages` uses LangGraph's `add_messages` reducer, which appends new messages rather than overwriting. This means the conversation accumulates across the graph's execution loop.

### System Prompt Strategy

The system prompt (`src/shipyard/prompts.py`) enforces six rules:

1. **Always read before editing** — prevents hallucinated file contents
2. **Use exact anchors** — old_text must be verbatim from the file
3. **Verify after editing** — edit_file auto-verifies changes landed
4. **Report clearly** — summarize what changed
5. **Ask when uncertain** — don't guess
6. **Be surgical** — smallest change possible

When context is injected via `/context`, it's wrapped in `<injected_context>` XML tags and appended to the system prompt. This gives Claude domain knowledge (specs, schemas, test output) without polluting the conversation history.

### Tool Registry

| Tool | Signature | Purpose |
|------|-----------|---------|
| `read_file` | `(path: str) → str` | Read file with line numbers |
| `edit_file` | `(path: str, old_text: str, new_text: str) → str` | Anchor-based surgical edit |
| `create_file` | `(path: str, content: str) → str` | Create new file (refuses overwrites) |
| `list_files` | `(directory: str, pattern?: str) → list[str]` | List directory with optional glob |
| `run_command` | `(command: str) → str` | Execute shell command (with safety checks) |

All tools return strings — errors are returned as data, not exceptions. This lets Claude see what went wrong and self-correct.

### Context Injection

Two modes:
- **`/context <filepath>`** — Reads a file and injects it as context for the next instruction
- **`/context paste`** — Accepts pasted text (terminated by empty line)

Context is single-shot: it's included in the system prompt for the next LLM call, then cleared.

---

## File Editing Strategy

### The Anchor-Based Replacement Pattern

Shipyard uses **anchor-based surgical editing** — the same approach used by Claude Code and Aider. Instead of rewriting entire files, the agent:

1. **Reads the file** with line numbers (via `read_file`)
2. **Identifies an anchor** — a unique substring of the existing file content
3. **Replaces the anchor** with new content (via `edit_file`)
4. **Verifies the edit** by re-reading the file after replacement

### Why Anchors, Not Line Numbers

Line numbers are fragile — they shift after every edit. Anchors (exact text matches) are stable because they identify *content*, not *position*. If the agent makes two edits to the same file in sequence, the second edit's anchor still works because it references the actual text, not a line number that may have shifted.

### edit_file Implementation Details

```
edit_file(path, old_text, new_text) → str
```

**Validation steps:**
1. **File exists?** If not, return error with suggestion to use `create_file`
2. **Anchor found?** Count occurrences of `old_text` in the file
   - **0 matches:** Return error + full file contents (so Claude can pick a better anchor)
   - **1 match:** Proceed with replacement
   - **>1 matches:** Return error + all match locations with line numbers (so Claude can use a more specific anchor)
3. **Backup:** Save `.bak` copy before modifying
4. **Replace:** `content.replace(old_text, new_text, 1)`
5. **Verify:** Re-read the file and confirm `new_text` appears and `old_text` does not (unless `new_text` contains `old_text`)

### Error Recovery Flow

When an edit fails, the agent sees the error as a tool result and can retry:

```
Agent: edit_file("app.py", "def hello", "def hello_world")
Tool:  "Error: old_text not found. File contents:\n1: def main():..."
Agent: [re-reads error, picks correct anchor]
Agent: edit_file("app.py", "def main", "def main_world")
Tool:  "Successfully replaced text. Edit verified."
```

This self-correction loop happens naturally within the LangGraph agent↔tools cycle.

### Safety Measures

- **Workspace sandbox:** All file tools resolve paths under a configurable workspace root; `../` traversal and symlink escapes are rejected
- **Backup + revert:** Every edit creates a `.bak` copy; `/revert <filepath>` restores it
- **Before/after diff:** `edit_file` returns a before/after snippet so both the LLM and the user can see exactly what changed
- **No overwrites:** `create_file` refuses to overwrite existing files
- **Command allowlist:** `run_command` uses `shell=False` with an explicit allowlist of programs (git, npm, node, pytest, etc.) — no shell injection possible
- **Read file cap:** Files over 500 lines are truncated to limit token cost
- **Trace redaction:** API keys and secrets are stripped from trace output before writing to disk
- **Timeout:** Shell commands have a 30-second timeout

---

## Tracing

### Dual-Layer Approach

1. **LangSmith (auto):** All LangGraph runs are automatically traced via environment variables (`LANGSMITH_TRACING=true`). Zero-config.
2. **Local JSON:** `TraceCollector` captures tool call steps and saves them to `traces/` as JSON files.

### Local Trace Format

```json
{
  "trace_id": "trace_20260324_013440",
  "timestamp": "2026-03-24T01:34:40.608328+00:00",
  "instruction": "Read math_utils.py and add a multiply function",
  "steps": [
    {
      "step": 1,
      "action": "read_file",
      "input": {"path": "test_workspace/math_utils.py"},
      "output": "1: def add(a, b):\n2:     return a + b\n...",
      "duration_ms": 0
    },
    {
      "step": 2,
      "action": "edit_file",
      "input": {"path": "test_workspace/math_utils.py", "old_text": "...", "new_text": "..."},
      "output": "Successfully replaced text. Edit verified.",
      "duration_ms": 0
    }
  ],
  "total_duration_ms": 6302,
  "result": "success"
}
```

### LangSmith Trace Links

- **Trace 1 (successful edit):** [read → edit → verify → success](https://smith.langchain.com/public/0a29d308-91be-44f6-8fbf-44ee7045fa87/r)
- **Trace 2 (error branch):** [read fails → list_files → graceful recovery](https://smith.langchain.com/public/294b5d73-e118-4f61-9e64-d82c7fda07ce/r)

---

## Multi-Agent Architecture

### Overview

Shipyard supports two modes:
- **Single-agent mode** (`/single`): The original agent loop described above
- **Multi-agent mode** (`/multi`): A supervisor-worker system for complex, multi-file tasks

### Supervisor Graph Structure

```
START → decompose → execute_next_task → check_if_done ──→ execute_next_task (loop)
                                              └──→ validate → END
```

- **`decompose` node:** Calls the supervisor LLM with a specialized prompt. The LLM returns a JSON task plan — an ordered list of subtasks, each assigned to a worker role.
- **`execute_next_task` node:** Looks up the current task, invokes the corresponding worker subgraph, and stores the result. Passes prior worker results as context so workers build on each other's work.
- **`check_if_done` edge:** If more tasks remain, loop back to `execute_next_task`. Otherwise, route to `validate`.
- **`validate` node:** Summarizes all task results into a final response.

### Worker Roles

| Worker | Scope | Domain Knowledge |
|--------|-------|-----------------|
| Backend | `api/` directory | Express routes, middleware, WebSocket |
| Frontend | `web/` directory | React components, TailwindCSS, Vite |
| Database | migrations, schema | PostgreSQL DDL, seeds |
| Shared | `shared/` directory | TypeScript interfaces, types |

### Worker Graph (Factory Pattern)

Each worker is built from a single factory function (`build_worker_graph`) with the same structure as the single-agent graph:

```
START → agent → should_continue → tools | END
                                  tools → agent (loop)
```

Workers share the same 5 tools but have role-specific system prompts that scope their domain. The factory uses **closures** (not globals) so multiple workers coexist without interference.

### State Schemas

```python
class TaskItem(TypedDict):
    worker: str          # "backend" | "frontend" | "database" | "shared"
    description: str     # What the worker should do
    status: str          # "pending" | "done" | "failed"
    result: str          # Worker's summary when complete

class SupervisorState(TypedDict):
    messages: Annotated[list, add_messages]  # Conversation history
    tasks: list[TaskItem]                     # Ordered task plan
    current_task_index: int                   # Current position in plan
    context: str                              # Injected context
    trace_steps: list                         # Local trace data
```

### Sequential Execution (Not Parallel)

Workers execute **one at a time** in dependency order. The supervisor LLM decides the ordering during decomposition (typically: shared types → database schema → backend routes → frontend components). Each worker receives prior workers' results as context.

**Why not parallel:** Workers often depend on each other (e.g., frontend needs backend routes to exist). Sequential execution avoids file conflicts and is much simpler to trace and debug.

### Cost-Optimized Model Selection

The multi-agent system routes each role to the most cost-effective LLM:

| Role | Provider | Model | Why |
|------|----------|-------|-----|
| Supervisor | OpenAI | GPT-4o-mini | JSON decomposition is structured/predictable |
| Shared Worker | OpenAI | GPT-4o-mini | TypeScript interfaces are template-like |
| Database Worker | OpenAI | GPT-4o-mini | SQL DDL is highly structured |
| Backend Worker | Anthropic | Claude Sonnet | Complex multi-step editing needs accuracy |
| Frontend Worker | Anthropic | Claude Sonnet | React components need surgical precision |

**Fallback:** If `OPENAI_API_KEY` is not set, all roles use Claude Sonnet automatically. OpenAI is purely additive — the system works with just an Anthropic key.

**Cost impact:** GPT-4o-mini is ~20x cheaper per token than Claude Sonnet. Routing supervisor + simple workers to it reduces multi-agent costs significantly while keeping editing quality high where it matters.

Model selection lives in `src/shipyard/models.py` with a `ROLE_MODEL_MAP` dict and a `get_llm_for_role(role, force_provider=None)` function.

### Task Decomposition Example

User instruction: "Build the Issues feature"

Supervisor decomposes into:
```json
[
  {"worker": "shared", "description": "Define Issue TypeScript interface"},
  {"worker": "database", "description": "Create documents table migration"},
  {"worker": "backend", "description": "Create CRUD routes at /api/issues"},
  {"worker": "frontend", "description": "Create Issues list and detail components"}
]
```

---

## Running the Agent

```bash
# Setup
pip install -e .
cp .env.example .env  # Add your ANTHROPIC_API_KEY, LANGSMITH_API_KEY, and optionally OPENAI_API_KEY

# Run
python -m shipyard

# Single-agent mode (default)
shipyard> Read test_workspace/math_utils.py and add a multiply function
shipyard> /context test_workspace/api_spec.md
shipyard> Add the /health endpoint to test_workspace/routes.ts according to the spec
shipyard> /revert test_workspace/routes.ts

# Switch to multi-agent mode
shipyard> /multi
shipyard> Build the Issues feature with database, API, and React components

# Switch back
shipyard> /single
shipyard> /quit
```

---

## Test Suite

211 tests across 14 test files (agent) + 27 test files (Ship app):

### Agent Tests

| File | Tests | Coverage |
|------|-------|----------|
| `test_tools.py` | 35 | All 7 tools + browser_check, workspace sandbox, command allowlist |
| `test_agent.py` | 6 | Graph compilation, routing, tool loops, system prompt |
| `test_repl.py` | 11 | REPL commands, context injection, mode switching, /revert |
| `test_tracing.py` | 10 | Trace file creation, step collection, timing, secret redaction |
| `test_state.py` | 9 | AgentState, TaskItem, SupervisorState validation |
| `test_worker.py` | 5 | Worker factory: compilation, routing, prompts, isolation |
| `test_worker_prompts.py` | 8 | Prompt content: base rules, scoping, JSON output |
| `test_supervisor.py` | 41 | Decomposition, execution, routing, gather_context, shared_contract, verify_task, cross-boundary check |
| `test_models.py` | 10 | Model selection: role mapping, fallback, force override, cost routing |
| `test_memory.py` | 12 | Persistent memory: save, load, forget, list |
| `test_rules.py` | 6 | Custom rules: load from directory, inject into prompt |
| `test_evals.py` | 54 | 12 mock eval tasks + 7 live eval tasks, scoring, reporting |
| `test_project_state.py` | 8 | Project state scanner: routes, migrations, pages, components |
| `test_browser_check.py` | 4 | Browser check tool: status, errors, timeout, fallback |

### Ship App Tests (Agent-Generated)

27 test files covering: routes (CRUD for all entities), auth (login/logout/session/middleware), dashboard, programs, comments, search, unified document model, kanban, standups, weekly plans, retros, reviews, org-chart, notifications, settings, setup, sprint-reviews, invitations, associations, profile, status-overview, my-week.

Run agent tests: `pytest -v`
Run Ship tests: `cd ship && pnpm --filter api run test`

---

## Deployment

### Ship App (Railway)

- **URL:** https://ship-app-production-fd9d.up.railway.app
- **Stack:** Express API + React SPA + PostgreSQL (Railway managed)
- **Health:** `/health` → `{"status":"ok"}`
- **API:** 36 routes including `/api/docs`, `/api/issues`, `/api/projects`, `/api/weeks`, `/api/teams`, `/api/ships`, `/api/programs`, `/api/comments`, `/api/dashboard`, `/api/search`, `/api/auth`, `/api/standups`, `/api/weekly-plans`, `/api/weekly-retros`, `/api/reviews`, `/api/feedback`, `/api/activity`, `/api/attachments`, `/api/sprint-reviews`, `/api/settings`, `/api/notifications`, `/api/org-chart`, `/api/my-week`, `/api/status-overview`, `/api/profile`, `/api/invitations`, `/api/associations`, `/api/team/people`, `/api/admin`, `/api/admin/audit-log`, `/api/api-tokens`, `/api/backlinks`, `/api/setup`, `/api/iterations`
- **Swagger:** `/api-docs`

### Shipyard Agent

Runs locally via `python -m shipyard`. Not deployed (local-only per PRD Phase 1 constraints).

---

## Project Stats

| Metric | Value |
|--------|-------|
| Total commits | 127 |
| Agent-generated features | 24 (across 4 batch sprints) |
| LangSmith traces | 243+ |
| Local JSON traces | 243 files |
| Agent test count | 211 (14 test files) |
| Ship app test files | 27 |
| Ship API routes | 36 |
| Ship frontend pages | 30 |
| Ship components | 24 |
| Database migrations | 38 |
| Original Ship lines | 122,920 |
| Autonomous rate | 0% → 17% → 100% → 85% (across 4 sprints) |
| Human interventions | 27 total (19 original + 8 post-deploy fixes) |
| API cost (blended) | ~$15 (Sonnet + GPT-4o/4o-mini across all batches) |
| Deployed URL | https://ship-app-production-fd9d.up.railway.app |

---

## Architecture Decisions (Final Submission)

Key architecture decisions, what was considered, and why each call was made.

### Decision 1: Anchor-Based Editing (vs. Line Numbers, AST, Unified Diff)

- **Chosen:** Anchor-based replacement (`old_text` → `new_text`)
- **Considered:** Line-range replacement (fragile when lines shift), AST parsing (language-specific, complex), unified diff (requires LLM to produce well-formed patches)
- **Why:** Language-agnostic (works on TypeScript, SQL, JSON, YAML), more robust than line numbers (which drift after every edit), simpler than AST parsing (no per-language parsers). LLMs are good at identifying unique text blocks. Inspired by both OpenCode and Claude Code's editing approach.
- **Tradeoff:** Requires the anchor to be unique in the file. Non-unique anchors cause failures (3 interventions during rebuild). Mitigated by returning all match locations with surrounding context when ambiguous.

### Decision 2: LangGraph StateGraph (vs. Anthropic Agent SDK, AutoGen, Raw Loop)

- **Chosen:** LangGraph with manual `StateGraph` construction
- **Considered:** Anthropic Agent SDK (simpler but less control), AutoGen/CrewAI (heavier, more opinionated), raw tool-calling loop (no observability)
- **Why:** Explicit graph structure makes every node transition traceable. First-class multi-agent support via sub-graphs. Automatic LangSmith tracing with zero config (214 traces captured). Learning curve (~2 hours) justified by debuggability.
- **Tradeoff:** More boilerplate than `create_react_agent`. Worth it for full control over routing, state, and error handling.

### Decision 3: Supervisor-Worker Multi-Agent (vs. Peer-to-Peer, Single Agent)

- **Chosen:** Single supervisor decomposes tasks and dispatches to 4 specialized workers (backend, frontend, database, shared)
- **Considered:** Peer-to-peer agents (complex conflict resolution), single agent for everything (slower, no parallelism), human-in-the-loop decomposition (bottleneck)
- **Why:** Parallelism is real — 5 features built in 30 minutes. Workers have scoped prompts and directories, reducing cross-contamination.
- **Tradeoff:** Cross-boundary mismatches (frontend/backend contract disagreements) caused 3 interventions. Mitigated by adding `gather_context` (pre-scan exemplar injection) and `extract_contract` (value extraction from prompts).

### Decision 4: Cost-Optimized Model Routing (Claude Sonnet + GPT-4o-mini)

- **Chosen:** Route supervisor and simple workers (shared, database) to GPT-4o-mini; complex workers (backend, frontend) to Claude Sonnet
- **Considered:** All-Sonnet (expensive), all-GPT-4o-mini (lower editing quality), all-GPT-4o (fast but pricier)
- **Why:** GPT-4o-mini is ~20x cheaper and handles structured tasks (JSON decomposition, TypeScript interfaces, SQL DDL) well. Claude Sonnet's accuracy matters for surgical file editing.
- **Tradeoff:** When Anthropic budget was exhausted (intervention #12), switched all workers to GPT-4o. Code quality was adequate for TDD tasks where tests validate correctness.

### Decision 5: Pre-Scan Context Injection (vs. RAG, vs. Nothing)

- **Chosen:** Deterministic `gather_context` node that reads one exemplar file per task type before workers execute
- **Considered:** RAG with vector database (over-engineering for ~17K lines), no context injection (caused 0% autonomous rate in kanban sprint)
- **Why:** The agent's failures were behavioral (not reading existing patterns), not infrastructural (unable to find them). `search_files` + `read_file` are sufficient for a codebase this size. The simplest fix — just showing the agent an example — raised autonomous success from 0% to 71%.
- **Tradeoff:** Hardcoded exemplar paths. Improved in reliability sprint to use dynamic keyword-overlap scoring.

### Decision 6: Shared Contract Generation (LLM node vs. Regex-only)

- **Chosen:** LLM-generated TypeScript interface contract shared by all workers, with regex `extract_contract` as per-task fallback
- **Considered:** Regex-only (existing `extract_contract`), no contract at all, manual contract per task
- **Why:** Regex misses prose values ("fields: yesterday, today, blockers"). One cheap LLM call (~$0.004) generates a canonical interface that prevents cross-boundary mismatches — the #1 failure mode (10/19 interventions).
- **Result:** Field name mismatches dropped from 4/7 tasks to 0 after adding the shared contract.

### Decision 7: Smart Verify (Skip new-file tasks, role-scoped context)

- **Chosen:** Skip tsc+vitest for workers that only created new files; only run vitest when test files were created; filter context by worker role
- **Considered:** Full verification after every worker (Batch 2 approach — 73 min/task)
- **Why:** New files can't break existing compilation. Role-scoped context reduces injected tokens ~60%. Combined: 8.7x speedup (2780s → 321s average per task).
- **Tradeoff:** If a new file has internal type errors that only surface when imported, this skips detection. Mitigated by the final build check in `validate`.

### Decision 8: Auto-Wiring Routes and Pages

- **Chosen:** `validate` node scans for new route/page files not registered in app.ts/App.tsx and auto-adds imports + registrations
- **Considered:** Relying on workers to wire (failed in 3/6 Batch 1 tasks), manual wiring
- **Why:** Workers consistently create files but forget to wire them into entry points. Deterministic post-task scan eliminates this failure mode entirely.
- **Result:** 0 wiring interventions in Batches 2 and 3 (was 3/6 in Batch 1).

---

## Ship Rebuild Log (Final Submission)

Chronological log of the Ship app rebuild using the Shipyard agent. Every human intervention is documented with timestamps and root causes.

| # | Timestamp | Action | Mode | Result | Intervention? |
|---|-----------|--------|------|--------|---------------|
| 1 | Mar 25 13:04 | Scaffold pnpm monorepo | Claude Code | ✅ ship/api, ship/web, ship/shared | No |
| 2 | Mar 25 14:09 | Generate shared types + DB layer | Agent (single) | ✅ Types, pool, migrations | No |
| 3 | Mar 25 14:16 | Generate CRUD routes for /api/documents | Agent (single) | ✅ All endpoints working | No |
| 4 | Mar 25 14:19 | Generate React CRUD UI (4 views) | Agent (single) | ✅ Docs, Issues, Projects, Teams pages | No |
| 5 | Mar 25 14:50 | Run tests | Human | ❌ Empty test suite fails | Yes — added `--passWithNoTests` |
| 6 | Mar 25 15:28 | Docker build for Railway | Agent + Human | ❌ Multi-stage Dockerfile broken | Yes — simplified to single-stage |
| 7 | Mar 25 16:16 | Refactor to separate tables per entity | Agent (single) | ✅ Migration + routes generated | No |
| 8 | Mar 25 16:57 | Seed database | Human | ❌ Column name mismatch (name vs title) | Yes — fixed seed.ts manually |
| 9 | Mar 25 17:28 | SPA fallback breaking API routes | Human | ❌ /api/* returning HTML | Yes — added path exclusion |
| 10 | Mar 25 19:10 | Railway healthcheck failing | Agent (single) | ✅ Agent added /health endpoint | No |
| 11 | Mar 26 07:00 | Fix 6 Ship app bugs | Agent (multi) | ⚠️ Fixed 5/6 but hallucinated extra features | Yes — added grounding rules |
| 12 | Mar 26 09:53 | 5 features in parallel (Swagger, WCAG, Ships, TipTap, WebSocket) | Agent (multi) | ✅ All 5 completed in 32 min | No |
| 13 | Mar 26 12:02 | 5 TDD features in parallel | Agent (multi) | ❌ All 5 crashed — supervisor IndexError | Yes — bounds check fix |
| 14 | Mar 26 12:19 | Re-run: Dashboard + unified docs | Agent (multi) | ✅ Dashboard page + API + tests | No |
| 15 | Mar 26 12:33 | Re-run: Auth, programs, comments, search | Agent (multi) | ✅ All 4 features with tests | No |
| 16 | Mar 26 12:45 | Run migrations | Human | ❌ Non-idempotent CREATE TABLE | Yes — added _migrations tracking |
| 17 | Mar 26 12:48 | Issue filter dropdowns broken | Human | ❌ in-progress vs in_progress mismatch | Yes — fixed frontend values |
| 18 | Mar 26 13:41 | Login page not working | Human | ❌ Backend expected username, frontend sent email | Yes — aligned field names |
| 19 | Mar 26 19:01 | Railway deploy — server not responding | Human | ❌ Server binding to localhost not 0.0.0.0 | Yes — bound to 0.0.0.0 |
| 20 | Mar 26 21:20 | Railway deploy — /health returning HTML | Human | ❌ Stale deploy (Mar 25 image) | Yes — set root directory to ship/ |
| 21 | Mar 27 01:25 | Migrate + seed Railway Postgres | Human | ✅ All tables created, data seeded | No |
| 22 | Mar 27 16:44 | Anthropic API budget exhausted mid-task | Human | ❌ Switched all workers to GPT-4o | Yes — changed model config |
| 23 | Mar 28 ~09:00 | 7 kanban + standups features (batch) | Agent (multi) | ⚠️ All 7 needed intervention | Yes — schema/contract blindness, export mismatch |
| 24 | Mar 28 ~12:00 | Agent improvement sprint (3 fixes) | Claude Code | ✅ gather_context, extract_contract, verify_task | No |
| 25 | Mar 28 ~14:00 | Live eval validation | Agent (single) | ✅ 5/7 evals passing (71%) | No |

**Original build totals:** 25 actions, 19 human interventions. 52% first-attempt autonomous success rate.

### Reliability Sprint + Feature Batches (Mar 28-29)

After implementing 6 agent improvements (shared contract, smarter gather_context, project state scanner, enhanced verify_task, cross-boundary check, browser_check tool) + 5 targeted fixes (path resolution, iteration limits, auto-wiring, query param pattern, supervisor prompts):

| Sprint | Tasks | Features Built | Autonomous | Duration |
|--------|-------|---------------|-----------|----------|
| Batch 1 | 6 | Activity, Attachments, Sprint Reviews, Settings, Notifications, Org Chart | 1/6 (17%) | ~66 min |
| Batch 2 | 5 | MyWeek, Status Overview, Profile, Invitations, Associations | 5/5 (100%) | ~3.9 hrs |
| Batch 3 | 13 | FleetGraph panel, Approvals, Team People, Admin, Rate Limiting, Audit Logging, Backlinks, API Tokens, Setup Wizard, Iterations, WebSocket wiring, API compat | 11/13 (85%) | ~70 min |
| Tests | 5 | Test files for org-chart, notifications, settings, setup, sprint-reviews | 5/5 | ~39 min |

**Post-deploy fixes:** 8 additional interventions (wrong auth middleware, missing migration, lockfile desync, wrong column names, missing seed data).

### Failure Pattern Summary

1. **Cross-boundary mismatches (5):** Fixed by shared contract generation.
2. **Schema/contract blindness (5):** Fixed by contract extraction + dynamic exemplar selection.
3. **Infrastructure blindness (4):** Partially addressed by auto-wiring and lockfile checks.
4. **Accumulated state (3):** Fixed by project state scanner.
5. **Wrong auth pattern (5):** Agent copied custom auth instead of shared middleware. Caught post-deploy.
6. **Missing files (2):** Agent created routes but forgot migrations or test files.

### Autonomous Rate Progression

| Sprint | Rate | Key Improvement |
|--------|------|----------------|
| Kanban (pre-improvements) | 0% | — |
| Batch 1 (shared contract + context) | 17% | Content correct, paths wrong |
| Batch 2 (+ path fix + auto-wiring) | 100% | All greenfield CRUD autonomous |
| Batch 3 (+ smart verify + FleetGraph) | 85% | Edit tasks and cross-service harder |

---

## Comparative Analysis (Final Submission)

### Executive Summary

Shipyard rebuilt the Ship application — a project management platform — over a 6-day sprint (Mar 23-29). The agent produced a functional monorepo with 36 API routes, 30 frontend pages, FleetGraph integration, rate limiting, audit logging, and comprehensive project management features. The rebuild covers ~75% of the original's route count (36/48) and exceeds its page count (30 vs 24). The agent built 24 features autonomously across 4 batch sprints, achieving 100% autonomous rate on greenfield CRUD and 85% on mixed tasks including editing existing files and external service integration.

### Architectural Comparison

| Aspect | Original Ship | Agent-Built Ship |
|--------|--------------|-----------------|
| Database | Single `documents` table with discriminator + JSONB properties | Separate tables per entity + unified `documents` table (both coexist) |
| Migrations | 50+ with up/down support | 38, forward-only, no rollback |
| API routes | 48 route files, factory pattern with DI | 36 route files, same factory pattern |
| Auth | CAIA-Auth (government SSO) + API tokens | Session tokens + API token management + rate limiting |
| Frontend pages | 24 pages with workspace-scoped routing | 30 pages with flat routing |
| State management | React Context + custom hooks per feature | React Context for auth + FleetGraph; local state elsewhere |
| Editor | TipTap + Yjs collaboration + WebSocket cursor sync | TipTap + WebSocket indicators |
| Middleware | Auth, rate limiting, audit logging, CORS | Auth + rate limiting + audit logging |
| FleetGraph | Embedded project intelligence agent | Chat panel + approvals page integrated |

### Performance Benchmarks

| Metric | Original | Agent-Built | Coverage |
|--------|----------|-------------|----------|
| API route files | 48 | 36 | **75%** |
| Frontend pages | 24 | 30 | **125%** (exceeds original) |
| Frontend components | ~40 | 24 | 60% |
| Database migrations | 50+ | 38 | 76% |
| Test files | 115 | 27 | 23% |
| Agent-generated features | — | 24 | — |

### Shortcomings

27 total human interventions across all sprints. Top failure modes: cross-boundary mismatches (5), wrong auth pattern (5), schema/contract blindness (5), infrastructure blindness (4), accumulated state (3), hallucination (2), missing files (2), lockfile desync (1). Full intervention logs in Ship Rebuild Log and comparative_analysis.md.

### Advances

1. **Parallel scaffolding:** 5 CRUD modules built simultaneously in 30 minutes
2. **Autonomous rate improvement:** 0% → 100% in two improvement sprints through systematic failure analysis
3. **8.7x performance improvement:** Smart verify reduced average task time from 2,780s to 321s
4. **24 features in 4 batches:** Activity, Attachments, Sprint Reviews, Settings, Notifications, Org Chart, MyWeek, Status Overview, Profile, Invitations, Associations, FleetGraph Panel, Approvals, Admin, Rate Limiting, Audit Logging, Backlinks, API Tokens, Setup Wizard, Iterations, Team People, WebSocket wiring, API compat
5. **FleetGraph integration:** External service integration worked perfectly when given exact type definitions in prompts
6. **Consistent boilerplate:** Every route file follows identical factory function pattern
7. **Model portability:** Switched Claude → GPT-4o with one config change; all tools worked identically

### Trade-off Analysis

See Architecture Decisions section above for detailed analysis of all 8 major decisions (anchor editing, LangGraph, supervisor-worker, model routing, pre-scan context, shared contract, smart verify, auto-wiring).

### If You Built It Again

1. **Runtime verification** — start the app and curl endpoints after each task, not just tsc compilation
2. **Test enforcement** — fail tasks that don't produce a corresponding test file
3. **Auth pattern linting** — grep for raw `fetch('/api/` in frontend; all must use `authFetch`
4. **Migration-route consistency** — every route that queries a table must have a corresponding migration
5. **Package version validation** — `pnpm view <pkg> version` before adding to package.json (partially implemented)
6. **Lockfile sync** — run `pnpm install --frozen-lockfile` after any package.json change (implemented)

---

## Cost Analysis (Final Submission)

### Development Costs (Actual)

| Model | Role | Usage | Est. Cost |
|-------|------|-------|-----------|
| Claude Sonnet 4.5 | Backend/frontend workers, single-agent | ~40% of 243 runs | ~$3.50 |
| GPT-4o-mini | Supervisor, shared/DB workers | ~20% of runs | ~$0.10 |
| GPT-4o / GPT-5 | All workers (batches 2-3) | ~40% of runs | ~$8.00 |
| **Total API cost** | | **243+ runs** | **~$12-15** |

Infrastructure: $0 (Railway free tier, LangSmith free tier, GitHub free).

**Total development cost: ~$15**

### Production Cost Projections

Assumptions: 10 invocations/user/day, 4K input + 2K output tokens per invocation, 70/30 Sonnet/GPT-4o-mini split.

| Scale | Users | Daily Invocations | Monthly Cost |
|-------|-------|-------------------|-------------|
| 100 users | 100 | 1,000 | ~$900/month |
| 1,000 users | 1,000 | 10,000 | ~$9,000/month |
| 10,000 users | 10,000 | 100,000 | ~$90,000/month |

### Break-Even vs. Manual Development

| Metric | Agent | Junior Dev | Senior Dev |
|--------|-------|-----------|-----------|
| Time to rebuild | ~10 hours active (6 days wall clock) | ~80 hours | ~40 hours |
| Features built | 24 autonomous + FleetGraph integration | ~24 | ~24 |
| Cost | ~$15 | $4,000 (@$50/hr) | $2,000 (@$50/hr) |
| Human interventions | 27 | 0 | 0 |

The agent is ~130-260x cheaper than manual development but required 27 human interventions for: wrong auth patterns, missing migrations, lockfile desync, deployment config, and seed data. The code generation quality is high; the gap is in runtime verification and cross-file consistency.

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

109 tests across 9 test files:

| File | Tests | Coverage |
|------|-------|----------|
| `test_tools.py` | 35 | All 5 tools, workspace sandbox, command allowlist, read cap, before/after |
| `test_agent.py` | 6 | Graph compilation, routing, tool loops, system prompt |
| `test_repl.py` | 11 | REPL commands, context injection, mode switching, /revert |
| `test_tracing.py` | 10 | Trace file creation, step collection, timing, secret redaction |
| `test_state.py` | 9 | AgentState, TaskItem, SupervisorState validation |
| `test_worker.py` | 5 | Worker factory: compilation, routing, prompts, isolation |
| `test_worker_prompts.py` | 8 | Prompt content: base rules, scoping, JSON output |
| `test_supervisor.py` | 15 | Decomposition, execution, routing, validation, worker allowlist |
| `test_models.py` | 8 | Model selection: role mapping, fallback, force override |

Run with: `pytest -v`

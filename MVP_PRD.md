# MVP PRD — Shipyard Agent

> 36-hour gate: Tuesday 11:59 PM
> ~8 hours estimated focused implementation after Pre-Search
>
> **Note:** This is a product requirements document, not the Pre-Search Checklist (Appendix items 1–13). See PRESEARCH.md for the official checklist submission.

---

## Problem Statement

Development teams use multiple fragmented tools (Claude Code, Cursor, custom scripts) for AI-assisted coding. None of these are fully transparent — you can't see exactly what the agent did, in what order, with what inputs. Building your own agent from scratch forces you to understand every design decision and produces a system you can fully trace, debug, and evaluate.

The MVP must prove three things work:
1. The agent runs continuously and accepts new instructions
2. It makes surgical edits (not full-file rewrites)
3. Every action is traceable

## User Persona

**The Operator (you):** A developer directing the agent via CLI. You type instructions, inject context (specs, test output), and intervene when the agent gets stuck. You need clear feedback about what the agent did and whether it worked.

## Core User Flow (Happy Path)

```
1. Start agent          → `python -m shipyard` → REPL prompt appears
2. Give instruction     → "Add a /health endpoint to api/routes/index.ts"
3. Agent reads file     → [read_file] returns file with line numbers
4. Agent plans edit     → Identifies insertion point (before `export default router`)
5. Agent applies edit   → [edit_file] replaces anchor with new code
6. Agent verifies       → [run_command] runs syntax check → passes
7. Agent reports        → "Added /health endpoint at line 42. Syntax check passed."
8. Trace logged         → Full step-by-step trace saved to traces/
9. Await next input     → REPL prompt reappears
```

## Technical Constraints

| Constraint | Detail |
|---|---|
| Language | Python 3.11+ |
| Framework | LangGraph |
| LLM | Claude (Anthropic SDK) — Claude 3.5 Sonnet for development |
| Observability | LangSmith (set `LANGCHAIN_TRACING_V2=true`) |
| File editing | Anchor-based replacement only |
| Runtime | Local only — no deployment needed |
| State | In-memory (Python process = state store) |

## MVP Feature Set (Must-Have)

### 1. Persistent Agent Loop
- Python REPL that stays alive between instructions
- Accepts natural language instructions via stdin
- Maintains conversation context across turns
- Graceful exit with `/quit` command

### 2. Core Tools (5 tools minimum)
| Tool | Signature | Purpose |
|---|---|---|
| `read_file` | `(path: str) → str` | Read file with line numbers |
| `edit_file` | `(path: str, old_text: str, new_text: str) → str` | Anchor-based surgical edit |
| `create_file` | `(path: str, content: str) → str` | Create new file |
| `list_files` | `(directory: str, pattern?: str) → list[str]` | List directory contents |
| `run_command` | `(command: str) → str` | Execute shell command |

### 3. Surgical File Editing
- `old_text` must be unique in the file (exact match)
- If not unique: return all matches with line numbers, ask LLM to be more specific
- If not found: return error with actual file content
- After each edit: re-read file to verify the change landed
- Keep pre-edit backup for revert capability

### 4. Context Injection
- `/context <filepath>` command reads a file and injects it as context for the next instruction
- `/context paste` allows pasting text directly (terminated by empty line)
- Context is wrapped in `<injected_context>` tags and prepended to the next LLM call

### 5. Tracing
- LangSmith auto-tracing via environment variables
- Additionally: local JSON trace files saved to `traces/` directory
- Each trace includes: instruction, tool calls with I/O, token usage, duration, result

## MVP Non-Features (Explicitly Out of Scope)

- Multi-agent coordination (Thursday deliverable)
- Ship app rebuild (Thursday deliverable)
- Web UI / dashboard
- Deployment / hosting
- AST parsing or language-specific editing
- Automatic error recovery beyond 3 retries
- Streaming responses
- File watching / auto-refresh

## MVP Hour-by-Hour Build Plan

| Hour | Focus | Deliverable |
|---|---|---|
| 0-1 | Project setup | Python project, dependencies installed, LangGraph "hello world" running |
| 1-2 | LangGraph fundamentals | Minimal state graph with one node that calls Claude and returns a response |
| 2-3 | Tool implementation | `read_file`, `create_file`, `list_files` tools working |
| 3-4 | Surgical editing | `edit_file` with anchor-based replacement, uniqueness validation |
| 4-5 | Agent loop | Persistent REPL, tool calling integrated into LangGraph state graph |
| 5-6 | Context injection | `/context` command, injected context flows to LLM |
| 6-7 | Tracing + verification | LangSmith connected, local JSON traces, edit verification |
| 7-8 | Testing + docs | Test against real files of varying sizes, fill in CODEAGENT.md MVP sections |

## Success Criteria (All Required)

- [ ] `python -m shipyard` starts a persistent REPL
- [ ] Agent makes surgical edits without rewriting entire files
- [ ] Agent accepts injected context and uses it in generation
- [ ] Two LangSmith trace links showing different execution paths
- [ ] PRESEARCH.md complete with all architecture artifacts
- [ ] CODEAGENT.md has Agent Architecture and File Editing Strategy sections filled in
- [ ] Runs locally from a fresh `git clone` + `pip install`

## Trace Requirements (MVP Gate)

Two shared trace links are required for the Tuesday MVP gate. Both must demonstrate different execution paths.

- **Trace 1:** Normal successful edit (read → edit → verify → success)
- **Trace 2:** Error branch (read → edit fails → retry → success, OR escalate to human)

## Key Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| LangGraph learning curve eats into coding time | High | Budget 2 hours for learning; follow official quickstart tutorial first |
| LLM produces bad anchors that don't match | Medium | Good system prompt; require reading file before editing; show line numbers |
| Token costs spiral during development | Medium | Use Sonnet (not Opus); set token budget alerts; cache file reads |
| Tracing setup takes longer than expected | Low | LangSmith auto-traces with LangGraph — just set env vars |

## Minimal Project Structure

```
shipyard/
├── pyproject.toml          # Dependencies: langgraph, anthropic, langsmith
├── src/
│   └── shipyard/
│       ├── __init__.py
│       ├── __main__.py     # Entry point: REPL loop
│       ├── agent.py        # LangGraph state graph definition
│       ├── tools.py        # Tool implementations (read, edit, create, list, run)
│       ├── state.py        # State schema for LangGraph
│       └── prompts.py      # System prompt and tool descriptions
├── tests/
│   ├── test_tools.py       # Unit tests for each tool
│   └── test_agent.py       # Integration tests for the agent loop
├── traces/                 # Local JSON trace output
├── PRESEARCH.md
├── CODEAGENT.md
└── README.md
```

# Shipyard

An autonomous coding agent built on LangGraph and Claude. Shipyard takes natural language instructions and makes surgical edits to real codebases — reading files, editing specific blocks, running commands, and verifying results, all in a persistent REPL session with full tracing.

Built as a @GauntletAI sprint project.

## Architecture

```
                         Single-Agent Mode (/single)
                    ┌──────────────────────────────────┐
                    │  START → agent → tools → agent   │
                    │                    ↓              │
                    │                   END             │
                    └──────────────────────────────────┘

                        Multi-Agent Mode (/multi)
┌──────────────────────────────────────────────────────────────────┐
│  START → decompose → execute_next_task ←→ check_if_done         │
│                                                ↓                │
│                                            validate → END       │
│                                                                  │
│  Workers: [backend] [frontend] [database] [shared]              │
└──────────────────────────────────────────────────────────────────┘
```

**Single-agent mode** runs a tool-calling loop: Claude reads files, makes edits, runs commands, and verifies results until the task is done.

**Multi-agent mode** adds a supervisor that decomposes complex instructions into ordered subtasks, dispatches each to a specialized worker agent, and validates the combined results.

## Stack

| Component | Technology |
|-----------|-----------|
| Agent framework | LangGraph (StateGraph) |
| LLM | Claude Sonnet (Anthropic SDK) + GPT-4o-mini (OpenAI) for cost optimization |
| Observability | LangSmith (auto-tracing) + local JSON traces |
| File editing | Anchor-based surgical replacement |
| Language | Python 3.11+ |
| Tests | pytest (104 tests, all offline/mocked) |

### Cost-Optimized Model Routing

In multi-agent mode, structured/predictable tasks (supervisor decomposition, database migrations, type definitions) are routed to GPT-4o-mini (~20x cheaper), while complex editing tasks (backend routes, React components) stay on Claude Sonnet. Falls back to all-Claude if no OpenAI key is set.

## Tools

| Tool | Purpose |
|------|---------|
| `read_file` | Read file with line numbers (capped at 500 lines) |
| `edit_file` | Anchor-based surgical edit with backup + verification |
| `create_file` | Create new files (refuses to overwrite) |
| `list_files` | List directory contents with optional glob |
| `run_command` | Execute allowlisted programs (no shell injection) |

## Security

- **Workspace sandbox** — all file operations are restricted to the project workspace; path traversal (`../`) is rejected
- **Command allowlist** — `shell=False` with an explicit allowlist of programs (git, npm, node, pytest, etc.)
- **Trace redaction** — API keys and secrets are stripped from trace output before writing to disk
- **Edit backups** — every edit creates a `.bak` file for revert capability

## Quick Start

### Prerequisites

- Python 3.11+
- An Anthropic API key ([get one here](https://console.anthropic.com/))

### Setup

```bash
git clone <repo-url>
cd shipYard
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
```

Edit `.env` and add your keys:

```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...        # optional, for cost-optimized multi-agent
LANGSMITH_API_KEY=lsv2_pt_...     # optional, for trace dashboard
LANGSMITH_TRACING=true
LANGSMITH_PROJECT=shipyard
```

### Run

```bash
python -m shipyard
```

### Usage

```
shipyard> Read src/app.py and add error handling to the main function
shipyard> /context specs/api_spec.md
shipyard> Build the /health endpoint according to the spec
shipyard> /multi
shipyard> Build the Issues feature with database, API, and React components
shipyard> /single
shipyard> /quit
```

### Commands

| Command | Description |
|---------|-------------|
| `/quit` | Exit the agent |
| `/multi` | Switch to multi-agent mode (supervisor + workers) |
| `/single` | Switch to single-agent mode |
| `/revert <filepath>` | Restore a file from its `.bak` backup |
| `/context <filepath>` | Inject a file as context for the next instruction |
| `/context paste` | Paste text as context (empty line to finish) |

### Run Tests

```bash
pytest -v
```

All 109 tests run offline with mocked LLMs — no API keys needed for testing.

## Project Structure

```
src/shipyard/
├── __main__.py        # REPL entry point
├── agent.py           # Single-agent LangGraph state graph
├── supervisor.py      # Supervisor multi-agent graph
├── worker.py          # Worker subgraph factory
├── worker_prompts.py  # Role-specific prompts (backend, frontend, database, shared)
├── models.py          # Cost-optimized LLM selection (Claude vs GPT-4o-mini)
├── tools.py           # 5 core tools with workspace sandbox
├── prompts.py         # Single-agent system prompt
├── state.py           # AgentState, SupervisorState, TaskItem schemas
└── tracing.py         # Local JSON trace collector with redaction

tests/
├── test_agent.py           # Graph compilation, routing, tool loops
├── test_supervisor.py      # Decomposition, execution, routing, full flow
├── test_worker.py          # Worker factory, isolation, prompt injection
├── test_worker_prompts.py  # Prompt content validation
├── test_models.py          # Model selection and fallback
├── test_tools.py           # All 5 tools + workspace sandbox + command allowlist
├── test_tracing.py         # Trace collection + secret redaction
├── test_state.py           # State schema validation
├── test_repl.py            # REPL commands and mode switching
└── conftest.py             # Shared fixtures
```

## Ship App (Agent-Built Rebuild)

The Shipyard agent rebuilt the US Treasury Department's [Ship](https://github.com/US-Department-of-the-Treasury/ship) app — a real-time collaborative project management platform.

**Live URL:** https://ship-app-production-fd9d.up.railway.app

### Login Credentials

| Field | Value |
|-------|-------|
| Email | `dev@ship.local` |
| Password | `shipdev123` |

### What's Included

- **14 API routes:** docs, issues, projects, weeks, teams, ships, programs, comments, dashboard, search, auth, documents, health, swagger
- **11 frontend pages:** Dashboard, Docs, Issues, Projects, Weeks, Teams, Ships, Programs, Login, Document Detail, Program Detail
- **Features:** Authentication with sessions, full-text search (PostgreSQL tsvector), comments with threading, programs with associations, WCAG 2.1 AA accessibility, OpenAPI/Swagger docs at `/api-docs`
- **Stack:** React + Vite + TailwindCSS (frontend), Express + PostgreSQL (API), Railway (deployment)

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /api-docs` | Swagger documentation |
| `POST /api/auth/login` | Login (email + password) |
| `GET /api/docs` | List documents |
| `GET /api/issues` | List issues (filterable by status, priority) |
| `GET /api/projects` | List projects |
| `GET /api/programs` | List programs |
| `GET /api/search?q=...` | Full-text search across all documents |

## Documentation

- **CODEAGENT.md** — detailed agent architecture, editing strategy, tracing, multi-agent design
- **COMPARATIVE_ANALYSIS.md** — 7-section analysis: agent-built vs original Ship (benchmarks, interventions, trade-offs)
- **AI_DEVELOPMENT_LOG.md** — rebuild session log with 21 actions, 11 interventions
- **AI_COST_ANALYSIS.md** — token usage, cost breakdown, production scaling model
- **PRESEARCH.md** — research phase: architecture decisions, alternatives considered
- **MVP_PRD.md** — MVP product requirements
- **FINAL_PRD.md** — Full project requirements (multi-agent + Ship rebuild)

## License

This project was built as part of the GauntletAI program.

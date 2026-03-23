# Final Project PRD — Shipyard Agent + Ship Rebuild

> Early Submission: Thursday 11:59 PM | Final Submission: Sunday 11:59 PM
>
> **Note:** This is a product requirements document, not the Pre-Search Checklist (Appendix items 1–13). See PRESEARCH.md for the official checklist submission.

---

## Problem Statement (Full Scope)

Build a production-grade multi-agent autonomous coding system that can decompose complex development tasks, dispatch them to specialized worker agents, and produce a fully functional rebuild of the US Treasury Department's Ship app — a real-time collaborative project management platform. The system must be fully traceable, publicly deployed, and accompanied by a rigorous comparative analysis.

## User Personas

| Persona | Context | Needs |
|---|---|---|
| **Agent Operator** | Directing the agent to rebuild Ship | Clear traces, intervention points, context injection, persistent loop |
| **Code Reviewer** | Evaluating agent-built code vs original | Comparative analysis data, architecture documentation |
| **Evaluator** | Grading the project deliverables | Working deployed demo, honest shortcomings, cost data, trace links |

## System Architecture

### Multi-Agent Orchestration (Supervisor + Workers)

```
┌──────────────────────────────────────────────────┐
│                 SUPERVISOR AGENT                  │
│  - Receives high-level instructions               │
│  - Decomposes into subtasks                       │
│  - Routes to appropriate worker                   │
│  - Merges results and validates                   │
│  - Handles conflict resolution                    │
│  - Maintains global project state                 │
└────────┬──────────┬──────────┬────────────────────┘
         │          │          │
   ┌─────▼────┐ ┌───▼─────┐ ┌─▼──────────┐
   │ BACKEND  │ │FRONTEND │ │ DATABASE   │
   │ WORKER   │ │ WORKER  │ │ WORKER     │
   │          │ │         │ │            │
   │ Express  │ │ React   │ │ PostgreSQL │
   │ Routes   │ │ Comps   │ │ Migrations │
   │ WebSocket│ │ TipTap  │ │ Schema     │
   │ Middleware│ │ Styles  │ │ Seeds      │
   └──────────┘ └─────────┘ └────────────┘
```

### Worker Specialization

| Worker | Scope | Tools | Special Context |
|---|---|---|---|
| Backend Worker | `api/` directory | read, edit, create, run_command | Express patterns, route conventions |
| Frontend Worker | `web/` directory | read, edit, create, run_command | React/Vite patterns, TailwindCSS |
| Database Worker | migrations, schema | read, edit, create, run_command | PostgreSQL DDL, seed data |
| Shared Worker | `shared/` directory | read, edit, create | TypeScript interfaces |

### Communication Flow

1. User gives instruction to Supervisor: "Build the Issues feature"
2. Supervisor decomposes:
   - Task A (Database): Create `documents` table with `document_type` field
   - Task B (Backend): Create CRUD routes for issues at `/api/issues`
   - Task C (Frontend): Create Issues list and detail components
   - Task D (Shared): Define Issue TypeScript interfaces
3. Supervisor sequences: D → A → B → C (dependencies flow left to right)
4. Workers execute using surgical edits
5. Supervisor merges, runs integration check (`pnpm build && pnpm test`)

### Conflict Resolution

- **Same file edit**: Supervisor serializes — Worker A edits first, Worker B gets updated file
- **Type mismatch**: Shared Worker defines interfaces first; other workers consume them
- **Build failure**: Supervisor runs build after each merge; if it fails, the responsible worker gets the error and fixes it

---

## Ship App Rebuild — Feature Requirements

The agent must rebuild these features from the original Ship app. Listed in priority/dependency order.

### Phase 1: Foundation (Thursday Target)

#### 1.1 Monorepo Scaffold
- pnpm workspace with `web/`, `api/`, `shared/` packages
- Docker Compose for local development (PostgreSQL container)
- Shared TypeScript configuration
- Environment variable management (`.env.example`)

#### 1.2 Database Schema
- PostgreSQL with normalized schema
- Central `documents` table with `document_type` discriminator
- Document types: Doc, Issue, Project, Week/Plan, Team
- Migration system (up/down migrations)
- Seed data for development

#### 1.3 API Server (Express)
- Express.js on port 3000
- RESTful routes for all document types:
  - `GET /api/documents` — list with filtering by type
  - `GET /api/documents/:id` — single document
  - `POST /api/documents` — create
  - `PUT /api/documents/:id` — update
  - `DELETE /api/documents/:id` — soft delete
- OpenAPI/Swagger documentation at `/api/docs`
- Session management (15-minute idle timeout)
- Audit logging for all document operations

#### 1.4 Web Client (React + Vite)
- React SPA at port 5173
- TailwindCSS for styling
- Four primary views: Docs, Issues, Projects, Teams
- Basic CRUD UI for each view
- Responsive layout

### Phase 2: Rich Features (Thursday → Sunday)

#### 2.1 Real-Time Collaborative Editing
- TipTap rich text editor integration
- Yjs for operational transform / conflict resolution
- WebSocket server for real-time sync
- Visible cursor tracking for concurrent editors
- "Server is truth" — backend maintains authoritative document state

#### 2.2 Plans & Weeks
- Weekly planning view — set intentions for the week
- Visual escalation indicators (yellow → red for aging docs)
- Retrospective capability

#### 2.3 Issue Tracking Features
- Status fields (open, in progress, done)
- Priority levels
- Rich content (not just plain text — full TipTap editor)
- Cross-linking between issues, docs, and projects

#### 2.4 Accessibility (Section 508 / WCAG 2.1 AA)
- 4.5:1 color contrast minimum
- Full keyboard navigation
- Screen reader support (ARIA labels)
- Visible focus indicators
- No external CDN — all assets served internally

---

## Comparative Analysis Requirements

After the rebuild, produce a 7-section analysis. This is the **most heavily weighted deliverable**.

### Required Sections

**1. Executive Summary** — One paragraph: what you built, how the rebuild went overall.

**2. Architectural Comparison** — Structural differences between agent-built and original. What choices did the agent make that a human wouldn't? Focus on:
- File organization
- API design patterns
- Component structure
- Database schema differences

**3. Performance Benchmarks** — Measurable comparisons:
- Lines of code (total, per feature)
- Code complexity (cyclomatic or similar)
- Test coverage percentage
- Build time
- Bundle size (frontend)
- Load time (first meaningful paint)

**4. Shortcomings** — Every failure, intervention, and incorrect output. From the rebuild log:
- What broke or got stuck
- What you did to fix it
- What it reveals about the agent's limitations

**5. Advances** — Where the agent outperformed manual development:
- Speed (time per feature)
- Consistency (boilerplate generation)
- Completeness (e.g., generated tests alongside code)

**6. Trade-off Analysis** — For each major architecture decision in the agent:
- Was it the right call?
- What would you change?
- How did it affect the rebuild quality?

**7. If You Built It Again** — What would be different about:
- Agent architecture
- File editing strategy
- Context management
- Multi-agent coordination
- Token budget / cost management

---

## Deployment Requirements (Final Submission)

### Platform: Railway

| Component | Deployment |
|---|---|
| Shipyard Agent | Python Docker container on Railway |
| Ship App (API) | Node.js Docker container on Railway |
| Ship App (Web) | Static build served by API or separate container |
| PostgreSQL | Railway managed PostgreSQL addon |

### Deployment Checklist
- [ ] Agent accessible via public URL (can accept instructions via API or WebSocket)
- [ ] Ship app accessible via public URL (all four views functional)
- [ ] PostgreSQL provisioned with seed data
- [ ] Environment variables configured (API keys, database URL)
- [ ] README includes one-command local setup instructions

---

## Cost Analysis Framework

### Development Costs (Track During Build)
- Claude API input tokens: ___
- Claude API output tokens: ___
- Total invocations during development: ___
- Total development spend: $___

### Production Cost Model

**Assumptions:**
- Average agent invocations per user per day: 10
- Average input tokens per invocation: 4,000
- Average output tokens per invocation: 2,000
- Claude Sonnet pricing: $3/M input, $15/M output

**Per-invocation cost:**
- Input: 4,000 × $3/1M = $0.012
- Output: 2,000 × $15/1M = $0.030
- Total: $0.042 per invocation

| Scale | Daily Invocations | Monthly Cost |
|---|---|---|
| 100 users | 1,000/day | ~$1,260/month |
| 1,000 users | 10,000/day | ~$12,600/month |
| 10,000 users | 100,000/day | ~$126,000/month |

**Cost optimization levers:**
- Caching: cache file reads to reduce input tokens
- Smaller model for simple tasks (Haiku for `list_files`, Sonnet for `edit_file`)
- Token budget caps per invocation
- Prompt compression for long conversations

---

## Non-Functional Requirements

For a publicly deployed agent and Ship app, the following non-functional requirements apply. These are not MVP-blocking but are expected in the Final Submission.

### Security
- **`run_command` sandboxing:** Agent shell commands must be scoped to the project directory; reject commands containing `rm -rf /`, `sudo`, or paths outside the workspace
- **Secrets handling:** API keys (`ANTHROPIC_API_KEY`, `LANGCHAIN_API_KEY`, `DATABASE_URL`) stored in environment variables only; never logged in traces or committed to git
- **Auth for public agent URL:** Deployed agent endpoint must require an API key or basic auth; do not expose an unauthenticated endpoint that can run arbitrary shell commands
- **Input validation:** Sanitize file paths passed to tools (no path traversal via `../`)

### Reliability
- **Rate limiting:** Agent should respect Anthropic API rate limits; implement exponential backoff on 429 responses
- **Idempotency:** `edit_file` on the same anchor twice with the same `new_text` should be a no-op, not a duplicate insertion
- **Graceful degradation:** If LangSmith is unreachable, traces fall back to local JSON logging; agent does not crash

### Error Handling
- **Structured errors:** Tool failures return a consistent schema: `{"error": true, "type": "...", "message": "...", "recoverable": true/false}`
- **Max retry budget:** 3 retries per tool call; after that, escalate to user; never infinite-loop
- **File backup before edit:** Every `edit_file` call saves a `.bak` copy; revert is always possible

---

## Observability Requirements

### LangSmith Integration
- Set `LANGCHAIN_TRACING_V2=true` and `LANGCHAIN_API_KEY`
- All LangGraph runs auto-traced
- Tag traces by: task type, worker agent, success/failure

### Trace Requirements (MVP Gate)
- **Trace 1:** Normal successful edit (read → edit → verify → success)
- **Trace 2:** Error branch (read → edit fails → retry → success, OR escalate to human)

### Rebuild Logging
- Every human intervention logged with:
  - Timestamp
  - What broke
  - What you did
  - Time to resolve
  - What it reveals about the agent

---

## Full Deliverables Checklist

| Deliverable | Deadline | Status |
|---|---|---|
| PRESEARCH.md (all phases) | Pre-Search | [ ] |
| CODEAGENT.md (MVP sections) | Tuesday | [ ] |
| Persistent agent loop | Tuesday | [ ] |
| Surgical file editing | Tuesday | [ ] |
| Context injection | Tuesday | [ ] |
| Two LangSmith trace links | Tuesday | [ ] |
| Multi-agent coordination | Thursday | [ ] |
| Ship rebuild complete | Thursday | [ ] |
| Comparative analysis draft | Thursday | [ ] |
| CODEAGENT.md (all sections) | Sunday | [ ] |
| AI Development Log | Sunday | [ ] |
| AI Cost Analysis | Sunday | [ ] |
| Deployed application | Sunday | [ ] |
| Demo video (3-5 min) | Sunday | [ ] |
| Social post (@GauntletAI) | Sunday | [ ] |

# AI Development Log — Shipyard Agent

## 1. Tools & Workflow

| Tool | Role | How It Was Used |
|---|---|---|
| **Claude Sonnet 4.5** | Primary agent LLM | Powers the single-agent loop and backend/frontend workers. Handles complex code generation, surgical edits, and multi-step reasoning. |
| **GPT-4o-mini** | Cost-optimized tasks | Used for supervisor decomposition, shared types, and database workers — structured tasks where cheaper/faster models suffice. |
| **LangGraph** | Agent orchestration | StateGraph with manual routing (not create_react_agent). Two modes: single-agent (agent → tools loop) and multi-agent (supervisor → workers). |
| **LangSmith** | Observability | Auto-tracing via `LANGSMITH_TRACING=true`. All graph invocations traced with tool calls, token usage, and timing. |
| **Claude Code (CLI)** | Development environment | Used to write the agent itself, manage the codebase, run tests, and iterate on prompts. Meta-level: an AI coding tool building an AI coding tool. |

**Workflow:** Claude Code wrote the agent code (TDD: tests first, then implementation). The Shipyard agent then used itself to rebuild the Ship app — reading files, making surgical edits, running commands. Human intervention happened when the agent got stuck on environment issues (port conflicts, Docker networking) or made incorrect architectural decisions.

---

## 2. Effective Prompts

**Prompt 1 — System prompt core rules (drove correct agent behavior):**
```
1. Always read before editing. Never guess file contents. Call read_file first,
   then use the exact text you see as your anchor for edit_file.
2. Use exact anchors. The old_text in edit_file must be copied verbatim from
   the file. Include enough surrounding context to be unique.
3. Verify after editing. After each edit, the tool automatically verifies the
   change landed. If verification fails, re-read the file and try again.
```
*Why it worked:* The "read before edit" rule eliminated the most common failure mode — the LLM guessing file contents and producing anchors that don't match. Verification after edit catches silent failures.

**Prompt 2 — Supervisor grounding rules (prevented hallucination):**
```
Only decompose what was explicitly requested. Every subtask MUST trace back to
something the user actually said. Do NOT invent features, endpoints, components,
or fixes that the user did not ask for. When in doubt, do less.
```
*Why it worked:* Added after the multi-agent supervisor hallucinated an entire "Ships" feature when asked to fix 5 bugs. These rules reduced creative task invention to near-zero.

**Prompt 3 — Plan validation gate (second LLM call):**
```
Compare the original user instruction against the proposed task plan. Your job
is to REMOVE any tasks that the user did NOT explicitly request. If a task
invents a new feature, endpoint, or page that the user did not mention, REMOVE it.
```
*Why it worked:* Acts as a self-check between decomposition and execution. Catches hallucinated tasks before workers waste tokens executing them.

**Prompt 4 — Specific bug-fix instruction (single-agent, 100% success rate):**
```
Read the file ship/api/src/routes/teams.ts. The INSERT and UPDATE statements
use wrong column names — the teams table has columns (name, description) not
(title, content). Fix all SQL queries in this file to use the correct column
names. Also fix the SELECT queries if they reference title or content instead
of name or description.
```
*Why it worked:* Specific file path + exact problem description + clear expected outcome. The agent read the file, found every occurrence, fixed them all, and verified each edit. No ambiguity = no errors.

---

## 3. Code Analysis

| Category | Files | Approximate % |
|---|---|---|
| **Agent-generated (via Shipyard agent)** | Ship app CRUD routes, migrations, React pages, seed data, shared types | ~40% |
| **Claude Code-generated (via Claude Code CLI)** | Agent core (tools.py, agent.py, supervisor.py), tests, prompts, tracing | ~45% |
| **Hand-written** | .env configuration, Docker/Railway tweaks, architectural decisions, prompt refinements | ~15% |

Out of 38 total commits: 11 are "(agent-generated)" via the Shipyard agent, 27 via Claude Code or human edits. The agent generated most of the Ship app rebuild; Claude Code generated most of the agent infrastructure.

---

## 4. Strengths & Limitations

**Where the tools excelled:**
- TypeScript types generated correctly on first attempt (9/9 shared type tests passed)
- PostgreSQL migrations with proper constraints, indexes, and CHECK clauses — no manual fixes needed
- Full supertest suite (13 tests) generated and passing on first try
- React frontend with 4 views, routing, and API client — generated in one agent call
- Self-correction on tool errors: when `run_command` blocked `cd`, the agent switched to `pnpm --filter` without human help

**Where the tools fell short:**
- **Environment-specific issues:** Could not diagnose a port 5432 conflict between local PostgreSQL and Docker. Human had to identify via `lsof -i :5432` and switch Docker to port 5433.
- **Architecture decisions:** Agent followed the PRD's discriminator table pattern literally. Human decided to refactor to separate tables — the agent wouldn't question a spec.
- **Multi-agent hallucination:** Supervisor invented a "Ships" CRUD feature when asked to fix 5 specific bugs. The word "Ship" in the app name triggered creative task generation instead of bug parsing.
- **Docker optimization:** Agent added unnecessary nginx layer; human simplified to Express serving static files directly.

---

## 5. Key Learnings

1. **Single-agent outperforms multi-agent for precise tasks.** Single-agent mode was 100% accurate on every bug fix. Multi-agent mode fixed 3/5 bugs correctly while simultaneously hallucinating a feature. Use multi-agent for genuinely decomposable work (build a feature), not repair work (fix these specific bugs).

2. **"Read before edit" is the most important rule.** Without it, the LLM guesses file contents and produces anchors that don't match. This single rule eliminated the most common class of failures.

3. **Plan validation gates are cheap insurance.** One extra LLM call (~$0.01) to verify a task plan against the original instruction prevents expensive hallucinated work. The multi-agent hallucination created 10 wrong files that took manual cleanup — the validation gate would have caught it.

4. **Specific prompts > general prompts.** "Fix the column names in teams.ts" succeeded 100% of the time. "Fix bugs in the Ship app" triggered hallucination. The more precise the instruction, the better the output.

5. **The agent is a force multiplier, not a replacement.** It excels at boilerplate (CRUD routes, types, tests, migrations) and struggles with judgment calls (architecture, security, environment debugging). The optimal workflow is: human makes decisions, agent executes them.

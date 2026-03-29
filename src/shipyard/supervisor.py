"""Supervisor multi-agent graph.

Decomposes user instructions into ordered subtasks, dispatches each
to a specialized worker subgraph, and validates the combined results.

Graph shape:
    START → decompose → gather_context → execute_next_task → verify_task → check_if_done ──→ execute_next_task
                                                                                  └──→ validate → END
"""

import json
import os
import re
import subprocess

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from shipyard.models import get_llm_for_role
from shipyard.state import SupervisorState
from shipyard.tools import ALL_TOOLS
from shipyard.worker import build_worker_graph
from shipyard.worker_prompts import SUPERVISOR_PROMPT, WORKER_PROMPTS


VALID_WORKERS = frozenset({"backend", "frontend", "database", "shared"})


def extract_contract(task_description: str) -> str:
    """Extract critical values from a task description into a Contract block.

    Finds quoted lists, field definitions, and export patterns in the prompt
    and formats them into a structured section that gets appended to the end
    of the task description (exploiting LLM recency attention bias).

    Returns empty string if no extractable values found.
    """
    lines = []

    # Extract JSON-style lists: ["triage", "backlog", ...]
    list_matches = re.findall(r'\[(?:"[^"]+",?\s*)+\]', task_description)
    for match in list_matches:
        lines.append(f"- Values: {match}")

    # Extract field definitions: yesterday (TEXT), today (TEXT), etc.
    field_matches = re.findall(
        r"(\w+)\s*\((?:TEXT|VARCHAR|UUID|DATE|INT|TIMESTAMPTZ|BOOLEAN)\)",
        task_description,
        re.IGNORECASE,
    )
    if field_matches:
        lines.append(f"- Fields: {', '.join(field_matches)}")

    # Extract export function patterns
    export_matches = re.findall(
        r"(export\s+function\s+\w+\([^)]*\)(?:\s*:\s*\w+)?)",
        task_description,
    )
    for match in export_matches:
        lines.append(f"- Export: {match}")

    # Extract VALID_STATUSES-style constants
    const_matches = re.findall(
        r"(VALID_\w+)\s*=\s*(\[[^\]]+\])",
        task_description,
    )
    for name, value in const_matches:
        lines.append(f"- {name} = {value}")

    if not lines:
        return ""

    return (
        "\n\n## Contract (MUST match exactly — do not substitute alternatives)\n"
        + "\n".join(lines)
    )


def parse_task_plan(llm_output: str) -> list[dict]:
    """Parse a JSON task plan from the LLM's output.

    Looks for a JSON code block first, then tries bare JSON. Falls back
    to a single backend task if parsing fails. Unknown worker names are
    replaced with "backend".

    Returns:
        List of TaskItem dicts with status="pending" and result="".
    """
    # Try to extract from ```json ... ``` code block
    match = re.search(r"```json\s*\n?(.*?)\n?\s*```", llm_output, re.DOTALL)
    raw = match.group(1) if match else llm_output

    try:
        parsed = json.loads(raw)
        if not isinstance(parsed, list):
            parsed = [parsed]
    except (json.JSONDecodeError, TypeError):
        return [{
            "worker": "backend",
            "description": llm_output.strip(),
            "status": "pending",
            "result": "",
        }]

    tasks = []
    for item in parsed:
        worker = item.get("worker", "backend")
        if worker not in VALID_WORKERS:
            worker = "backend"
        tasks.append({
            "worker": worker,
            "description": item.get("description", ""),
            "status": "pending",
            "result": "",
        })
    return tasks


CONTRACT_GENERATION_PROMPT = """\
You are generating a shared interface contract for a multi-worker coding project.
Given the user's instruction and the task plan, produce a contract that ALL workers
must follow exactly.

## User instruction:
{instruction}

## Task plan:
{task_json}

## Output format — return ONLY a typescript code block:

```typescript
// === SHARED CONTRACT (ALL WORKERS MUST MATCH EXACTLY) ===

// 1. Enum values / constants
// List every enum, status set, or constant mentioned or implied

// 2. Field names / database columns
// Exact field names for each entity (snake_case for DB, camelCase for TS)

// 3. API endpoints
// Method, path, request body shape, response shape

// 4. Function signatures
// Export patterns each worker must use

// 5. TypeScript interfaces
// Request/response types that cross boundaries
```

## Rules:
- Extract EVERY specific value from the user instruction (enum members, field names, etc.)
- If the user specifies 7 statuses, list all 7. Do not substitute defaults.
- For field names, show both the SQL column name and the TypeScript property name.
- Include frontend API client function signatures so frontend knows how to call backend.
- Be exhaustive. Missing a single field name causes cross-boundary failures.
- Return ONLY the typescript code block. No explanation.
"""


def generate_shared_contract(state: SupervisorState, llm) -> dict:
    """Generate a shared interface contract from the task plan using an LLM.

    Synthesizes across all tasks to produce a canonical contract that
    every worker receives, preventing cross-boundary field name mismatches.
    """
    tasks = state.get("tasks", [])

    user_instruction = ""
    for msg in state["messages"]:
        if isinstance(msg, HumanMessage):
            user_instruction = msg.content
            break

    if not tasks or not user_instruction:
        return {"shared_contract": ""}

    task_json = json.dumps(
        [{"worker": t["worker"], "description": t["description"]} for t in tasks],
        indent=2,
    )

    prompt = CONTRACT_GENERATION_PROMPT.format(
        instruction=user_instruction,
        task_json=task_json,
    )

    try:
        response = llm.invoke([SystemMessage(content=prompt)])
        return {"shared_contract": response.content}
    except Exception:
        return {"shared_contract": ""}


PLAN_VALIDATION_PROMPT = """\
You are a quality gate. Compare the original user instruction against the \
proposed task plan. Your job is to REMOVE any tasks that the user did NOT \
explicitly request.

## Original instruction:
{instruction}

## Proposed tasks:
{task_json}

## Rules:
- If a task does not clearly map to something in the original instruction, \
REMOVE it from the list.
- If a task invents a new feature, endpoint, component, or page that the user \
did not mention, REMOVE it.
- If the user said "fix X", only keep tasks that fix X. Do not add "build Y".
- Return the filtered task list as a JSON code block. If all tasks are valid, \
return them unchanged.
- If ALL tasks are invalid, return a single task with worker "backend" and the \
full original instruction as the description.

Return ONLY a ```json``` code block.
"""


MAX_EXEMPLAR_LINES = 200


def _find_best_exemplar(
    directory: "Path", glob_pattern: str, task_text: str, max_candidates: int = 15
) -> "Path | None":
    """Find the exemplar file most relevant to the task descriptions.

    Scores files by keyword overlap with task text.
    Falls back to the first file alphabetically if no good match.
    """
    from pathlib import Path

    candidates = sorted(directory.glob(glob_pattern))[:max_candidates]
    if not candidates:
        return None

    task_words = set(task_text.lower().split())
    best_score = -1
    best_file = None

    for f in candidates:
        if not f.is_file():
            continue
        try:
            content_words = set(f.read_text(errors="replace").lower().split())
            score = len(task_words & content_words)
            if score > best_score:
                best_score = score
                best_file = f
        except (OSError, UnicodeDecodeError):
            continue

    return best_file or (candidates[0] if candidates else None)


def _read_exemplar(path: "Path", max_lines: int = MAX_EXEMPLAR_LINES) -> str:
    """Read up to max_lines from a file."""
    content = path.read_text(errors="replace")
    return "\n".join(content.splitlines()[:max_lines])


def gather_context(state: SupervisorState) -> dict:
    """Read exemplar files from workspace to inject codebase patterns into worker context.

    Scans task descriptions for keywords (route, migration, component, page)
    and reads the most relevant exemplar file of each type. Also builds an
    inventory of existing routes, migrations, and pages. No LLM call.
    """
    from shipyard.tools import _workspace_root

    if _workspace_root is None:
        return {"codebase_patterns": ""}

    tasks = state.get("tasks", [])
    all_descriptions = " ".join(t.get("description", "") for t in tasks).lower()

    patterns_parts = []

    # Route exemplar + inventory
    if any(kw in all_descriptions for kw in ["route", "router", "endpoint", "api"]):
        route_dir = _workspace_root / "ship" / "api" / "src" / "routes"
        if route_dir.exists():
            exemplar = _find_best_exemplar(route_dir, "*.ts", all_descriptions)
            if exemplar:
                preview = _read_exemplar(exemplar)
                patterns_parts.append(
                    f"### Route Pattern (from {exemplar.name})\n```typescript\n{preview}\n```"
                )
            # Inventory of existing routes
            existing = [f.stem for f in sorted(route_dir.glob("*.ts"))]
            if existing:
                patterns_parts.append(f"### Existing Routes: {', '.join(existing)}")

    # Migration exemplar + inventory
    if any(kw in all_descriptions for kw in ["migration", "table", "schema", "database"]):
        mig_dir = _workspace_root / "ship" / "api" / "src" / "db" / "migrations"
        if mig_dir.exists():
            sql_files = sorted(mig_dir.glob("*.sql"))
            if sql_files:
                exemplar = sql_files[-1]  # Latest migration
                content = exemplar.read_text(errors="replace")
                patterns_parts.append(
                    f"### Migration Pattern (from {exemplar.name})\n```sql\n{content}\n```"
                )
            existing = [f.name for f in sql_files]
            if existing:
                patterns_parts.append(f"### Existing Migrations: {', '.join(existing)}")

    # Component exemplar
    if any(kw in all_descriptions for kw in ["component", "form", "banner", "card"]):
        comp_dir = _workspace_root / "ship" / "web" / "src" / "components"
        if comp_dir.exists():
            exemplar = _find_best_exemplar(comp_dir, "*.tsx", all_descriptions)
            if exemplar:
                preview = _read_exemplar(exemplar)
                patterns_parts.append(
                    f"### Component Pattern (from {exemplar.name})\n```tsx\n{preview}\n```"
                )

    # Page exemplar
    if any(kw in all_descriptions for kw in ["page", "view"]):
        pages_dir = _workspace_root / "ship" / "web" / "src" / "pages"
        if pages_dir.exists():
            exemplar = _find_best_exemplar(pages_dir, "*.tsx", all_descriptions)
            if exemplar:
                preview = _read_exemplar(exemplar)
                patterns_parts.append(
                    f"### Page Pattern (from {exemplar.name})\n```tsx\n{preview}\n```"
                )

    # API client patterns (for frontend workers)
    if any(kw in all_descriptions for kw in ["component", "page", "frontend", "client", "form"]):
        client_file = _workspace_root / "ship" / "web" / "src" / "api" / "client.ts"
        if client_file.exists():
            content = client_file.read_text(errors="replace")
            lines = content.splitlines()
            preview = "\n".join(lines[-60:]) if len(lines) > 60 else content
            patterns_parts.append(
                f"### API Client Pattern (from client.ts)\n```typescript\n{preview}\n```"
            )

    if not patterns_parts:
        return {"codebase_patterns": "", "project_state": ""}

    codebase_patterns = (
        "## Codebase Patterns (MUST follow these exactly)\n\n"
        + "\n\n".join(patterns_parts)
    )

    # Scan project state inventory
    from shipyard.project_state import format_project_state, scan_project_state
    project_state_str = format_project_state(scan_project_state(_workspace_root))

    return {"codebase_patterns": codebase_patterns, "project_state": project_state_str}


def decompose(state: SupervisorState, llm) -> dict:
    """Decompose the user's instruction into an ordered task plan.

    Calls the supervisor LLM to produce a JSON task list, then validates
    the plan against the original instruction to prevent hallucination.
    """
    messages = [SystemMessage(content=SUPERVISOR_PROMPT)] + list(state["messages"])
    response = llm.invoke(messages)
    tasks = parse_task_plan(response.content)

    # Extract the user's original instruction for validation
    user_instruction = ""
    for msg in state["messages"]:
        if isinstance(msg, HumanMessage):
            user_instruction = msg.content
            break

    # Validate plan against original instruction
    if user_instruction and len(tasks) > 1:
        task_json = json.dumps(
            [{"worker": t["worker"], "description": t["description"]} for t in tasks],
            indent=2,
        )
        validation_prompt = PLAN_VALIDATION_PROMPT.format(
            instruction=user_instruction,
            task_json=task_json,
        )
        validation_response = llm.invoke([SystemMessage(content=validation_prompt)])
        validated_tasks = parse_task_plan(validation_response.content)
        if validated_tasks:
            tasks = validated_tasks

    return {"tasks": tasks, "current_task_index": 0}


def execute_next_task(state: SupervisorState, worker_graphs: dict) -> dict:
    """Execute the current task by invoking the appropriate worker graph.

    Args:
        state: Current supervisor state.
        worker_graphs: Dict mapping worker role → compiled worker graph.
    """
    index = state["current_task_index"]
    tasks = list(state["tasks"])

    # Guard: if no tasks or index out of range, skip to validate
    if not tasks or index >= len(tasks):
        return {"tasks": tasks, "current_task_index": index}

    task = tasks[index]

    # Budget circuit breaker — refuse to run if cost limit exceeded
    token_usage = dict(state.get("token_usage", {}))
    max_cost = float(os.environ.get("SHIPYARD_MAX_COST_USD", "10.0"))
    estimated_cost = token_usage.get("estimated_cost_usd", 0.0)
    if estimated_cost >= max_cost:
        tasks[index] = {
            **task,
            "status": "failed",
            "result": f"Budget exceeded: ${estimated_cost:.2f} >= ${max_cost:.2f} limit. "
                      f"Set SHIPYARD_MAX_COST_USD to increase.",
        }
        return {"tasks": tasks, "current_task_index": index + 1, "token_usage": token_usage}

    # Build context — only include sections relevant to this worker's role
    prior_context = ""
    worker_role = task["worker"]

    # Inject codebase patterns (filtered by role)
    codebase_patterns = state.get("codebase_patterns", "")
    if codebase_patterns:
        # Filter pattern sections to only relevant ones
        filtered_sections = []
        for section in codebase_patterns.split("\n### "):
            section_lower = section.lower()
            if worker_role == "backend" and any(k in section_lower for k in ["route", "migration", "existing routes", "existing migrations"]):
                filtered_sections.append(section)
            elif worker_role == "frontend" and any(k in section_lower for k in ["component", "page", "api client"]):
                filtered_sections.append(section)
            elif worker_role == "database" and any(k in section_lower for k in ["migration", "existing migrations"]):
                filtered_sections.append(section)
            elif worker_role == "shared":
                filtered_sections.append(section)
        if filtered_sections:
            prior_context += "\n## Codebase Patterns\n\n### " + "\n### ".join(filtered_sections) + "\n"

    # Inject shared contract (always — all workers need to agree on interfaces)
    shared_contract = state.get("shared_contract", "")
    if shared_contract:
        prior_context += f"\n{shared_contract}\n"

    # Inject project state inventory (compact — just list what exists)
    project_state = state.get("project_state", "")
    if project_state:
        prior_context += f"\n{project_state}\n"

    # Inject only relevant previous task results (same or dependency roles)
    for prev_task in tasks[:index]:
        if prev_task["result"]:
            # Backend needs to see database results; frontend needs backend results
            prev_role = prev_task["worker"]
            if prev_role == worker_role or prev_role in ("database", "shared"):
                prior_context += f"\n[{prev_role}]: {prev_task['result']}\n"

    # Append contract block to task description (recency bias)
    contract = extract_contract(task["description"])
    if contract:
        task = {**task, "description": task["description"] + contract}
        tasks[index] = task

    worker_graph = worker_graphs.get(task["worker"])
    if worker_graph is None:
        tasks[index] = {
            **task,
            "status": "failed",
            "result": f"Error: No worker found for role '{task['worker']}'",
        }
        return {"tasks": tasks, "current_task_index": index + 1}

    retry_counts = dict(state.get("retry_counts", {}))
    task_retries = retry_counts.get(f"exec_{index}", 0)

    # Cap worker iterations to prevent infinite agent→tools loops.
    # 50 steps ≈ 25 tool calls. Most tasks complete in 5-12 tool calls.
    worker_config = {"recursion_limit": 50}

    try:
        result = worker_graph.invoke(
            {
                "messages": [HumanMessage(content=task["description"])],
                "context": prior_context,
                "trace_steps": [],
            },
            config=worker_config,
        )
        worker_response = result["messages"][-1].content

        # Detect truncated output (max_tokens hit)
        truncation_markers = ["max_tokens", "output limit was reached", "output too long"]
        is_truncated = any(m in worker_response.lower() for m in truncation_markers)

        if is_truncated and task_retries < 1:
            # Retry once with a simplified prompt (strip context to save tokens)
            retry_counts[f"exec_{index}"] = task_retries + 1
            tasks[index] = {
                **task,
                "status": "pending",
                "result": "",
                "description": (
                    task["description"]
                    + "\n\nIMPORTANT: Your previous attempt was truncated due to output length. "
                    "Be more concise. Only output the essential code changes, no explanations."
                ),
            }
            return {
                "tasks": tasks,
                "current_task_index": index,
                "retry_counts": retry_counts,
            }

        # Track token usage (rough estimate: 4 chars ≈ 1 token)
        total_chars = sum(len(m.content) for m in result["messages"] if hasattr(m, "content"))
        est_tokens = total_chars // 4
        token_usage["total_tokens"] = token_usage.get("total_tokens", 0) + est_tokens
        # Rough cost: $3/M input + $15/M output for Claude Sonnet, ~$0.01/1K tokens average
        token_usage["estimated_cost_usd"] = token_usage.get("estimated_cost_usd", 0.0) + (est_tokens * 0.00001)

        tasks[index] = {**task, "status": "done", "result": worker_response}
    except Exception as e:
        error_msg = str(e)

        # Detect recursion limit (worker looped too many times)
        if "recursion limit" in error_msg.lower() or "GraphRecursionError" in error_msg:
            from shipyard.tools import _workspace_root as ws_root
            cleanup_note = _cleanup_incomplete_files(ws_root, task["worker"])
            tasks[index] = {
                **task,
                "status": "failed",
                "result": f"Worker hit iteration limit (50 steps). {cleanup_note}",
            }
            return {"tasks": tasks, "current_task_index": index + 1, "token_usage": token_usage}

        # Detect token limit errors from API
        if ("max_tokens" in error_msg.lower() or "output limit" in error_msg.lower()) and task_retries < 1:
            retry_counts[f"exec_{index}"] = task_retries + 1
            tasks[index] = {
                **task,
                "status": "pending",
                "result": "",
                "description": (
                    task["description"]
                    + "\n\nIMPORTANT: Previous attempt hit token limit. "
                    "Be extremely concise. Minimal code only, no explanations."
                ),
            }
            return {
                "tasks": tasks,
                "current_task_index": index,
                "retry_counts": retry_counts,
            }

        tasks[index] = {**task, "status": "failed", "result": f"Error: {error_msg}"}

    return {"tasks": tasks, "current_task_index": index + 1, "token_usage": token_usage}


def _check_contract_adherence(shared_contract: str, worker_result: str, worker_role: str) -> list[str]:
    """Check that key field names from the shared contract appear in the worker's output.

    Extracts interface field names from the contract and verifies the worker
    mentioned them. Returns list of warnings for missing fields.
    """
    warnings = []

    # Extract field names from TypeScript interfaces in the contract
    # Matches: fieldName: type or field_name: type
    field_matches = re.findall(r"(\w+)\s*[?]?\s*:\s*(?:string|number|boolean|any|null|UUID)", shared_contract, re.IGNORECASE)
    if not field_matches:
        return warnings

    # Filter to fields relevant to this worker's domain
    result_lower = worker_result.lower()
    for field in field_matches:
        # Skip generic fields that appear everywhere
        if field in ("id", "type", "status", "created_at", "updated_at", "deleted_at"):
            continue
        if field.lower() not in result_lower:
            warnings.append(f"Contract field '{field}' not found in {worker_role} output")

    # Only warn if more than 30% of fields are missing — avoid noise
    if len(warnings) > len(field_matches) * 0.3:
        return warnings[:5]  # Cap at 5 warnings
    return []


def _cleanup_incomplete_files(workspace_root, worker_role: str) -> str:
    """Check for .bak files created by a failed worker and revert them.

    When a worker fails mid-edit, edit_file leaves .bak backups.
    Revert edited files to their backup state. For newly created files
    (no .bak), leave them — they might be usable.

    Returns a note about what was cleaned up.
    """
    if workspace_root is None:
        return ""

    from pathlib import Path

    reverted = []
    if worker_role == "backend":
        scan_dir = Path(workspace_root) / "ship" / "api" / "src"
    elif worker_role == "frontend":
        scan_dir = Path(workspace_root) / "ship" / "web" / "src"
    else:
        return ""

    if not scan_dir.exists():
        return ""

    for bak_file in scan_dir.rglob("*.bak"):
        original = bak_file.with_suffix("")
        if original.exists():
            original.write_text(bak_file.read_text())
            bak_file.unlink()
            reverted.append(str(original.relative_to(workspace_root)))

    if reverted:
        return f"Reverted {len(reverted)} edited files to pre-edit state: {', '.join(reverted)}"
    return "No edited files to revert."


def _retry_task(tasks, index, retry_counts, error_output, error_label):
    """Set a task back to pending with error context for retry."""
    task = tasks[index]
    task_retries = retry_counts.get(str(index), 0)

    if task_retries >= 2:
        tasks[index] = {
            **task,
            "result": task["result"] + f"\n\n⚠️ {error_label} failed after 2 retries.",
        }
        return {"tasks": tasks, "retry_counts": retry_counts}

    tasks[index] = {
        **task,
        "status": "pending",
        "result": "",
        "description": (
            task["description"]
            + f"\n\n## {error_label} — FIX THIS ERROR:\n```\n{error_output}\n```\n"
            "Read the error carefully and fix the generated code."
        ),
    }
    retry_counts[str(index)] = task_retries + 1

    return {
        "tasks": tasks,
        "current_task_index": index,
        "retry_counts": retry_counts,
    }


def _task_only_created_files(worker_response: str) -> bool:
    """Check if the worker only created new files (no edits to existing ones).

    New-file-only tasks can't break existing compilation, so we can skip
    full tsc/vitest and just check the new files individually.
    """
    response_lower = worker_response.lower()
    # If worker mentioned editing/modifying existing files, needs full check
    edit_signals = ["edit_file", "edited", "modified", "replaced", "updated file"]
    return not any(signal in response_lower for signal in edit_signals)


def verify_task(state: SupervisorState) -> dict:
    """Run build verification after a task completes.

    Smart verification strategy:
    - Skip entirely for database/shared workers
    - Skip full tsc+vitest if worker only created new files (can't break existing code)
    - Run tsc only (skip vitest) for standard tasks — vitest on full suite is slow
    - Only run vitest if the worker created test files
    If tsc fails and retries < 2, sets task back to pending with the error.
    """
    from shipyard.tools import _workspace_root

    tasks = list(state["tasks"])
    index = state["current_task_index"] - 1  # Just-completed task
    retry_counts = dict(state.get("retry_counts", {}))

    if index < 0 or index >= len(tasks):
        return {"tasks": tasks, "retry_counts": retry_counts}

    task = tasks[index]

    # Skip verification for non-code workers and failed tasks
    if task["worker"] in ("database", "shared") or task["status"] != "done":
        return {"tasks": tasks, "retry_counts": retry_counts}

    if _workspace_root is None:
        return {"tasks": tasks, "retry_counts": retry_counts}

    if task["worker"] == "backend":
        check_dir = _workspace_root / "ship" / "api"
    elif task["worker"] == "frontend":
        check_dir = _workspace_root / "ship" / "web"
    else:
        return {"tasks": tasks, "retry_counts": retry_counts}

    if not check_dir.exists():
        return {"tasks": tasks, "retry_counts": retry_counts}

    # Check contract adherence — verify key field names appear in worker output
    shared_contract = state.get("shared_contract", "")
    if shared_contract and task.get("result"):
        contract_warnings = _check_contract_adherence(shared_contract, task["result"], task["worker"])
        if contract_warnings:
            # Append warnings to result but don't fail — informational
            tasks[index] = {
                **task,
                "result": task["result"] + "\n\nContract warnings: " + "; ".join(contract_warnings),
            }

    # Check lockfile is in sync if worker modified package.json
    worker_result = task.get("result", "").lower()
    if "package.json" in worker_result:
        try:
            lockfile_check = subprocess.run(
                ["pnpm", "install", "--frozen-lockfile"],
                cwd=_workspace_root / "ship",
                capture_output=True,
                timeout=60,
            )
            if lockfile_check.returncode != 0:
                # Lockfile out of date — run pnpm install to fix it
                subprocess.run(
                    ["pnpm", "install"],
                    cwd=_workspace_root / "ship",
                    capture_output=True,
                    timeout=120,
                )
                tasks[index] = {
                    **task,
                    "result": task["result"] + "\n\n⚠️ Lockfile was out of sync — auto-fixed with pnpm install.",
                }
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass

    # Skip full verification if worker only created new files
    if _task_only_created_files(task.get("result", "")):
        return {"tasks": tasks, "retry_counts": retry_counts}

    # Run tsc --noEmit (fast type check)
    try:
        result = subprocess.run(
            ["npx", "tsc", "--noEmit"],
            cwd=check_dir,
            capture_output=True,
            timeout=60,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return {"tasks": tasks, "retry_counts": retry_counts}

    if result.returncode != 0:
        error_output = result.stderr.decode()[:1000]
        return _retry_task(tasks, index, retry_counts, error_output, "BUILD FAILED")

    # Only run vitest if the worker created test files
    worker_result = task.get("result", "").lower()
    has_tests = "test" in worker_result and ("created" in worker_result or "wrote" in worker_result)
    if not has_tests:
        return {"tasks": tasks, "retry_counts": retry_counts}

    try:
        test_result = subprocess.run(
            ["npx", "vitest", "run", "--reporter=verbose", "--bail=1", "--passWithNoTests"],
            cwd=check_dir,
            capture_output=True,
            timeout=120,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return {"tasks": tasks, "retry_counts": retry_counts}

    if test_result.returncode != 0:
        error_output = test_result.stderr.decode()[:1000]
        if not error_output:
            error_output = test_result.stdout.decode()[:1000]
        return _retry_task(tasks, index, retry_counts, error_output, "TESTS FAILED")

    # Both tsc and vitest passed
    return {"tasks": tasks, "retry_counts": retry_counts}


def _check_cross_boundary_consistency(workspace_root) -> list[str]:
    """Check that frontend API calls match backend route registrations.

    Returns a list of warning strings (empty if consistent).
    """
    from pathlib import Path

    warnings = []
    app_file = Path(workspace_root) / "ship" / "api" / "src" / "app.ts"
    if not app_file.exists():
        return warnings

    app_content = app_file.read_text(errors="replace")
    registered_paths = set(re.findall(r'app\.use\("(/api/[^"]+)"', app_content))

    client_file = Path(workspace_root) / "ship" / "web" / "src" / "api" / "client.ts"
    if not client_file.exists():
        return warnings

    client_content = client_file.read_text(errors="replace")
    called_paths = set()
    for match in re.findall(r'(?:fetch|authFetch)\([`"\'](/api/[^`"\'?]+)', client_content):
        base = "/" + "/".join(match.strip("/").split("/")[:2])
        called_paths.add(base)

    for path in sorted(called_paths):
        if path not in registered_paths:
            warnings.append(f"Frontend calls {path} but no backend route registered in app.ts")

    return warnings


def _auto_wire_routes(workspace_root) -> list[str]:
    """Scan for route files not registered in app.ts and add them.

    Returns list of actions taken.
    """
    from pathlib import Path

    actions = []
    app_file = Path(workspace_root) / "ship" / "api" / "src" / "app.ts"
    route_dir = Path(workspace_root) / "ship" / "api" / "src" / "routes"

    if not app_file.exists() or not route_dir.exists():
        return actions

    app_content = app_file.read_text(errors="replace")

    for route_file in sorted(route_dir.glob("*.ts")):
        stem = route_file.stem
        # Skip index, health, swagger, and files already imported
        if stem in ("index", "health", "swagger"):
            continue

        # Check if already imported
        if f"from \"./routes/{stem}" in app_content:
            continue

        # Derive function name: teams -> createTeamsRouter, sprint-reviews -> createSprintReviewsRouter
        parts = stem.split("-")
        camel = "".join(p.capitalize() for p in parts)
        func_name = f"create{camel}Router"
        api_path = f"/api/{stem}"

        # Verify the file actually exports this function
        file_content = route_file.read_text(errors="replace")
        if func_name not in file_content:
            continue

        # Add import after last import line
        import_line = f'import {{ {func_name} }} from "./routes/{stem}.js";'
        route_line = f'  app.use("{api_path}", {func_name}(pool));'

        # Find insertion points
        lines = app_content.splitlines()
        last_import_idx = 0
        last_route_idx = 0
        for i, line in enumerate(lines):
            if line.strip().startswith("import "):
                last_import_idx = i
            if 'app.use("/api/' in line:
                last_route_idx = i

        lines.insert(last_import_idx + 1, import_line)
        # Adjust for the inserted import line
        lines.insert(last_route_idx + 2, route_line)

        app_content = "\n".join(lines) + "\n"
        actions.append(f"Wired {api_path} -> {func_name}")

    if actions:
        app_file.write_text(app_content)

    return actions


def _auto_wire_pages(workspace_root) -> list[str]:
    """Scan for page files not routed in App.tsx and add them.

    Returns list of actions taken.
    """
    from pathlib import Path

    actions = []
    app_tsx = Path(workspace_root) / "ship" / "web" / "src" / "App.tsx"
    pages_dir = Path(workspace_root) / "ship" / "web" / "src" / "pages"

    if not app_tsx.exists() or not pages_dir.exists():
        return actions

    app_content = app_tsx.read_text(errors="replace")

    for page_file in sorted(pages_dir.glob("*Page.tsx")):
        component = page_file.stem  # e.g., "SettingsPage"

        # Check if already imported
        if f"import {component}" in app_content:
            continue

        # Derive route path: SettingsPage -> settings, OrgChartPage -> org-chart
        # Remove "Page" suffix, convert CamelCase to kebab-case
        name = component.replace("Page", "")
        route_path = re.sub(r"([a-z])([A-Z])", r"\1-\2", name).lower()

        import_line = f"import {component} from './pages/{component}';"
        route_line = f'          <Route path="{route_path}" element={{<{component} />}} />'

        lines = app_content.splitlines()

        # Find last page import
        last_import_idx = 0
        for i, line in enumerate(lines):
            if "import " in line and "Page" in line and "from './pages/" in line:
                last_import_idx = i

        # Find last Route line inside the Layout routes
        last_route_idx = 0
        for i, line in enumerate(lines):
            if '<Route path="' in line and 'element={<' in line and 'Page' in line:
                last_route_idx = i

        if last_import_idx == 0 or last_route_idx == 0:
            continue

        lines.insert(last_import_idx + 1, import_line)
        lines.insert(last_route_idx + 2, route_line)

        app_content = "\n".join(lines) + "\n"
        actions.append(f"Wired /{route_path} -> {component}")

    if actions:
        app_tsx.write_text(app_content)

    return actions


def check_if_done(state: SupervisorState) -> str:
    """Route back to execute_next_task if tasks remain, else to validate."""
    tasks = state.get("tasks", [])
    if tasks and state["current_task_index"] < len(tasks):
        return "execute_next_task"
    return "validate"


def validate(state: SupervisorState) -> dict:
    """Summarize all task results and run final integration checks."""
    from shipyard.tools import _workspace_root

    lines = ["## Task Results\n"]
    for i, task in enumerate(state["tasks"], 1):
        status_icon = "done" if task["status"] == "done" else "FAILED"
        lines.append(f"**{i}. [{status_icon}] {task['worker']}:** {task['description']}")
        if task["result"]:
            lines.append(f"   -> {task['result']}")
        lines.append("")

    # Collect test files created during this run for potential enrichment
    test_files_created = []
    if _workspace_root:
        for task_item in state["tasks"]:
            result_text = task_item.get("result", "")
            # Extract test file paths from worker results
            for match in re.findall(r"(ship/\S+\.test\.\w+)", result_text):
                test_path = _workspace_root / match
                if test_path.exists():
                    test_files_created.append(str(match))

    # Auto-wire any new routes and pages
    if _workspace_root:
        for action in _auto_wire_routes(_workspace_root):
            lines.append(f"**Auto-wired:** {action}")
        for action in _auto_wire_pages(_workspace_root):
            lines.append(f"**Auto-wired:** {action}")

    # Final integration checks
    if _workspace_root:
        # Final build check on both API and web
        for subdir in ["ship/api", "ship/web"]:
            check_dir = _workspace_root / subdir
            if check_dir.exists():
                try:
                    result = subprocess.run(
                        ["npx", "tsc", "--noEmit"],
                        cwd=check_dir,
                        capture_output=True,
                        timeout=60,
                    )
                    if result.returncode != 0:
                        error = result.stderr.decode()[:300]
                        lines.append(f"**WARNING: {subdir} build failed:**\n```\n{error}\n```")
                except (subprocess.TimeoutExpired, FileNotFoundError):
                    pass

        # Cross-boundary consistency check
        warnings = _check_cross_boundary_consistency(_workspace_root)
        for w in warnings:
            lines.append(f"**WARNING:** {w}")

    if test_files_created:
        lines.append(f"\n**Test files created:** {', '.join(test_files_created)}")
        lines.append("Tip: Run test enrichment to add edge case tests.")

    summary = "\n".join(lines)
    return {"messages": [AIMessage(content=summary)]}


def build_supervisor_graph(llm=None, worker_llm=None):
    """Build and compile the supervisor multi-agent graph.

    Args:
        llm: Optional supervisor LLM. If None, creates ChatAnthropic.
        worker_llm: Optional LLM for all workers. If None, each worker
                    creates its own ChatAnthropic instance.

    Returns:
        A compiled LangGraph StateGraph.
    """
    if llm is None:
        supervisor_llm = get_llm_for_role("supervisor")
    else:
        supervisor_llm = llm

    # Build worker graphs for each role, using cost-optimized model selection
    worker_graphs = {}
    for role, prompt in WORKER_PROMPTS.items():
        if worker_llm is not None:
            bound = worker_llm
        else:
            bound = get_llm_for_role(role).bind_tools(ALL_TOOLS)
        worker_graphs[role] = build_worker_graph(
            role=role,
            system_prompt=prompt,
            llm=bound,
        )

    # Create node functions that close over the LLM and worker graphs
    def decompose_node(state: SupervisorState) -> dict:
        return decompose(state, supervisor_llm)

    def contract_node(state: SupervisorState) -> dict:
        return generate_shared_contract(state, supervisor_llm)

    def execute_node(state: SupervisorState) -> dict:
        return execute_next_task(state, worker_graphs)

    graph = StateGraph(SupervisorState)
    graph.add_node("decompose", decompose_node)
    graph.add_node("generate_shared_contract", contract_node)
    graph.add_node("gather_context", gather_context)
    graph.add_node("execute_next_task", execute_node)
    graph.add_node("verify_task", verify_task)
    graph.add_node("validate", validate)

    graph.add_edge(START, "decompose")
    graph.add_edge("decompose", "generate_shared_contract")
    graph.add_edge("generate_shared_contract", "gather_context")
    graph.add_edge("gather_context", "execute_next_task")
    graph.add_edge("execute_next_task", "verify_task")
    graph.add_conditional_edges(
        "verify_task",
        check_if_done,
        {"execute_next_task": "execute_next_task", "validate": "validate"},
    )
    graph.add_edge("validate", END)

    return graph.compile()

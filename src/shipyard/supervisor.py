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


def gather_context(state: SupervisorState) -> dict:
    """Read exemplar files from workspace to inject codebase patterns into worker context.

    Scans task descriptions for keywords (route, migration, component, page)
    and reads one exemplar file of each type. No LLM call — purely deterministic.
    """
    from shipyard.tools import _workspace_root

    if _workspace_root is None:
        return {"codebase_patterns": ""}

    tasks = state.get("tasks", [])
    all_descriptions = " ".join(t.get("description", "") for t in tasks).lower()

    patterns_parts = []

    # Route exemplar
    if any(kw in all_descriptions for kw in ["route", "router", "endpoint", "api"]):
        route_dir = _workspace_root / "ship" / "api" / "src" / "routes"
        if route_dir.exists():
            # Prefer teams.ts as cleanest example, fall back to any .ts file
            exemplar = route_dir / "teams.ts"
            if not exemplar.exists():
                ts_files = sorted(route_dir.glob("*.ts"))
                exemplar = ts_files[0] if ts_files else None
            if exemplar and exemplar.exists():
                content = exemplar.read_text()
                # Extract first 30 lines (enough for pattern)
                preview = "\n".join(content.splitlines()[:30])
                patterns_parts.append(
                    f"### Route Pattern (from {exemplar.name})\n```typescript\n{preview}\n```"
                )

    # Migration exemplar
    if any(kw in all_descriptions for kw in ["migration", "table", "schema", "database"]):
        mig_dir = _workspace_root / "ship" / "api" / "src" / "db" / "migrations"
        if mig_dir.exists():
            sql_files = sorted(mig_dir.glob("*.sql"))
            if sql_files:
                exemplar = sql_files[-1]  # Latest migration
                content = exemplar.read_text()
                patterns_parts.append(
                    f"### Migration Pattern (from {exemplar.name})\n```sql\n{content}\n```"
                )

    # Component exemplar
    if any(kw in all_descriptions for kw in ["component", "form", "banner", "card"]):
        comp_dir = _workspace_root / "ship" / "web" / "src" / "components"
        if comp_dir.exists():
            exemplar = comp_dir / "DocumentForm.tsx"
            if not exemplar.exists():
                tsx_files = sorted(comp_dir.glob("*.tsx"))
                exemplar = tsx_files[0] if tsx_files else None
            if exemplar and exemplar.exists():
                content = exemplar.read_text()
                preview = "\n".join(content.splitlines()[:30])
                patterns_parts.append(
                    f"### Component Pattern (from {exemplar.name})\n```tsx\n{preview}\n```"
                )

    # Page exemplar
    if any(kw in all_descriptions for kw in ["page", "view"]):
        pages_dir = _workspace_root / "ship" / "web" / "src" / "pages"
        if pages_dir.exists():
            exemplar = pages_dir / "IssuesPage.tsx"
            if not exemplar.exists():
                tsx_files = sorted(pages_dir.glob("*.tsx"))
                exemplar = tsx_files[0] if tsx_files else None
            if exemplar and exemplar.exists():
                content = exemplar.read_text()
                preview = "\n".join(content.splitlines()[:40])
                patterns_parts.append(
                    f"### Page Pattern (from {exemplar.name})\n```tsx\n{preview}\n```"
                )

    if not patterns_parts:
        return {"codebase_patterns": ""}

    codebase_patterns = (
        "## Codebase Patterns (MUST follow these exactly)\n\n"
        + "\n\n".join(patterns_parts)
    )
    return {"codebase_patterns": codebase_patterns}


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

    # Build context from previous task results + codebase patterns + contract
    prior_context = ""

    # Inject codebase patterns (from gather_context node)
    codebase_patterns = state.get("codebase_patterns", "")
    if codebase_patterns:
        prior_context += f"\n{codebase_patterns}\n"

    # Inject previous task results
    for prev_task in tasks[:index]:
        if prev_task["result"]:
            prior_context += f"\n[{prev_task['worker']}]: {prev_task['result']}\n"

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

    try:
        result = worker_graph.invoke({
            "messages": [HumanMessage(content=task["description"])],
            "context": prior_context,
            "trace_steps": [],
        })
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


def verify_task(state: SupervisorState) -> dict:
    """Run build verification after a task completes.

    For backend/frontend workers, runs TypeScript compilation check.
    If compilation fails and retries < 2, sets task back to pending
    with the compiler error appended so the worker can self-correct.
    """
    import subprocess
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

    # Determine which directory to check
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

    # Run tsc --noEmit
    try:
        result = subprocess.run(
            ["npx", "tsc", "--noEmit"],
            cwd=check_dir,
            capture_output=True,
            timeout=60,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError):
        # Can't verify — pass through
        return {"tasks": tasks, "retry_counts": retry_counts}

    if result.returncode == 0:
        # Build passes — no changes needed
        return {"tasks": tasks, "retry_counts": retry_counts}

    # Build failed — retry if under limit
    task_retries = retry_counts.get(str(index), 0)
    if task_retries >= 2:
        # Max retries exhausted — mark result with warning
        tasks[index] = {
            **task,
            "result": task["result"] + "\n\n⚠️ Build verification failed after 2 retries.",
        }
        return {"tasks": tasks, "retry_counts": retry_counts}

    # Set task back to pending with compiler error
    error_output = result.stderr.decode()[:500]
    tasks[index] = {
        **task,
        "status": "pending",
        "result": "",
        "description": (
            task["description"]
            + f"\n\n## BUILD FAILED — FIX THIS ERROR:\n```\n{error_output}\n```\n"
            "Read the error carefully and fix the generated code."
        ),
    }
    retry_counts[str(index)] = task_retries + 1

    return {
        "tasks": tasks,
        "current_task_index": index,  # Go back to retry this task
        "retry_counts": retry_counts,
    }


def check_if_done(state: SupervisorState) -> str:
    """Route back to execute_next_task if tasks remain, else to validate."""
    tasks = state.get("tasks", [])
    if tasks and state["current_task_index"] < len(tasks):
        return "execute_next_task"
    return "validate"


def validate(state: SupervisorState) -> dict:
    """Summarize all task results into a final response message."""
    lines = ["## Task Results\n"]
    for i, task in enumerate(state["tasks"], 1):
        status_icon = "done" if task["status"] == "done" else "FAILED"
        lines.append(f"**{i}. [{status_icon}] {task['worker']}:** {task['description']}")
        if task["result"]:
            lines.append(f"   → {task['result']}")
        lines.append("")

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

    def execute_node(state: SupervisorState) -> dict:
        return execute_next_task(state, worker_graphs)

    graph = StateGraph(SupervisorState)
    graph.add_node("decompose", decompose_node)
    graph.add_node("gather_context", gather_context)
    graph.add_node("execute_next_task", execute_node)
    graph.add_node("verify_task", verify_task)
    graph.add_node("validate", validate)

    graph.add_edge(START, "decompose")
    graph.add_edge("decompose", "gather_context")
    graph.add_edge("gather_context", "execute_next_task")
    graph.add_edge("execute_next_task", "verify_task")
    graph.add_conditional_edges(
        "verify_task",
        check_if_done,
        {"execute_next_task": "execute_next_task", "validate": "validate"},
    )
    graph.add_edge("validate", END)

    return graph.compile()

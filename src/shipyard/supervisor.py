"""Supervisor multi-agent graph.

Decomposes user instructions into ordered subtasks, dispatches each
to a specialized worker subgraph, and validates the combined results.

Graph shape:
    START → decompose → execute_next_task → check_if_done ──→ execute_next_task
                                                  └──→ validate → END
"""

import json
import re

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from shipyard.models import get_llm_for_role
from shipyard.state import SupervisorState
from shipyard.tools import ALL_TOOLS
from shipyard.worker import build_worker_graph
from shipyard.worker_prompts import SUPERVISOR_PROMPT, WORKER_PROMPTS


def parse_task_plan(llm_output: str) -> list[dict]:
    """Parse a JSON task plan from the LLM's output.

    Looks for a JSON code block first, then tries bare JSON. Falls back
    to a single backend task if parsing fails.

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
        tasks.append({
            "worker": item.get("worker", "backend"),
            "description": item.get("description", ""),
            "status": "pending",
            "result": "",
        })
    return tasks


def decompose(state: SupervisorState, llm) -> dict:
    """Decompose the user's instruction into an ordered task plan.

    Calls the supervisor LLM to produce a JSON task list, then parses it.
    """
    messages = [SystemMessage(content=SUPERVISOR_PROMPT)] + list(state["messages"])
    response = llm.invoke(messages)
    tasks = parse_task_plan(response.content)
    return {"tasks": tasks, "current_task_index": 0}


def execute_next_task(state: SupervisorState, worker_graphs: dict) -> dict:
    """Execute the current task by invoking the appropriate worker graph.

    Args:
        state: Current supervisor state.
        worker_graphs: Dict mapping worker role → compiled worker graph.
    """
    index = state["current_task_index"]
    tasks = list(state["tasks"])
    task = tasks[index]

    # Build context from previous task results
    prior_context = ""
    for prev_task in tasks[:index]:
        if prev_task["result"]:
            prior_context += f"\n[{prev_task['worker']}]: {prev_task['result']}\n"

    worker_graph = worker_graphs.get(task["worker"])
    if worker_graph is None:
        tasks[index] = {
            **task,
            "status": "failed",
            "result": f"Error: No worker found for role '{task['worker']}'",
        }
        return {"tasks": tasks, "current_task_index": index + 1}

    try:
        result = worker_graph.invoke({
            "messages": [HumanMessage(content=task["description"])],
            "context": prior_context,
            "trace_steps": [],
        })
        worker_response = result["messages"][-1].content
        tasks[index] = {**task, "status": "done", "result": worker_response}
    except Exception as e:
        tasks[index] = {**task, "status": "failed", "result": f"Error: {e}"}

    return {"tasks": tasks, "current_task_index": index + 1}


def check_if_done(state: SupervisorState) -> str:
    """Route back to execute_next_task if tasks remain, else to validate."""
    if state["current_task_index"] < len(state["tasks"]):
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
    graph.add_node("execute_next_task", execute_node)
    graph.add_node("validate", validate)

    graph.add_edge(START, "decompose")
    graph.add_edge("decompose", "execute_next_task")
    graph.add_conditional_edges(
        "execute_next_task",
        check_if_done,
        {"execute_next_task": "execute_next_task", "validate": "validate"},
    )
    graph.add_edge("validate", END)

    return graph.compile()

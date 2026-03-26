"""Evaluation runner — executes tasks and checks expectations."""

import time
from pathlib import Path

from langchain_core.messages import AIMessage, HumanMessage

from shipyard.agent import build_graph
from shipyard.evals.tasks import (
    EvalResult,
    EvalTask,
    Expectation,
    ExpectationResult,
)
from shipyard.supervisor import build_supervisor_graph
from shipyard.tools import set_workspace


def check_expectation(
    exp: Expectation, workspace: Path, messages: list
) -> ExpectationResult:
    """Check a single expectation against the workspace or messages."""
    path = workspace / exp.path if exp.path else None

    if exp.type == "file_exists":
        passed = path is not None and path.exists()
        detail = f"{'Found' if passed else 'Missing'}: {exp.path}"

    elif exp.type == "file_contains":
        if path is None or not path.exists():
            return ExpectationResult(exp, False, f"File not found: {exp.path}")
        content = path.read_text()
        passed = exp.value in content
        detail = (
            f"'{exp.value}' found in {exp.path}"
            if passed
            else f"'{exp.value}' NOT found in {exp.path}"
        )

    elif exp.type == "file_not_contains":
        if path is None or not path.exists():
            return ExpectationResult(exp, True, f"File not found (OK for not_contains)")
        content = path.read_text()
        passed = exp.value not in content
        detail = (
            f"'{exp.value}' absent from {exp.path}"
            if passed
            else f"'{exp.value}' still present in {exp.path}"
        )

    elif exp.type == "file_not_exists":
        passed = path is None or not path.exists()
        detail = f"{'Absent' if passed else 'Exists unexpectedly'}: {exp.path}"

    elif exp.type == "response_contains":
        last_ai = ""
        for msg in reversed(messages):
            if isinstance(msg, AIMessage) and msg.content:
                last_ai = msg.content
                break
        passed = exp.value.lower() in last_ai.lower()
        detail = (
            f"Response mentions '{exp.value}'"
            if passed
            else f"Response does NOT mention '{exp.value}'"
        )

    else:
        return ExpectationResult(exp, False, f"Unknown expectation type: {exp.type}")

    return ExpectationResult(exp, passed, detail)


def run_task(
    task: EvalTask,
    workspace: Path,
    llm=None,
    supervisor_llm=None,
    worker_llm=None,
) -> EvalResult:
    """Execute an evaluation task and return the result.

    Args:
        task: The task definition.
        workspace: Isolated directory for file operations.
        llm: Mock LLM for single-agent mode (None = real API).
        supervisor_llm: Mock for supervisor in multi-agent mode.
        worker_llm: Mock for workers in multi-agent mode.
    """
    # Setup workspace files
    for setup in task.setup_files:
        p = workspace / setup.path
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(setup.content)

    set_workspace(workspace)

    # Build graph
    if task.agent_mode == "multi":
        graph = build_supervisor_graph(
            llm=supervisor_llm, worker_llm=worker_llm
        )
        initial_state = {
            "messages": [HumanMessage(content=task.instruction)],
            "context": task.context,
            "memories": "",
            "rules": "",
            "trace_steps": [],
            "tasks": [],
            "current_task_index": 0,
        }
    else:
        graph = build_graph(llm=llm)
        initial_state = {
            "messages": [HumanMessage(content=task.instruction)],
            "context": task.context,
            "memories": "",
            "rules": "",
            "trace_steps": [],
        }

    # Invoke
    start = time.monotonic()
    error = None
    messages = []
    try:
        result = graph.invoke(initial_state)
        messages = list(result["messages"])
    except Exception as e:
        error = str(e)

    duration_ms = int((time.monotonic() - start) * 1000)

    # Extract tool calls
    tool_calls = []
    for msg in messages:
        if isinstance(msg, AIMessage) and hasattr(msg, "tool_calls") and msg.tool_calls:
            for tc in msg.tool_calls:
                tool_calls.append(tc["name"])

    # Check expectations
    exp_results = [
        check_expectation(exp, workspace, messages)
        for exp in task.expectations
    ]

    passed_count = sum(1 for r in exp_results if r.passed)
    total = len(exp_results)
    score = passed_count / total if total > 0 else 1.0
    all_passed = (passed_count == total) and error is None

    return EvalResult(
        task_name=task.name,
        category=task.category,
        passed=all_passed,
        score=score,
        expectation_results=exp_results,
        tool_calls=tool_calls,
        tool_call_count=len(tool_calls),
        duration_ms=duration_ms,
        error=error,
        messages=messages,
    )

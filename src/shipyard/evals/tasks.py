"""Evaluation task definitions for the Shipyard agent."""

from dataclasses import dataclass, field


@dataclass
class FileSetup:
    """A file to create in the workspace before running the task."""
    path: str
    content: str


@dataclass
class Expectation:
    """A single expected outcome to verify after the task runs.

    Types:
        file_exists: Check that path exists in workspace
        file_contains: Check that workspace/path contains value
        file_not_contains: Check that workspace/path does NOT contain value
        file_not_exists: Check that path does NOT exist
        response_contains: Check that last AI message contains value
    """
    type: str
    path: str = ""
    value: str = ""


@dataclass
class EvalTask:
    """A structured evaluation task for the Shipyard agent."""
    name: str
    category: str
    instruction: str
    setup_files: list[FileSetup]
    expectations: list[Expectation]
    mock_responses: list = field(default_factory=list)
    agent_mode: str = "single"
    context: str = ""


@dataclass
class ExpectationResult:
    """Result of checking a single expectation."""
    expectation: Expectation
    passed: bool
    detail: str


@dataclass
class EvalResult:
    """Result of running a single evaluation task."""
    task_name: str
    category: str
    passed: bool
    score: float
    expectation_results: list[ExpectationResult]
    tool_calls: list[str]
    tool_call_count: int
    duration_ms: int
    error: str | None
    messages: list = field(default_factory=list)


def get_task(name: str, tasks: list[EvalTask]) -> EvalTask | None:
    """Find a task by name."""
    for t in tasks:
        if t.name == name:
            return t
    return None


def get_tasks_by_category(category: str, tasks: list[EvalTask]) -> list[EvalTask]:
    """Filter tasks by category."""
    return [t for t in tasks if t.category == category]

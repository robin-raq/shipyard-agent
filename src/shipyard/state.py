"""Agent state schema for the LangGraph state graph."""

from typing import Annotated
from typing_extensions import TypedDict
from langgraph.graph.message import add_messages


class TaskItem(TypedDict):
    """A single subtask assigned to a worker agent.

    Fields:
        worker: Which worker handles this ("backend", "frontend", "database", "shared").
        description: What the worker should do.
        status: Current status ("pending", "done", "failed").
        result: Summary returned by the worker when complete.
    """
    worker: str
    description: str
    status: str
    result: str


class AgentState(TypedDict):
    """State that flows through every node in the agent graph.

    Fields:
        messages: Conversation history (LLM messages + tool results).
                  Uses add_messages reducer to append, not replace.
        context:  Injected context from /context command.
                  Prepended to system prompt when non-empty. Cleared after use.
        trace_steps: Accumulator for local JSON trace steps during a run.
    """
    messages: Annotated[list, add_messages]
    context: str
    memories: str
    rules: str
    trace_steps: list


class SupervisorState(TypedDict):
    """State for the supervisor multi-agent graph.

    Fields:
        messages: Conversation history with the user.
        tasks: Ordered list of subtasks assigned to workers.
        current_task_index: Index of the task currently being executed.
        context: Injected context from /context command.
        memories: Formatted persistent memories for system prompt.
        rules: Formatted custom rules for system prompt.
        trace_steps: Accumulator for local JSON trace steps.
        codebase_patterns: Extracted patterns from exemplar files in workspace.
    """
    messages: Annotated[list, add_messages]
    tasks: list[TaskItem]
    current_task_index: int
    context: str
    memories: str
    rules: str
    trace_steps: list
    codebase_patterns: str
    retry_counts: dict
    token_usage: dict

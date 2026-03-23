"""Agent state schema for the LangGraph state graph."""

from typing import Annotated
from typing_extensions import TypedDict
from langgraph.graph.message import add_messages


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
    trace_steps: list

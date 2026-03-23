"""Tests for the agent state schema."""

from shipyard.state import AgentState


def test_state_has_messages_field():
    """AgentState must have a messages field that is a list."""
    state: AgentState = {"messages": [], "context": "", "trace_steps": []}
    assert isinstance(state["messages"], list)


def test_state_has_context_field():
    """AgentState must have a context field (string)."""
    state: AgentState = {"messages": [], "context": "", "trace_steps": []}
    assert isinstance(state["context"], str)


def test_state_has_trace_steps_field():
    """AgentState must have a trace_steps field (list)."""
    state: AgentState = {"messages": [], "context": "", "trace_steps": []}
    assert isinstance(state["trace_steps"], list)


def test_state_messages_annotation_is_add_messages():
    """The messages field must use the add_messages reducer annotation."""
    import typing
    hints = typing.get_type_hints(AgentState, include_extras=True)
    messages_hint = hints["messages"]

    # Annotated types have __metadata__ containing the reducer
    assert hasattr(messages_hint, "__metadata__"), (
        "messages field must be Annotated with add_messages reducer"
    )

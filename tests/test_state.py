"""Tests for the agent state schema."""

from shipyard.state import AgentState, SupervisorState, TaskItem


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


# ---------------------------------------------------------------------------
# TaskItem tests
# ---------------------------------------------------------------------------

def test_task_item_has_required_fields():
    """TaskItem must have worker, description, status, and result fields."""
    task: TaskItem = {
        "worker": "backend",
        "description": "Create API routes",
        "status": "pending",
        "result": "",
    }
    assert task["worker"] == "backend"
    assert task["description"] == "Create API routes"
    assert task["status"] == "pending"
    assert task["result"] == ""


def test_task_item_status_values():
    """TaskItem status should accept pending, done, and failed."""
    for status in ("pending", "done", "failed"):
        task: TaskItem = {
            "worker": "frontend",
            "description": "Build component",
            "status": status,
            "result": "",
        }
        assert task["status"] == status


# ---------------------------------------------------------------------------
# SupervisorState tests
# ---------------------------------------------------------------------------

def test_supervisor_state_has_required_fields():
    """SupervisorState must have messages, tasks, current_task_index, context, trace_steps."""
    state: SupervisorState = {
        "messages": [],
        "tasks": [],
        "current_task_index": 0,
        "context": "",
        "trace_steps": [],
    }
    assert isinstance(state["messages"], list)
    assert isinstance(state["tasks"], list)
    assert state["current_task_index"] == 0
    assert isinstance(state["context"], str)
    assert isinstance(state["trace_steps"], list)


def test_supervisor_state_messages_uses_add_messages():
    """SupervisorState.messages must use the add_messages reducer."""
    import typing
    hints = typing.get_type_hints(SupervisorState, include_extras=True)
    messages_hint = hints["messages"]
    assert hasattr(messages_hint, "__metadata__"), (
        "SupervisorState.messages must be Annotated with add_messages reducer"
    )


def test_supervisor_state_holds_task_items():
    """SupervisorState.tasks should hold a list of TaskItem dicts."""
    task: TaskItem = {
        "worker": "database",
        "description": "Create migration",
        "status": "done",
        "result": "Created documents table",
    }
    state: SupervisorState = {
        "messages": [],
        "tasks": [task],
        "current_task_index": 0,
        "context": "",
        "trace_steps": [],
    }
    assert len(state["tasks"]) == 1
    assert state["tasks"][0]["worker"] == "database"

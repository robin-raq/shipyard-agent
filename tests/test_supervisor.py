"""Tests for the supervisor multi-agent graph (all mocked, no API calls)."""

from unittest.mock import MagicMock, patch

from langchain_core.messages import AIMessage, HumanMessage

from shipyard.supervisor import (
    build_supervisor_graph,
    check_if_done,
    decompose,
    execute_next_task,
    parse_task_plan,
    validate,
)


def _mock_llm(*responses):
    """Create a mock LLM that returns the given responses in sequence."""
    mock = MagicMock()
    mock.invoke.side_effect = list(responses)
    return mock


# ---------------------------------------------------------------------------
# parse_task_plan (pure function)
# ---------------------------------------------------------------------------

class TestParseTaskPlan:
    def test_parses_valid_json(self):
        """Extracts tasks from a JSON code block in LLM output."""
        llm_output = (
            'Here is the plan:\n\n```json\n'
            '[{"worker": "backend", "description": "Create route"}]\n'
            '```'
        )
        tasks = parse_task_plan(llm_output)
        assert len(tasks) == 1
        assert tasks[0]["worker"] == "backend"
        assert tasks[0]["description"] == "Create route"
        assert tasks[0]["status"] == "pending"
        assert tasks[0]["result"] == ""

    def test_parses_multiple_tasks(self):
        """Parses a multi-task plan with correct ordering preserved."""
        llm_output = (
            '```json\n'
            '[\n'
            '  {"worker": "shared", "description": "Define types"},\n'
            '  {"worker": "database", "description": "Create table"},\n'
            '  {"worker": "backend", "description": "Create routes"}\n'
            ']\n'
            '```'
        )
        tasks = parse_task_plan(llm_output)
        assert len(tasks) == 3
        assert [t["worker"] for t in tasks] == ["shared", "database", "backend"]

    def test_handles_malformed_json(self):
        """Falls back to a single backend task when JSON is invalid."""
        llm_output = "I think we should create routes and stuff"
        tasks = parse_task_plan(llm_output)
        assert len(tasks) == 1
        assert tasks[0]["worker"] == "backend"

    def test_handles_bare_json_without_code_block(self):
        """Parses JSON even without markdown code fences."""
        llm_output = '[{"worker": "frontend", "description": "Build UI"}]'
        tasks = parse_task_plan(llm_output)
        assert len(tasks) == 1
        assert tasks[0]["worker"] == "frontend"


# ---------------------------------------------------------------------------
# check_if_done (routing function)
# ---------------------------------------------------------------------------

class TestCheckIfDone:
    def test_routes_to_execute_when_tasks_remain(self):
        """When current_task_index < len(tasks), route to execute_next_task."""
        state = {
            "tasks": [
                {"worker": "backend", "description": "t1", "status": "done", "result": "ok"},
                {"worker": "frontend", "description": "t2", "status": "pending", "result": ""},
            ],
            "current_task_index": 1,
        }
        assert check_if_done(state) == "execute_next_task"

    def test_routes_to_validate_when_all_done(self):
        """When current_task_index >= len(tasks), route to validate."""
        state = {
            "tasks": [
                {"worker": "backend", "description": "t1", "status": "done", "result": "ok"},
            ],
            "current_task_index": 1,
        }
        assert check_if_done(state) == "validate"

    def test_routes_to_validate_on_empty_tasks(self):
        """When tasks is empty, route to validate."""
        state = {"tasks": [], "current_task_index": 0}
        assert check_if_done(state) == "validate"


# ---------------------------------------------------------------------------
# decompose node
# ---------------------------------------------------------------------------

class TestDecompose:
    def test_populates_tasks_from_llm(self):
        """decompose should parse LLM output and populate tasks."""
        llm_output = (
            '```json\n'
            '[{"worker": "backend", "description": "Create route"}]\n'
            '```'
        )
        mock = _mock_llm(AIMessage(content=llm_output))
        state = {
            "messages": [HumanMessage(content="Build the issues feature")],
            "tasks": [],
            "current_task_index": 0,
            "context": "",
            "trace_steps": [],
        }
        result = decompose(state, mock)
        assert len(result["tasks"]) == 1
        assert result["tasks"][0]["worker"] == "backend"
        assert result["current_task_index"] == 0


# ---------------------------------------------------------------------------
# execute_next_task node
# ---------------------------------------------------------------------------

class TestExecuteNextTask:
    def test_executes_worker_and_stores_result(self):
        """execute_next_task should invoke the worker and save its result."""
        mock_worker_graph = MagicMock()
        mock_worker_graph.invoke.return_value = {
            "messages": [
                HumanMessage(content="Create route"),
                AIMessage(content="Created GET /api/issues route."),
            ],
        }

        state = {
            "messages": [HumanMessage(content="Build issues")],
            "tasks": [
                {"worker": "backend", "description": "Create route", "status": "pending", "result": ""},
            ],
            "current_task_index": 0,
            "context": "",
            "trace_steps": [],
        }

        worker_graphs = {"backend": mock_worker_graph}
        result = execute_next_task(state, worker_graphs)

        assert result["current_task_index"] == 1
        assert result["tasks"][0]["status"] == "done"
        assert "Created GET /api/issues route" in result["tasks"][0]["result"]

    def test_marks_failed_on_error(self):
        """If worker raises, the task should be marked as failed."""
        mock_worker_graph = MagicMock()
        mock_worker_graph.invoke.side_effect = Exception("LLM error")

        state = {
            "messages": [HumanMessage(content="Build issues")],
            "tasks": [
                {"worker": "backend", "description": "Create route", "status": "pending", "result": ""},
            ],
            "current_task_index": 0,
            "context": "",
            "trace_steps": [],
        }

        worker_graphs = {"backend": mock_worker_graph}
        result = execute_next_task(state, worker_graphs)

        assert result["tasks"][0]["status"] == "failed"
        assert "error" in result["tasks"][0]["result"].lower()
        assert result["current_task_index"] == 1


# ---------------------------------------------------------------------------
# validate node
# ---------------------------------------------------------------------------

class TestValidate:
    def test_summarizes_completed_tasks(self):
        """validate should produce a summary of all task results."""
        state = {
            "messages": [HumanMessage(content="Build issues")],
            "tasks": [
                {"worker": "backend", "description": "Create route", "status": "done", "result": "Created routes."},
                {"worker": "frontend", "description": "Build UI", "status": "done", "result": "Built components."},
            ],
            "current_task_index": 2,
            "context": "",
            "trace_steps": [],
        }
        result = validate(state)
        last_msg = result["messages"][-1]
        assert "Created routes" in last_msg.content
        assert "Built components" in last_msg.content


# ---------------------------------------------------------------------------
# Full graph compilation
# ---------------------------------------------------------------------------

class TestBuildSupervisorGraph:
    def test_compiles(self):
        """build_supervisor_graph should return a compiled graph."""
        mock = _mock_llm()
        graph = build_supervisor_graph(llm=mock)
        assert graph is not None

    def test_full_flow(self):
        """Full supervisor flow: decompose → execute → check → validate → END."""
        # Supervisor LLM returns a single-task plan
        plan_output = (
            '```json\n'
            '[{"worker": "backend", "description": "Create health route"}]\n'
            '```'
        )
        supervisor_llm = _mock_llm(AIMessage(content=plan_output))

        # Worker LLM returns a tool-free response (simplest case)
        worker_llm = _mock_llm(AIMessage(content="Created GET /health route."))

        graph = build_supervisor_graph(
            llm=supervisor_llm,
            worker_llm=worker_llm,
        )
        result = graph.invoke({
            "messages": [HumanMessage(content="Add a health endpoint")],
            "tasks": [],
            "current_task_index": 0,
            "context": "",
            "trace_steps": [],
        })

        # Should have the original message + validate summary
        assert len(result["messages"]) >= 2
        last_msg = result["messages"][-1]
        assert "health" in last_msg.content.lower() or "Created" in last_msg.content

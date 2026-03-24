"""Tests for the worker factory (all mocked, no API calls)."""

from unittest.mock import MagicMock

from langchain_core.messages import AIMessage, HumanMessage

from shipyard.worker import build_worker_graph


def _mock_llm(*responses):
    """Create a mock LLM that returns the given responses in sequence."""
    mock = MagicMock()
    mock.invoke.side_effect = list(responses)
    return mock


class TestBuildWorkerGraph:
    def test_compiles(self):
        """build_worker_graph returns a compiled graph."""
        mock = _mock_llm()
        graph = build_worker_graph(
            role="backend",
            system_prompt="You are the backend worker.",
            llm=mock,
        )
        assert graph is not None

    def test_ends_on_plain_response(self):
        """When the LLM returns plain text, the worker graph ends."""
        mock = _mock_llm(AIMessage(content="Done. Created the route."))
        graph = build_worker_graph(
            role="backend",
            system_prompt="You are the backend worker.",
            llm=mock,
        )
        result = graph.invoke({
            "messages": [HumanMessage(content="Create GET /health route")],
            "context": "",
            "trace_steps": [],
        })
        last_msg = result["messages"][-1]
        assert last_msg.content == "Done. Created the route."

    def test_routes_to_tools_on_tool_call(self):
        """When the LLM returns a tool call, the worker routes to tools."""
        tool_call_msg = AIMessage(
            content="",
            tool_calls=[{
                "id": "call_w1",
                "name": "read_file",
                "args": {"path": "/tmp/test.txt"},
            }],
        )
        final_msg = AIMessage(content="Read the file.")
        mock = _mock_llm(tool_call_msg, final_msg)

        graph = build_worker_graph(
            role="frontend",
            system_prompt="You are the frontend worker.",
            llm=mock,
        )
        result = graph.invoke({
            "messages": [HumanMessage(content="Read the component file")],
            "context": "",
            "trace_steps": [],
        })
        assert mock.invoke.call_count == 2
        types = [type(m).__name__ for m in result["messages"]]
        assert "ToolMessage" in types

    def test_uses_role_specific_prompt(self):
        """The worker's system prompt should contain the provided prompt text."""
        captured_messages = []

        def capture_invoke(messages):
            captured_messages.extend(messages)
            return AIMessage(content="Done.")

        mock = MagicMock()
        mock.invoke.side_effect = capture_invoke

        graph = build_worker_graph(
            role="database",
            system_prompt="You are the DATABASE worker. Only modify migrations.",
            llm=mock,
        )
        graph.invoke({
            "messages": [HumanMessage(content="Create table")],
            "context": "",
            "trace_steps": [],
        })

        # First message in the invoke call should be the system prompt
        system_msg = captured_messages[0]
        assert "DATABASE worker" in system_msg.content
        assert "migrations" in system_msg.content

    def test_no_global_state_conflict(self):
        """Two workers built in sequence should not interfere with each other."""
        mock_a = _mock_llm(AIMessage(content="Backend done."))
        mock_b = _mock_llm(AIMessage(content="Frontend done."))

        graph_a = build_worker_graph(role="backend", system_prompt="Backend", llm=mock_a)
        graph_b = build_worker_graph(role="frontend", system_prompt="Frontend", llm=mock_b)

        result_a = graph_a.invoke({
            "messages": [HumanMessage(content="task a")],
            "context": "",
            "trace_steps": [],
        })
        result_b = graph_b.invoke({
            "messages": [HumanMessage(content="task b")],
            "context": "",
            "trace_steps": [],
        })

        assert result_a["messages"][-1].content == "Backend done."
        assert result_b["messages"][-1].content == "Frontend done."

"""Tests for the LangGraph agent graph (all mocked, no API calls)."""

from unittest.mock import MagicMock

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from shipyard.agent import build_graph
from shipyard.prompts import build_system_prompt


def _mock_llm(*responses):
    """Create a mock LLM that returns the given responses in sequence."""
    mock = MagicMock()
    mock.invoke.side_effect = list(responses)
    return mock


class TestBuildGraph:
    def test_graph_compiles(self):
        """build_graph() should return a compiled graph without errors."""
        mock = _mock_llm()
        graph = build_graph(llm=mock)
        assert graph is not None

    def test_handles_simple_message(self):
        """When the LLM returns plain text (no tool calls), the graph completes."""
        mock = _mock_llm(AIMessage(content="Hello! How can I help?"))

        graph = build_graph(llm=mock)
        result = graph.invoke({
            "messages": [HumanMessage(content="hi")],
            "context": "",
            "trace_steps": [],
        })

        assert len(result["messages"]) >= 2
        last_msg = result["messages"][-1]
        assert last_msg.content == "Hello! How can I help?"

    def test_routes_to_tools_on_tool_call(self):
        """When the LLM returns a tool call, the graph routes to tool execution."""
        tool_call_msg = AIMessage(
            content="",
            tool_calls=[{
                "id": "call_123",
                "name": "read_file",
                "args": {"path": "/tmp/test.txt"},
            }],
        )
        final_msg = AIMessage(content="File read successfully.")
        mock = _mock_llm(tool_call_msg, final_msg)

        graph = build_graph(llm=mock)
        result = graph.invoke({
            "messages": [HumanMessage(content="read /tmp/test.txt")],
            "context": "",
            "trace_steps": [],
        })

        assert mock.invoke.call_count == 2
        last_msg = result["messages"][-1]
        assert last_msg.content == "File read successfully."

    def test_graph_loops_tool_then_response(self):
        """The graph loops: agent → tools → agent → end."""
        tool_call = AIMessage(
            content="",
            tool_calls=[{
                "id": "call_456",
                "name": "list_files",
                "args": {"directory": "/tmp"},
            }],
        )
        final = AIMessage(content="Here are the files.")
        mock = _mock_llm(tool_call, final)

        graph = build_graph(llm=mock)
        result = graph.invoke({
            "messages": [HumanMessage(content="list files in /tmp")],
            "context": "",
            "trace_steps": [],
        })

        msgs = result["messages"]
        types = [type(m).__name__ for m in msgs]
        assert "ToolMessage" in types
        assert types[-1] == "AIMessage"


class TestSystemPrompt:
    def test_prompt_without_context(self):
        prompt = build_system_prompt("")
        assert "shipyard" in prompt.lower() or "agent" in prompt.lower()
        assert "<injected_context>" not in prompt

    def test_prompt_with_context(self):
        prompt = build_system_prompt("Some injected context here")
        assert "<injected_context>" in prompt
        assert "Some injected context here" in prompt

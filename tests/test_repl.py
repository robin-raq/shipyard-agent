"""Tests for the REPL loop (all mocked, no API calls or real input)."""

from unittest.mock import MagicMock, patch, call
from pathlib import Path

from langchain_core.messages import AIMessage, HumanMessage


class TestREPL:
    @patch("shipyard.__main__.build_graph")
    @patch("builtins.input")
    def test_quit_command_exits(self, mock_input, mock_build):
        """Typing /quit should exit the REPL cleanly."""
        mock_input.side_effect = ["/quit"]

        from shipyard.__main__ import main
        main()  # Should not hang

    @patch("shipyard.__main__.build_graph")
    @patch("builtins.input")
    def test_instruction_invokes_graph(self, mock_input, mock_build):
        """A normal instruction should invoke the graph."""
        mock_graph = MagicMock()
        mock_graph.invoke.return_value = {
            "messages": [
                HumanMessage(content="hello"),
                AIMessage(content="Hi there!"),
            ],
        }
        mock_build.return_value = mock_graph
        mock_input.side_effect = ["hello", "/quit"]

        from shipyard.__main__ import main
        main()

        mock_graph.invoke.assert_called_once()
        call_args = mock_graph.invoke.call_args[0][0]
        assert any(
            isinstance(m, HumanMessage) and m.content == "hello"
            for m in call_args["messages"]
        )

    @patch("shipyard.__main__.build_graph")
    @patch("builtins.input")
    def test_maintains_message_history(self, mock_input, mock_build):
        """The second instruction should include messages from the first."""
        mock_graph = MagicMock()
        # First invocation returns two messages
        first_result = {
            "messages": [
                HumanMessage(content="first"),
                AIMessage(content="response 1"),
            ],
        }
        # Second invocation returns three messages (history + new)
        second_result = {
            "messages": [
                HumanMessage(content="first"),
                AIMessage(content="response 1"),
                HumanMessage(content="second"),
                AIMessage(content="response 2"),
            ],
        }
        mock_graph.invoke.side_effect = [first_result, second_result]
        mock_build.return_value = mock_graph
        mock_input.side_effect = ["first", "second", "/quit"]

        from shipyard.__main__ import main
        main()

        # Second invoke should include messages from first result
        assert mock_graph.invoke.call_count == 2
        second_call_args = mock_graph.invoke.call_args_list[1][0][0]
        # Should have 3 messages: first human, first AI, second human
        assert len(second_call_args["messages"]) == 3

    @patch("shipyard.__main__.build_graph")
    @patch("builtins.input")
    def test_empty_input_reprompts(self, mock_input, mock_build):
        """Empty input should not invoke the graph."""
        mock_graph = MagicMock()
        mock_build.return_value = mock_graph
        mock_input.side_effect = ["", "  ", "/quit"]

        from shipyard.__main__ import main
        main()

        mock_graph.invoke.assert_not_called()

    @patch("shipyard.__main__.build_graph")
    @patch("builtins.input")
    def test_context_file_command(self, mock_input, mock_build, tmp_path: Path):
        """'/context <path>' should set context from a file."""
        ctx_file = tmp_path / "spec.md"
        ctx_file.write_text("# Spec\nBuild a widget.")

        mock_graph = MagicMock()
        mock_graph.invoke.return_value = {
            "messages": [
                HumanMessage(content="build it"),
                AIMessage(content="Done!"),
            ],
        }
        mock_build.return_value = mock_graph
        mock_input.side_effect = [f"/context {ctx_file}", "build it", "/quit"]

        from shipyard.__main__ import main
        main()

        call_args = mock_graph.invoke.call_args[0][0]
        assert "# Spec" in call_args["context"]
        assert "Build a widget" in call_args["context"]

    @patch("shipyard.__main__.build_graph")
    @patch("builtins.input")
    def test_context_paste_command(self, mock_input, mock_build):
        """'/context paste' should read lines until empty line."""
        mock_graph = MagicMock()
        mock_graph.invoke.return_value = {
            "messages": [
                HumanMessage(content="use that"),
                AIMessage(content="Got it!"),
            ],
        }
        mock_build.return_value = mock_graph
        # Simulate: /context paste → two lines of text → empty line → instruction
        mock_input.side_effect = [
            "/context paste",
            "line one",
            "line two",
            "",  # empty line terminates paste
            "use that",
            "/quit",
        ]

        from shipyard.__main__ import main
        main()

        call_args = mock_graph.invoke.call_args[0][0]
        assert "line one" in call_args["context"]
        assert "line two" in call_args["context"]


class TestMultiAgentMode:
    @patch("shipyard.__main__.build_supervisor_graph")
    @patch("shipyard.__main__.build_graph")
    @patch("builtins.input")
    def test_multi_command_switches_to_supervisor(self, mock_input, mock_build, mock_build_sup):
        """'/multi' should switch to the supervisor graph."""
        mock_single_graph = MagicMock()
        mock_sup_graph = MagicMock()
        mock_sup_graph.invoke.return_value = {
            "messages": [
                HumanMessage(content="build it"),
                AIMessage(content="Decomposed into 2 tasks."),
            ],
        }
        mock_build.return_value = mock_single_graph
        mock_build_sup.return_value = mock_sup_graph
        mock_input.side_effect = ["/multi", "build it", "/quit"]

        from shipyard.__main__ import main
        main()

        # Supervisor graph should have been invoked, not the single graph
        mock_sup_graph.invoke.assert_called_once()
        mock_single_graph.invoke.assert_not_called()

    @patch("shipyard.__main__.build_supervisor_graph")
    @patch("shipyard.__main__.build_graph")
    @patch("builtins.input")
    def test_single_command_switches_back(self, mock_input, mock_build, mock_build_sup):
        """'/single' after '/multi' should switch back to single agent."""
        mock_single_graph = MagicMock()
        mock_sup_graph = MagicMock()
        mock_single_graph.invoke.return_value = {
            "messages": [
                HumanMessage(content="hello"),
                AIMessage(content="Hi there!"),
            ],
        }
        mock_build.return_value = mock_single_graph
        mock_build_sup.return_value = mock_sup_graph
        mock_input.side_effect = ["/multi", "/single", "hello", "/quit"]

        from shipyard.__main__ import main
        main()

        # Single graph should have been invoked, not supervisor
        mock_single_graph.invoke.assert_called_once()
        mock_sup_graph.invoke.assert_not_called()

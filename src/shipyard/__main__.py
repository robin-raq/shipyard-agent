"""Entry point for the Shipyard agent REPL.

Run with: python -m shipyard
"""

from pathlib import Path

from dotenv import load_dotenv
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from shipyard.agent import build_graph
from shipyard.tracing import TraceCollector


def handle_context_file(filepath: str) -> str:
    """Read a file and return its content as context."""
    p = Path(filepath)
    if not p.exists():
        print(f"Context error: file not found: {filepath}")
        return ""
    content = p.read_text()
    print(f"Context loaded from {filepath} ({len(content)} bytes)")
    return content


def handle_context_paste() -> str:
    """Read pasted lines until an empty line is entered."""
    print("Paste context (empty line to finish):")
    lines = []
    while True:
        line = input()
        if line == "":
            break
        lines.append(line)
    content = "\n".join(lines)
    print(f"Context loaded ({len(content)} bytes)")
    return content


def main():
    """Run the Shipyard agent REPL."""
    load_dotenv(
        dotenv_path=Path(__file__).resolve().parents[2] / ".env",
        override=True,
    )

    graph = build_graph()
    trace_collector = TraceCollector()
    messages = []
    context = ""

    print("Shipyard agent v0.1.0")
    print("Commands: /quit, /context <filepath>, /context paste")
    print()

    while True:
        try:
            user_input = input("shipyard> ")
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye.")
            break

        stripped = user_input.strip()

        if stripped == "/quit":
            print("Goodbye.")
            break

        if stripped == "":
            continue

        # Context injection commands
        if stripped.startswith("/context "):
            arg = stripped[len("/context "):].strip()
            if arg == "paste":
                context = handle_context_paste()
            else:
                context = handle_context_file(arg)
            continue

        # Normal instruction — invoke the graph
        trace_collector.start_trace(stripped)
        messages.append(HumanMessage(content=stripped))
        result = graph.invoke({
            "messages": messages,
            "context": context,
            "trace_steps": [],
        })

        messages = list(result["messages"])
        last_msg = messages[-1]
        print(f"\n{last_msg.content}\n")

        # Extract tool steps from the graph result for local tracing
        tool_calls_by_id = {}
        for msg in messages:
            if isinstance(msg, AIMessage) and msg.tool_calls:
                for tc in msg.tool_calls:
                    tool_calls_by_id[tc["id"]] = tc
            elif isinstance(msg, ToolMessage):
                tc = tool_calls_by_id.get(msg.tool_call_id)
                if tc:
                    output = msg.content if len(msg.content) <= 500 else msg.content[:500] + "..."
                    trace_collector.add_step(
                        action=tc["name"],
                        input_data=tc["args"],
                        output=output,
                        duration_ms=0,
                    )

        # Save local trace
        trace_path = trace_collector.save_trace()
        if trace_path:
            print(f"[trace saved: {trace_path}]")

        # Clear context after use
        context = ""


if __name__ == "__main__":
    main()

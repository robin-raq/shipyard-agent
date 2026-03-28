"""Worker subgraph factory for specialized agents.

Each worker is a compiled StateGraph with the same structure as the
single-agent graph (agent → tools → agent loop), but parameterized
by role and system prompt. Uses closures instead of module-level
globals so multiple workers can coexist without interference.
"""

from langchain_core.messages import SystemMessage
from langgraph.graph import END, START, StateGraph
from langgraph.prebuilt import ToolNode

from shipyard.models import get_llm_for_role
from shipyard.state import AgentState
from shipyard.tools import ALL_TOOLS


def build_worker_graph(role: str, system_prompt: str, llm=None):
    """Build a compiled worker subgraph for a specific role.

    Args:
        role: Worker role name (e.g., "backend", "frontend").
        system_prompt: Role-specific system prompt.
        llm: Optional LLM with tools bound. If None, creates via get_llm_for_role.

    Returns:
        A compiled LangGraph StateGraph ready for .invoke().
    """
    if llm is not None:
        bound_llm = llm
    else:
        model = get_llm_for_role(role)
        bound_llm = model.bind_tools(ALL_TOOLS)

    def worker_agent_node(state: AgentState) -> dict:
        """Call the LLM with the worker's system prompt."""
        context = state.get("context", "")
        prompt = system_prompt
        if context.strip():
            prompt += (
                "\n\n## Injected Context\n\n"
                "<injected_context>\n"
                f"{context}\n"
                "</injected_context>"
            )
        messages = [SystemMessage(content=prompt)] + list(state["messages"])
        response = bound_llm.invoke(messages)
        return {"messages": [response]}

    def should_continue(state: AgentState) -> str:
        """Route to tools if the last message has tool calls, otherwise end."""
        last_message = state["messages"][-1]
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            return "tools"
        return END

    tool_node = ToolNode(ALL_TOOLS)

    graph = StateGraph(AgentState)
    graph.add_node("agent", worker_agent_node)
    graph.add_node("tools", tool_node)

    graph.add_edge(START, "agent")
    graph.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
    graph.add_edge("tools", "agent")

    return graph.compile()

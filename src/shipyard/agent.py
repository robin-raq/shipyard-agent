"""LangGraph state graph for the Shipyard agent.

Defines a manual StateGraph with two nodes (agent, tools) and
conditional routing. The agent node calls Claude, the tools node
executes tool calls, and should_continue routes between them.
"""

from langchain_core.messages import SystemMessage
from langgraph.graph import END, START, StateGraph
from langgraph.prebuilt import ToolNode

from shipyard.models import get_llm_for_role
from shipyard.prompts import build_system_prompt
from shipyard.state import AgentState
from shipyard.tools import ALL_TOOLS


def build_graph(llm=None):
    """Build and compile the Shipyard agent graph.

    Args:
        llm: Optional language model (with tools bound). If None,
             creates an LLM via get_llm_for_role. Pass a mock for testing.

    Graph structure:
        START → agent → should_continue → tools | END
                                          tools → agent (loop back)

    Returns:
        A compiled LangGraph StateGraph ready for .invoke().
    """
    if llm is not None:
        bound_llm = llm
    else:
        model = get_llm_for_role("backend")
        bound_llm = model.bind_tools(ALL_TOOLS)

    def agent_node(state: AgentState) -> dict:
        """Call the LLM with the current conversation and system prompt."""
        system_prompt = build_system_prompt(
            context=state.get("context", ""),
            memories=state.get("memories", ""),
            rules=state.get("rules", ""),
        )
        messages = [SystemMessage(content=system_prompt)] + list(state["messages"])
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
    graph.add_node("agent", agent_node)
    graph.add_node("tools", tool_node)

    graph.add_edge(START, "agent")
    graph.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
    graph.add_edge("tools", "agent")

    return graph.compile()

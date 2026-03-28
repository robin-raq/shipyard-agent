"""Model selection for cost-optimized multi-agent execution.

Routes each role to either OpenAI (cheap, fast) or Anthropic (capable,
better at surgical editing). The mapping is a cost-saving strategy:
structured/predictable tasks go to GPT-4o-mini, complex editing stays
on Claude Sonnet.

If OPENAI_API_KEY is not set, all roles fall back to Anthropic.
"""

import os

from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI

# Maps role → provider. "openai" = cheap model, "anthropic" = capable model.
ROLE_MODEL_MAP: dict[str, str] = {
    "supervisor": "openai",
    "shared": "openai",
    "database": "openai",
    "backend": "openai",
    "frontend": "openai",
}


def get_llm_for_role(role: str, force_provider: str | None = None):
    """Return an LLM instance for the given role.

    Args:
        role: Worker role name (e.g., "backend", "supervisor").
        force_provider: Override role-based selection ("anthropic" or "openai").

    Returns:
        A LangChain chat model instance (no tools bound yet).
    """
    provider = force_provider or ROLE_MODEL_MAP.get(role, "anthropic")

    # Fall back to Anthropic if OpenAI key is not available
    if provider == "openai" and not os.environ.get("OPENAI_API_KEY"):
        provider = "anthropic"

    if provider == "openai":
        return ChatOpenAI(model="gpt-4o", temperature=0)

    return ChatAnthropic(model="claude-sonnet-4-5-20250929", temperature=0)

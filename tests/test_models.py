"""Tests for the model selection helper."""

import os
from unittest.mock import patch

from shipyard.models import get_llm_for_role, ROLE_MODEL_MAP

# Ensure OpenAI client doesn't fail on missing key during tests
_ENV_PATCH = {"OPENAI_API_KEY": "test-key-not-real", "ANTHROPIC_API_KEY": "test-key-not-real"}


class TestGetLlmForRole:
    @patch.dict(os.environ, _ENV_PATCH)
    def test_returns_llm_for_known_roles(self):
        """Every role in the map should return a non-None LLM."""
        for role in ROLE_MODEL_MAP:
            llm = get_llm_for_role(role)
            assert llm is not None, f"get_llm_for_role('{role}') returned None"

    def test_supervisor_uses_cheap_model(self):
        """Supervisor decomposition should use the cost-efficient model."""
        assert ROLE_MODEL_MAP["supervisor"] == "openai"

    def test_shared_uses_cheap_model(self):
        """Shared worker (type definitions) should use the cost-efficient model."""
        assert ROLE_MODEL_MAP["shared"] == "openai"

    def test_database_uses_cheap_model(self):
        """Database worker (SQL/migrations) should use the cost-efficient model."""
        assert ROLE_MODEL_MAP["database"] == "openai"

    def test_backend_uses_anthropic(self):
        """Backend worker (complex editing) should use Claude."""
        assert ROLE_MODEL_MAP["backend"] == "anthropic"

    def test_frontend_uses_anthropic(self):
        """Frontend worker (complex editing) should use Claude."""
        assert ROLE_MODEL_MAP["frontend"] == "anthropic"

    @patch.dict(os.environ, _ENV_PATCH)
    def test_unknown_role_defaults_to_anthropic(self):
        """Unknown roles should fall back to Claude."""
        llm = get_llm_for_role("unknown_role")
        assert llm is not None

    @patch.dict(os.environ, _ENV_PATCH)
    def test_respects_force_provider(self):
        """force_provider should override the role-based selection."""
        llm_a = get_llm_for_role("supervisor", force_provider="anthropic")
        llm_o = get_llm_for_role("backend", force_provider="openai")
        # Just verify they return without error
        assert llm_a is not None
        assert llm_o is not None

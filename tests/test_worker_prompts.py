"""Tests for worker and supervisor prompts."""

from shipyard.worker_prompts import (
    BACKEND_PROMPT,
    DATABASE_PROMPT,
    FRONTEND_PROMPT,
    SHARED_PROMPT,
    SUPERVISOR_PROMPT,
    WORKER_PROMPTS,
)


# The 6 editing rules every worker must inherit
BASE_RULES = [
    "read before editing",
    "exact anchors",
    "verify after editing",
    "report clearly",
    "ask when uncertain",
    "surgical",
]


class TestWorkerPrompts:
    def test_all_four_workers_in_registry(self):
        """WORKER_PROMPTS dict must have backend, frontend, database, shared."""
        assert set(WORKER_PROMPTS.keys()) == {"backend", "frontend", "database", "shared"}

    def test_each_prompt_contains_base_rules(self):
        """Every worker prompt must include the core editing rules."""
        for role, prompt in WORKER_PROMPTS.items():
            prompt_lower = prompt.lower()
            for rule in BASE_RULES:
                assert rule in prompt_lower, (
                    f"{role} prompt missing base rule: '{rule}'"
                )

    def test_backend_prompt_scopes_to_api(self):
        """Backend prompt must reference the api/ directory."""
        assert "api/" in BACKEND_PROMPT

    def test_frontend_prompt_scopes_to_web(self):
        """Frontend prompt must reference the web/ directory."""
        assert "web/" in FRONTEND_PROMPT

    def test_database_prompt_scopes_to_migrations(self):
        """Database prompt must reference migrations."""
        assert "migration" in DATABASE_PROMPT.lower()

    def test_shared_prompt_scopes_to_shared(self):
        """Shared prompt must reference the shared/ directory."""
        assert "shared/" in SHARED_PROMPT

    def test_supervisor_prompt_requests_json(self):
        """Supervisor prompt must instruct JSON output for task decomposition."""
        prompt_lower = SUPERVISOR_PROMPT.lower()
        assert "json" in prompt_lower

    def test_supervisor_prompt_lists_workers(self):
        """Supervisor prompt must mention all four worker roles."""
        prompt_lower = SUPERVISOR_PROMPT.lower()
        for role in ("backend", "frontend", "database", "shared"):
            assert role in prompt_lower, (
                f"Supervisor prompt missing worker role: '{role}'"
            )

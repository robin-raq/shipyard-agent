"""Tests for the evaluation harness and mock evaluation run."""

from pathlib import Path
from unittest.mock import MagicMock

import pytest
from langchain_core.messages import AIMessage, HumanMessage

from shipyard.evals.mock_responses import (
    multi_agent_supervisor_responses,
    multi_agent_worker_responses,
)
from shipyard.evals.report import category_summary, generate_report, summary_table
from shipyard.evals.runner import check_expectation, run_task
from shipyard.evals.task_definitions import EVAL_TASKS
from shipyard.evals.tasks import (
    EvalResult,
    EvalTask,
    Expectation,
    ExpectationResult,
    FileSetup,
    get_task,
    get_tasks_by_category,
)


def _mock_llm(*responses):
    mock = MagicMock()
    mock.invoke.side_effect = list(responses)
    return mock


# --- Test data models ---


class TestEvalTask:
    def test_all_tasks_have_names(self):
        for t in EVAL_TASKS:
            assert t.name, "Task missing name"

    def test_all_tasks_have_categories(self):
        valid = {"create", "edit", "multi-step", "error-recovery", "read",
                 "context", "complex", "multi-agent"}
        for t in EVAL_TASKS:
            assert t.category in valid, f"{t.name} has invalid category: {t.category}"

    def test_all_tasks_have_expectations(self):
        for t in EVAL_TASKS:
            assert len(t.expectations) > 0, f"{t.name} has no expectations"

    def test_all_single_tasks_have_mock_responses(self):
        for t in EVAL_TASKS:
            if t.agent_mode == "single":
                assert len(t.mock_responses) > 0, f"{t.name} missing mock responses"

    def test_task_count(self):
        assert len(EVAL_TASKS) == 12

    def test_get_task_by_name(self):
        task = get_task("create_new_file", EVAL_TASKS)
        assert task is not None
        assert task.category == "create"

    def test_get_task_not_found(self):
        assert get_task("nonexistent", EVAL_TASKS) is None

    def test_get_tasks_by_category(self):
        create_tasks = get_tasks_by_category("create", EVAL_TASKS)
        assert len(create_tasks) == 2


# --- Test expectation checker ---


class TestExpectationChecker:
    def test_file_exists_passes(self, tmp_path):
        (tmp_path / "test.py").write_text("content")
        exp = Expectation(type="file_exists", path="test.py")
        result = check_expectation(exp, tmp_path, [])
        assert result.passed

    def test_file_exists_fails(self, tmp_path):
        exp = Expectation(type="file_exists", path="missing.py")
        result = check_expectation(exp, tmp_path, [])
        assert not result.passed

    def test_file_contains_passes(self, tmp_path):
        (tmp_path / "test.py").write_text("def add(a, b): return a + b")
        exp = Expectation(type="file_contains", path="test.py", value="def add")
        result = check_expectation(exp, tmp_path, [])
        assert result.passed

    def test_file_contains_fails(self, tmp_path):
        (tmp_path / "test.py").write_text("def add(a, b): return a + b")
        exp = Expectation(type="file_contains", path="test.py", value="def subtract")
        result = check_expectation(exp, tmp_path, [])
        assert not result.passed

    def test_file_not_contains_passes(self, tmp_path):
        (tmp_path / "test.py").write_text("def add(a, b): return a + b")
        exp = Expectation(type="file_not_contains", path="test.py", value="Hello")
        result = check_expectation(exp, tmp_path, [])
        assert result.passed

    def test_response_contains_passes(self):
        messages = [
            HumanMessage(content="hi"),
            AIMessage(content="The file defines a greet function."),
        ]
        exp = Expectation(type="response_contains", value="greet")
        result = check_expectation(exp, Path("/tmp"), messages)
        assert result.passed

    def test_response_contains_case_insensitive(self):
        messages = [AIMessage(content="Found GREET function")]
        exp = Expectation(type="response_contains", value="greet")
        result = check_expectation(exp, Path("/tmp"), messages)
        assert result.passed


# --- Test report ---


class TestReport:
    def _make_results(self):
        return [
            EvalResult("task_a", "create", True, 1.0, [], ["create_file"], 1, 10, None),
            EvalResult("task_b", "edit", False, 0.5, [
                ExpectationResult(Expectation("file_contains", "x.py", "def foo"), False, "NOT found"),
            ], ["read_file", "edit_file"], 2, 45, None),
        ]

    def test_summary_table_contains_tasks(self):
        table = summary_table(self._make_results())
        assert "task_a" in table
        assert "task_b" in table
        assert "PASS" in table
        assert "FAIL" in table

    def test_category_summary_shows_rates(self):
        report = category_summary(self._make_results())
        assert "create" in report
        assert "edit" in report

    def test_generate_report_has_overall(self):
        report = generate_report(self._make_results())
        assert "1/2 passed" in report
        assert "50%" in report


# --- Parametrized mock evaluation run ---


SINGLE_AGENT_TASKS = [t for t in EVAL_TASKS if t.agent_mode == "single"]


class TestMockEvaluations:
    """Run each single-agent task in mock mode. Deterministic, no API calls."""

    @pytest.mark.parametrize("task", SINGLE_AGENT_TASKS, ids=lambda t: t.name)
    def test_mock_task(self, task, tmp_path):
        mock = _mock_llm(*task.mock_responses)
        result = run_task(task, workspace=tmp_path, llm=mock)
        failed = [
            er.detail for er in result.expectation_results if not er.passed
        ]
        assert result.passed, f"{task.name} failed: {failed}"


class TestMultiAgentMockEvaluation:
    """Run the multi-agent task in mock mode."""

    def test_multi_agent_decomposition(self, tmp_path):
        task = get_task("multi_agent_decomposition", EVAL_TASKS)
        assert task is not None

        sup_mock = _mock_llm(*multi_agent_supervisor_responses())
        wrk_mock = _mock_llm(*multi_agent_worker_responses())

        result = run_task(
            task,
            workspace=tmp_path,
            supervisor_llm=sup_mock,
            worker_llm=wrk_mock,
        )
        failed = [
            er.detail for er in result.expectation_results if not er.passed
        ]
        assert result.passed, f"multi_agent failed: {failed}"

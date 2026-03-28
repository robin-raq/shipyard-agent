"""CLI for running Shipyard evaluations.

Usage:
    python -m shipyard.evals           # Mock mode (no API keys needed)
    python -m shipyard.evals --live    # Live mode (real API calls against Ship codebase)
    python -m shipyard.evals --all     # Both mock and live
"""

import sys
import tempfile
from pathlib import Path
from unittest.mock import MagicMock

from shipyard.evals.mock_responses import (
    multi_agent_supervisor_responses,
    multi_agent_worker_responses,
)
from shipyard.evals.report import generate_report
from shipyard.evals.runner import copy_workspace, run_task
from shipyard.evals.task_definitions import EVAL_TASKS
from shipyard.evals.live_task_definitions import LIVE_EVAL_TASKS
from shipyard.tools import set_workspace


def _mock_llm(*responses):
    mock = MagicMock()
    mock.invoke.side_effect = list(responses)
    return mock


def run_mock_evals():
    """Run the 12 mock eval tasks (deterministic, no API calls)."""
    print("=" * 50)
    print("MOCK EVALUATIONS (12 tasks)")
    print("=" * 50)
    results = []

    for task in EVAL_TASKS:
        with tempfile.TemporaryDirectory() as tmp:
            workspace = Path(tmp)

            if task.agent_mode == "multi":
                sup_mock = _mock_llm(*multi_agent_supervisor_responses())
                wrk_mock = _mock_llm(*multi_agent_worker_responses())
                result = run_task(
                    task,
                    workspace=workspace,
                    supervisor_llm=sup_mock,
                    worker_llm=wrk_mock,
                )
            else:
                mock = _mock_llm(*task.mock_responses)
                result = run_task(task, workspace=workspace, llm=mock)

            results.append(result)
            status = "PASS" if result.passed else "FAIL"
            print(f"  {status}  {task.name}")

    return results


def run_live_evals():
    """Run the 7 live eval tasks against the real Ship codebase."""
    print("=" * 50)
    print("LIVE EVALUATIONS (7 tasks — real LLM calls)")
    print("=" * 50)

    ship_dir = Path.cwd() / "ship"
    if not ship_dir.exists():
        print(f"ERROR: Ship directory not found at {ship_dir}")
        print("Live evals must be run from the shipyard project root.")
        return []

    results = []
    for task in LIVE_EVAL_TASKS:
        with tempfile.TemporaryDirectory() as tmp:
            workspace = Path(tmp)
            # Copy ship/ into the temp workspace
            copy_workspace(ship_dir, workspace / "ship")

            print(f"  Running {task.name}...", end="", flush=True)
            result = run_task(task, workspace=workspace)
            results.append(result)

            status = "PASS" if result.passed else "FAIL"
            print(f"\r  {status}  {task.name} ({result.duration_ms}ms)")

            # Clean up any files the agent created (they're in tmp anyway)
            if not result.passed:
                for er in result.expectation_results:
                    if not er.passed:
                        print(f"       ↳ {er.detail}")

    return results


def main():
    live_mode = "--live" in sys.argv
    all_mode = "--all" in sys.argv

    results = []

    if all_mode or not live_mode:
        results.extend(run_mock_evals())

    if live_mode or all_mode:
        if results:
            print()
        results.extend(run_live_evals())

    print("\n")
    print(generate_report(results))


if __name__ == "__main__":
    main()

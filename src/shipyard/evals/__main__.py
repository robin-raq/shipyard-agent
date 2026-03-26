"""CLI for running Shipyard evaluations.

Usage:
    python -m shipyard.evals           # Mock mode (no API keys needed)
    python -m shipyard.evals --live    # Live mode (real API calls)
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
from shipyard.evals.runner import run_task
from shipyard.evals.task_definitions import EVAL_TASKS
from shipyard.tools import set_workspace


def _mock_llm(*responses):
    mock = MagicMock()
    mock.invoke.side_effect = list(responses)
    return mock


def main():
    live_mode = "--live" in sys.argv
    results = []

    for task in EVAL_TASKS:
        with tempfile.TemporaryDirectory() as tmp:
            workspace = Path(tmp)

            if live_mode:
                result = run_task(task, workspace=workspace)
            elif task.agent_mode == "multi":
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

    print("\n")
    print(generate_report(results))


if __name__ == "__main__":
    main()

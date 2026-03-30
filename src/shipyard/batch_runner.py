"""Shared batch runner — eliminates boilerplate across all run_*.py scripts.

Usage in a batch runner script:

    from shipyard.batch_runner import run_batch

    TASKS = [
        {"id": 1, "name": "Feature X", "prompt": "..."},
        {"id": 2, "name": "Feature Y", "prompt": "..."},
    ]

    if __name__ == "__main__":
        run_batch(TASKS, prefix="batch_name")
"""

import argparse
import json
import signal
import time
from pathlib import Path

from langchain_core.messages import HumanMessage

TASK_TIMEOUT = 600

TDD_PREAMBLE = """\
IMPORTANT — Follow strict TDD and MATCH EXISTING PATTERNS exactly.

## Step 1: Understand the codebase BEFORE writing any code
- Use scan_workspace to see the directory tree.
- Use search_files to find existing files and conventions.
- Read at least ONE existing file in the same directory to copy its exact structure.

## Step 2: Implement matching existing patterns
- Backend routes: use factory function pattern (export function createXRouter(pool))
- Register route in ship/api/src/app.ts with import + app.use line
- Frontend pages: add route in ship/web/src/App.tsx + nav in ship/web/src/components/Layout.tsx
- Use `const id = req.params.id as string;` for route params (NOT destructuring)
- Use `const val = req.query.field as string | undefined;` for query params

## Step 3: Verify
- Backend: run_command("npx tsc --noEmit") from ship/api/
- Frontend: run_command("npx tsc --noEmit") from ship/web/

"""


def _run_single_task(task, graph, trace_collector, prefix):
    """Run a single task through the supervisor graph with timeout."""
    print(f"\n{'='*70}")
    print(f"TASK {task['id']}: {task['name']}")
    print(f"{'='*70}\n")

    trace_collector.start_trace(f"{prefix}_task_{task['id']}_{task['name']}")
    start = time.time()

    class TaskTimeout(Exception):
        pass

    def timeout_handler(signum, frame):
        raise TaskTimeout(f"Task timed out after {TASK_TIMEOUT}s")

    old_handler = signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(TASK_TIMEOUT)

    try:
        result = graph.invoke({
            "messages": [HumanMessage(content=task["prompt"])],
            "context": "",
            "memories": "",
            "rules": "",
            "trace_steps": [],
            "tasks": [],
            "current_task_index": 0,
            "codebase_patterns": "",
            "shared_contract": "",
            "project_state": "",
            "retry_counts": {},
            "token_usage": {},
        })
        last_msg = result["messages"][-1].content
    except TaskTimeout:
        last_msg = f"TIMEOUT: Task exceeded {TASK_TIMEOUT}s limit."
        print(f"\n⚠️  {last_msg}")
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, old_handler)

    elapsed = time.time() - start
    trace_path = trace_collector.save_trace()

    result_file = Path(f"traces/{prefix}_task_{task['id']}_result.md")
    result_file.parent.mkdir(exist_ok=True)
    result_file.write_text(
        f"# Task {task['id']}: {task['name']}\n\n"
        f"**Duration:** {elapsed:.1f}s\n"
        f"**Trace:** {trace_path}\n\n"
        f"## Agent Output\n\n{last_msg}\n"
    )

    print(f"\n{last_msg}")
    print(f"\n[Completed in {elapsed:.1f}s | trace: {trace_path}]")

    return {"id": task["id"], "name": task["name"], "duration": elapsed, "trace": str(trace_path), "output": last_msg}


def run_batch(tasks, prefix="batch"):
    """Parse args and run tasks through the Shipyard supervisor graph.

    Args:
        tasks: List of task dicts with keys: id, name, prompt
        prefix: Prefix for trace files and summary (e.g., "batch_2", "tests")
    """
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent.parent / ".env", override=True)

    from shipyard.supervisor import build_supervisor_graph
    from shipyard.tools import set_workspace
    from shipyard.tracing import TraceCollector

    parser = argparse.ArgumentParser()
    parser.add_argument("--task", type=int, help=f"Run specific task (1-{len(tasks)})")
    parser.add_argument("--dry-run", action="store_true", help="Print prompts without invoking")
    parser.add_argument("--start-from", type=int, default=1, help="Start from task N")
    args = parser.parse_args()

    if args.dry_run:
        selected = [tasks[args.task - 1]] if args.task else tasks
        for t in selected:
            print(f"\n{'='*70}\nTASK {t['id']}: {t['name']}\n{'='*70}")
            print(t["prompt"])
        return

    set_workspace(Path(__file__).resolve().parent.parent.parent)
    graph = build_supervisor_graph()
    trace_collector = TraceCollector()
    results = []

    if args.task:
        results.append(_run_single_task(tasks[args.task - 1], graph, trace_collector, prefix))
    else:
        for task in tasks:
            if task["id"] < args.start_from:
                continue
            results.append(_run_single_task(task, graph, trace_collector, prefix))

    summary_path = Path(f"traces/{prefix}_run_summary.json")
    summary_path.write_text(json.dumps(results, indent=2))
    print(f"\n\nTotal tasks: {len(results)}")
    print(f"Total time: {sum(r['duration'] for r in results):.1f}s")

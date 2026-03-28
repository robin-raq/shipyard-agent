"""Batch runner — technical debt tasks through the Shipyard agent.

Usage:
    python run_tech_debt.py                # run all tasks sequentially
    python run_tech_debt.py --task 1       # run a specific task
    python run_tech_debt.py --dry-run      # print prompts without invoking
"""

import argparse
import json
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage

load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env", override=True)

from shipyard.supervisor import build_supervisor_graph
from shipyard.tools import set_workspace
from shipyard.tracing import TraceCollector

TDD_PREAMBLE = """\
IMPORTANT — Follow strict TDD and MATCH EXISTING PATTERNS exactly.

## Step 1: Understand the codebase BEFORE writing any code
- Use scan_workspace to see the directory tree.
- Use search_files to find existing files, imports, and conventions.
- CRITICAL: Read at least ONE existing file in the same directory to copy its exact structure.

## Step 2: Write a FAILING test FIRST (Red phase)
- Match the EXACT pattern of existing tests. Do NOT invent your own patterns.
- For API tests (ship/api/): use vitest + supertest + testPool pattern.
- For frontend tests (ship/web/): use vitest.

## Step 3: Implement the MINIMUM code to make the test pass (Green phase)
- Only write the code needed to pass the tests.
- Follow existing patterns in the codebase.
- Do NOT create documentation files (.md) or README files.

## Step 4: Verify
- After implementation, run the test suite or build to confirm.

"""

TASKS = [
    {
        "id": 1,
        "name": "Wire RichTextEditor into DocumentDetailPage",
        "prompt": TDD_PREAMBLE + """\
Task: Update ship/web/src/pages/DocumentDetailPage.tsx to use the RichTextEditor component
for displaying content instead of a plain <pre> tag.

Steps:
1. Read ship/web/src/pages/DocumentDetailPage.tsx to understand the current implementation.
2. Read ship/web/src/components/RichTextEditor.tsx to understand its props (content, onChange, editable).

3. In DocumentDetailPage.tsx, find the content display section that currently uses:
   <pre className="whitespace-pre-wrap font-sans text-gray-800">{displayContent}</pre>

4. Replace it with:
   <RichTextEditor content={displayContent} onChange={() => {}} editable={false} />

   This renders the content as formatted rich text (with headings, lists, bold, etc.)
   instead of plain text. The editable={false} prop makes it read-only.

5. The RichTextEditor is already imported at the top of the file.

6. Verify: run_command("npx tsc --noEmit") from ship/web/ to check it compiles.
   Then run_command("npx vite build") from ship/web/ to check production build.
""",
    },
    {
        "id": 2,
        "name": "Code-split the frontend bundle",
        "prompt": TDD_PREAMBLE + """\
Task: Add code-splitting to ship/web/vite.config.ts to reduce the JS bundle size below 500KB.

Steps:
1. Read ship/web/vite.config.ts to understand the current Vite configuration.
2. Read ship/web/package.json to see dependencies.

3. Modify ship/web/vite.config.ts to add manual chunks that split vendor libraries:
   - Add build.rollupOptions.output.manualChunks to the Vite config
   - Split these into separate chunks:
     - "vendor-react": react, react-dom, react-router-dom
     - "vendor-tiptap": @tiptap/react, @tiptap/starter-kit, @tiptap/pm
     - "vendor-dndkit": @dnd-kit/core, @dnd-kit/sortable

   Example configuration to add inside defineConfig:
   ```
   build: {
     rollupOptions: {
       output: {
         manualChunks: {
           'vendor-react': ['react', 'react-dom', 'react-router-dom'],
           'vendor-tiptap': ['@tiptap/react', '@tiptap/starter-kit', '@tiptap/pm'],
           'vendor-dndkit': ['@dnd-kit/core', '@dnd-kit/sortable'],
         },
       },
     },
   },
   ```

4. Verify: run_command("npx vite build") from ship/web/ — the main chunk should be under 500KB.
   Check the build output to confirm chunks are split.
""",
    },
    {
        "id": 3,
        "name": "Update README with current features",
        "prompt": """\
Task: Update the README.md at the project root with the current state of the Ship app rebuild.

Steps:
1. Read README.md to see the current content.
2. Read ship/web/src/App.tsx to see all routes/pages.
3. Read ship/api/src/app.ts to see all registered API routes.
4. Read ship/web/src/components/Layout.tsx to see sidebar nav items.

5. Update the "What's Included" section in README.md under "## Ship App (Agent-Built Rebuild)":
   - Update API routes count to 19: docs, issues, projects, weeks, teams, ships, programs, comments, dashboard, search, auth, documents, standups, weekly-plans, weekly-retros, reviews, feedback, accountability, health
   - Update frontend pages count to 16: Dashboard, Docs, Issues (with Kanban board), Projects, Weeks, Teams, Ships, Programs, Standups, Weekly Plans, Weekly Retros, Reviews, Public Feedback, Login, Document Detail, Program Detail, Admin Dashboard
   - Update Features to include: Kanban board with drag-and-drop, daily standups, weekly plans with RichTextEditor, weekly retros (went_well/to_improve/action_items), manager review workflow (approve/request changes), command palette (Cmd+K), public feedback portal, session timeout handling, WebSocket server for real-time collaboration
   - Add new API endpoints to the table: POST /api/standups, GET /api/weekly-plans, GET /api/weekly-retros, GET /api/reviews/pending, POST /api/feedback

6. Do NOT change the agent architecture sections (Stack, Tools, Security, etc.) — only update the Ship App section.
""",
    },
]


def run_task(task: dict, graph, trace_collector: TraceCollector) -> dict:
    """Run a single task through the supervisor graph."""
    print(f"\n{'='*70}")
    print(f"TASK {task['id']}: {task['name']}")
    print(f"{'='*70}\n")

    trace_collector.start_trace(f"tech_debt_task_{task['id']}_{task['name']}")
    start = time.time()

    result = graph.invoke({
        "messages": [HumanMessage(content=task["prompt"])],
        "context": "",
        "memories": "",
        "rules": "",
        "trace_steps": [],
        "tasks": [],
        "current_task_index": 0,
        "codebase_patterns": "",
    })

    elapsed = time.time() - start
    last_msg = result["messages"][-1].content

    trace_path = trace_collector.save_trace()

    result_file = Path(f"traces/tech_debt_task_{task['id']}_result.md")
    result_file.parent.mkdir(exist_ok=True)
    result_file.write_text(
        f"# Task {task['id']}: {task['name']}\n\n"
        f"**Duration:** {elapsed:.1f}s\n"
        f"**Trace:** {trace_path}\n\n"
        f"## Agent Output\n\n{last_msg}\n"
    )

    print(f"\n{last_msg}")
    print(f"\n[Completed in {elapsed:.1f}s | trace: {trace_path}]")

    return {
        "id": task["id"],
        "name": task["name"],
        "duration": elapsed,
        "trace": str(trace_path),
        "output": last_msg,
    }


def main():
    parser = argparse.ArgumentParser(description="Run tech debt tasks through the Shipyard agent")
    parser.add_argument("--task", type=int, help="Run a specific task by ID (1-3)")
    parser.add_argument("--dry-run", action="store_true", help="Print prompts without invoking")
    parser.add_argument("--start-from", type=int, default=1, help="Start from task N")
    args = parser.parse_args()

    if args.dry_run:
        tasks = [TASKS[args.task - 1]] if args.task else TASKS
        for t in tasks:
            print(f"\n{'='*70}")
            print(f"TASK {t['id']}: {t['name']}")
            print(f"{'='*70}")
            print(t["prompt"])
        return

    set_workspace(Path.cwd())
    graph = build_supervisor_graph()
    trace_collector = TraceCollector()
    results = []

    if args.task:
        task = TASKS[args.task - 1]
        result = run_task(task, graph, trace_collector)
        results.append(result)
    else:
        for task in TASKS:
            if task["id"] < args.start_from:
                continue
            result = run_task(task, graph, trace_collector)
            results.append(result)

    summary_path = Path("traces/tech_debt_run_summary.json")
    summary_path.write_text(json.dumps(results, indent=2))
    print(f"\n\nRun summary saved to {summary_path}")
    print(f"Total tasks: {len(results)}")
    print(f"Total time: {sum(r['duration'] for r in results):.1f}s")


if __name__ == "__main__":
    main()

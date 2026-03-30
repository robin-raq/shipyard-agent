# Batch Runner Scripts

Scripts that feed task prompts to the Shipyard agent's supervisor graph. Each script defines tasks and uses `src/shipyard/batch_runner.py` for execution.

## Usage

```bash
python scripts/<script>.py              # run all tasks
python scripts/<script>.py --task 1     # run specific task
python scripts/<script>.py --dry-run    # print prompts only
python scripts/<script>.py --start-from 3  # resume from task 3
```

## Scripts

| Script | Tasks | What it builds |
|--------|-------|---------------|
| `run_tasks.py` | 10 | Initial TDD features (auth RBAC, contexts, components, tests) |
| `run_kanban_standups.py` | 7 | Kanban board + standups system |
| `run_tech_debt.py` | 3 | Tech debt fixes |
| `run_new_features.py` | 6 | Activity, attachments, sprint reviews, settings, notifications, org chart |
| `run_batch_2.py` | 5 | MyWeek, status overview, profile, invitations, associations |
| `run_batch_3.py` | 13 | FleetGraph integration + infrastructure (admin, rate limiting, audit, backlinks, API tokens, setup, iterations) |
| `run_tests_batch.py` | 5 | Test generation for routes missing coverage |

## Adding a new batch

```python
from shipyard.batch_runner import TDD_PREAMBLE, run_batch

TASKS = [
    {"id": 1, "name": "Feature X", "prompt": TDD_PREAMBLE + "Task: ..."},
]

if __name__ == "__main__":
    run_batch(TASKS, prefix="my_batch")
```

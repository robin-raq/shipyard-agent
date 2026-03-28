"""Project state scanner — deterministic inventory of what exists in the workspace.

Scans the Ship app directories and produces a structured dict of existing
routes, migrations, pages, components, and registered API paths. Injected
into worker context so agents know what already exists before creating new files.
"""

import re
from pathlib import Path


def scan_project_state(workspace_root: Path) -> dict:
    """Scan workspace and return structured inventory of what exists."""
    state = {
        "routes": [],
        "migrations": [],
        "pages": [],
        "components": [],
        "registered_api_paths": [],
    }

    # Routes
    route_dir = workspace_root / "ship" / "api" / "src" / "routes"
    if route_dir.exists():
        state["routes"] = sorted(f.stem for f in route_dir.glob("*.ts") if f.is_file())

    # Migrations
    mig_dir = workspace_root / "ship" / "api" / "src" / "db" / "migrations"
    if mig_dir.exists():
        state["migrations"] = sorted(f.name for f in mig_dir.glob("*.sql") if f.is_file())

    # Pages
    pages_dir = workspace_root / "ship" / "web" / "src" / "pages"
    if pages_dir.exists():
        state["pages"] = sorted(f.stem for f in pages_dir.glob("*.tsx") if f.is_file())

    # Components
    comp_dir = workspace_root / "ship" / "web" / "src" / "components"
    if comp_dir.exists():
        state["components"] = sorted(f.stem for f in comp_dir.glob("*.tsx") if f.is_file())

    # Registered API paths from app.ts
    app_file = workspace_root / "ship" / "api" / "src" / "app.ts"
    if app_file.exists():
        content = app_file.read_text(errors="replace")
        state["registered_api_paths"] = sorted(
            re.findall(r'app\.use\("(/api/[^"]+)"', content)
        )

    return state


def format_project_state(state: dict) -> str:
    """Format project state as markdown for injection into prompts.

    Returns empty string if nothing exists yet.
    """
    parts = []

    if state.get("routes"):
        parts.append(f"**Routes:** {', '.join(state['routes'])}")
    if state.get("migrations"):
        parts.append(f"**Migrations:** {', '.join(state['migrations'])}")
    if state.get("pages"):
        parts.append(f"**Pages:** {', '.join(state['pages'])}")
    if state.get("components"):
        parts.append(f"**Components:** {', '.join(state['components'])}")
    if state.get("registered_api_paths"):
        parts.append(f"**Registered API paths:** {', '.join(state['registered_api_paths'])}")

    if not parts:
        return ""

    return "## Project State (what already exists)\n\n" + "\n".join(parts)

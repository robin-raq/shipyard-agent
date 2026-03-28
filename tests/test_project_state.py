"""Tests for the project state scanner."""

from pathlib import Path

from shipyard.project_state import format_project_state, scan_project_state


class TestScanProjectState:
    def test_scans_routes(self, tmp_path):
        """Finds route files in ship/api/src/routes/."""
        route_dir = tmp_path / "ship" / "api" / "src" / "routes"
        route_dir.mkdir(parents=True)
        (route_dir / "teams.ts").write_text("export function createTeamsRouter() {}")
        (route_dir / "issues.ts").write_text("export function createIssuesRouter() {}")

        state = scan_project_state(tmp_path)
        assert "teams" in state["routes"]
        assert "issues" in state["routes"]

    def test_scans_migrations(self, tmp_path):
        """Finds migration files in ship/api/src/db/migrations/."""
        mig_dir = tmp_path / "ship" / "api" / "src" / "db" / "migrations"
        mig_dir.mkdir(parents=True)
        (mig_dir / "001_create_users.sql").write_text("CREATE TABLE users ();")
        (mig_dir / "002_create_issues.sql").write_text("CREATE TABLE issues ();")

        state = scan_project_state(tmp_path)
        assert "001_create_users.sql" in state["migrations"]
        assert "002_create_issues.sql" in state["migrations"]

    def test_scans_pages(self, tmp_path):
        """Finds page files in ship/web/src/pages/."""
        pages_dir = tmp_path / "ship" / "web" / "src" / "pages"
        pages_dir.mkdir(parents=True)
        (pages_dir / "IssuesPage.tsx").write_text("export default function IssuesPage() {}")
        (pages_dir / "DashboardPage.tsx").write_text("export default function DashboardPage() {}")

        state = scan_project_state(tmp_path)
        assert "IssuesPage" in state["pages"]
        assert "DashboardPage" in state["pages"]

    def test_scans_components(self, tmp_path):
        """Finds component files in ship/web/src/components/."""
        comp_dir = tmp_path / "ship" / "web" / "src" / "components"
        comp_dir.mkdir(parents=True)
        (comp_dir / "DocumentForm.tsx").write_text("export default function DocumentForm() {}")

        state = scan_project_state(tmp_path)
        assert "DocumentForm" in state["components"]

    def test_parses_registered_api_paths(self, tmp_path):
        """Extracts app.use paths from app.ts."""
        api_dir = tmp_path / "ship" / "api" / "src"
        api_dir.mkdir(parents=True)
        (api_dir / "app.ts").write_text(
            'app.use("/api/issues", issuesRouter);\n'
            'app.use("/api/teams", teamsRouter);\n'
        )

        state = scan_project_state(tmp_path)
        assert "/api/issues" in state["registered_api_paths"]
        assert "/api/teams" in state["registered_api_paths"]

    def test_returns_empty_for_missing_dirs(self, tmp_path):
        """Returns empty lists when directories don't exist."""
        state = scan_project_state(tmp_path)
        assert state["routes"] == []
        assert state["migrations"] == []
        assert state["pages"] == []
        assert state["components"] == []
        assert state["registered_api_paths"] == []


class TestFormatProjectState:
    def test_formats_as_markdown(self):
        state = {
            "routes": ["teams", "issues"],
            "migrations": ["001_create_users.sql"],
            "pages": ["IssuesPage", "DashboardPage"],
            "components": ["DocumentForm"],
            "registered_api_paths": ["/api/issues", "/api/teams"],
        }
        result = format_project_state(state)
        assert "## Project State" in result
        assert "teams" in result
        assert "IssuesPage" in result

    def test_returns_empty_for_empty_state(self):
        state = {
            "routes": [],
            "migrations": [],
            "pages": [],
            "components": [],
            "registered_api_paths": [],
        }
        result = format_project_state(state)
        assert result == ""

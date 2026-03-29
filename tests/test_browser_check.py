"""Tests for the browser_check tool."""

from pathlib import Path
from unittest.mock import MagicMock, patch

from shipyard.tools import browser_check, set_workspace


# Set workspace to project root so browser-check.js is found
PROJECT_ROOT = Path(__file__).resolve().parent.parent


class TestBrowserCheck:
    def setup_method(self):
        set_workspace(PROJECT_ROOT)

    @patch("shipyard.tools.subprocess.run")
    def test_returns_status_and_title(self, mock_run):
        """Parses JSON output from the browser-check script."""
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout='{"status": 200, "title": "Ship App"}',
            stderr="",
        )
        result = browser_check.invoke({"url": "http://localhost:3001", "checks": "status,title"})
        assert "200" in result
        assert "Ship App" in result

    @patch("shipyard.tools.subprocess.run")
    def test_handles_script_error(self, mock_run):
        """Returns error message when the script fails."""
        mock_run.return_value = MagicMock(
            returncode=1,
            stdout='{"error": "net::ERR_CONNECTION_REFUSED"}',
            stderr="",
        )
        result = browser_check.invoke({"url": "http://localhost:9999"})
        assert "error" in result.lower() or "ERR_CONNECTION_REFUSED" in result

    @patch("shipyard.tools.subprocess.run")
    def test_handles_timeout(self, mock_run):
        """Returns timeout message when subprocess times out."""
        import subprocess
        mock_run.side_effect = subprocess.TimeoutExpired(cmd="node", timeout=30)
        result = browser_check.invoke({"url": "http://localhost:3001"})
        assert "timeout" in result.lower() or "timed out" in result.lower()

    @patch("shipyard.tools.subprocess.run")
    def test_handles_missing_playwright(self, mock_run):
        """Returns graceful message when Playwright is not installed."""
        mock_run.side_effect = FileNotFoundError("node not found")
        result = browser_check.invoke({"url": "http://localhost:3001"})
        assert "not available" in result.lower() or "not found" in result.lower()

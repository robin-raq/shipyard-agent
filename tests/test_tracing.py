"""Tests for local JSON trace collection."""

import json
from pathlib import Path

from shipyard.tracing import TraceCollector


class TestTraceCollector:
    def test_trace_file_created(self, tmp_path: Path):
        """After save_trace, a JSON file should exist in the trace directory."""
        tc = TraceCollector()
        tc.start_trace("test instruction")
        tc.save_trace(str(tmp_path))

        files = list(tmp_path.glob("trace_*.json"))
        assert len(files) == 1

    def test_trace_contains_instruction(self, tmp_path: Path):
        """The trace JSON should include the user instruction."""
        tc = TraceCollector()
        tc.start_trace("Add a /health endpoint")
        tc.save_trace(str(tmp_path))

        trace_file = next(tmp_path.glob("trace_*.json"))
        data = json.loads(trace_file.read_text())
        assert data["instruction"] == "Add a /health endpoint"

    def test_trace_contains_steps(self, tmp_path: Path):
        """The trace JSON should include tool call steps."""
        tc = TraceCollector()
        tc.start_trace("edit a file")
        tc.add_step(
            action="read_file",
            input_data={"path": "hello.py"},
            output="1: def greet():",
            duration_ms=150,
        )
        tc.add_step(
            action="edit_file",
            input_data={"path": "hello.py", "old_text": "greet", "new_text": "hello"},
            output="Successfully replaced text.",
            duration_ms=200,
        )
        tc.save_trace(str(tmp_path))

        trace_file = next(tmp_path.glob("trace_*.json"))
        data = json.loads(trace_file.read_text())
        assert len(data["steps"]) == 2
        assert data["steps"][0]["action"] == "read_file"
        assert data["steps"][0]["input"]["path"] == "hello.py"
        assert data["steps"][1]["action"] == "edit_file"

    def test_trace_contains_timing(self, tmp_path: Path):
        """The trace should have total_duration_ms field."""
        tc = TraceCollector()
        tc.start_trace("timing test")
        tc.add_step("read_file", {"path": "x"}, "content", 100)
        tc.add_step("edit_file", {"path": "x"}, "done", 250)
        tc.save_trace(str(tmp_path))

        trace_file = next(tmp_path.glob("trace_*.json"))
        data = json.loads(trace_file.read_text())
        assert "total_duration_ms" in data
        assert data["total_duration_ms"] >= 350

    def test_trace_filename_includes_timestamp(self, tmp_path: Path):
        """Trace filename should follow trace_YYYYMMDD_HHMMSS.json format."""
        tc = TraceCollector()
        tc.start_trace("naming test")
        tc.save_trace(str(tmp_path))

        trace_file = next(tmp_path.glob("trace_*.json"))
        name = trace_file.name
        # Format: trace_20260323_143000.json
        assert name.startswith("trace_")
        assert name.endswith(".json")
        # Should have date and time parts
        parts = name.replace("trace_", "").replace(".json", "").split("_")
        assert len(parts) == 2
        assert len(parts[0]) == 8  # YYYYMMDD
        assert len(parts[1]) == 6  # HHMMSS

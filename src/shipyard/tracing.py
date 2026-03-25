"""Local JSON trace collector for the Shipyard agent.

Collects tool call steps during a graph run and saves them
as a JSON file in the traces/ directory. This complements
LangSmith's auto-tracing with a local, version-controllable record.
"""

import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path


# Patterns that match common API key formats
_SECRET_PATTERNS = [
    re.compile(r"sk-ant-api\S+"),           # Anthropic
    re.compile(r"sk-proj-\S+"),             # OpenAI project keys
    re.compile(r"sk-[a-zA-Z0-9]{20,}"),     # Generic OpenAI keys
    re.compile(r"lsv2_pt_\S+"),             # LangSmith
    re.compile(r"Bearer\s+\S+"),            # Authorization headers
]


def redact_sensitive(text: str) -> str:
    """Replace API keys and secrets with [REDACTED]."""
    for pattern in _SECRET_PATTERNS:
        text = pattern.sub("[REDACTED]", text)
    return text


class TraceCollector:
    """Accumulates trace steps during a single agent invocation.

    Usage:
        tc = TraceCollector()
        tc.start_trace("Add a /health endpoint")
        tc.add_step("read_file", {"path": "index.ts"}, "1: ...", 150)
        tc.add_step("edit_file", {"path": "index.ts", ...}, "Success", 200)
        tc.save_trace("traces/")
    """

    def __init__(self):
        self._trace = None
        self._start_time = None

    def start_trace(self, instruction: str) -> None:
        """Initialize a new trace for an instruction."""
        now = datetime.now(timezone.utc)
        self._start_time = time.monotonic()
        self._trace = {
            "trace_id": f"trace_{now.strftime('%Y%m%d_%H%M%S')}",
            "timestamp": now.isoformat(),
            "instruction": instruction,
            "steps": [],
            "total_duration_ms": 0,
            "result": "pending",
        }

    def add_step(
        self,
        action: str,
        input_data: dict,
        output: str,
        duration_ms: int,
    ) -> None:
        """Record a tool call step in the current trace."""
        if self._trace is None:
            return

        step = {
            "step": len(self._trace["steps"]) + 1,
            "action": action,
            "input": input_data,
            "output": redact_sensitive(output),
            "duration_ms": duration_ms,
        }
        self._trace["steps"].append(step)

    def save_trace(self, trace_dir: str = "traces/") -> str:
        """Write the accumulated trace to a JSON file.

        Returns:
            The path to the saved trace file.
        """
        if self._trace is None:
            return ""

        # Calculate total duration
        if self._start_time is not None:
            elapsed = int((time.monotonic() - self._start_time) * 1000)
            step_total = sum(s["duration_ms"] for s in self._trace["steps"])
            self._trace["total_duration_ms"] = max(elapsed, step_total)

        self._trace["result"] = "success"

        path = Path(trace_dir)
        path.mkdir(parents=True, exist_ok=True)

        now = datetime.now(timezone.utc)
        filename = f"trace_{now.strftime('%Y%m%d_%H%M%S')}.json"
        filepath = path / filename

        filepath.write_text(json.dumps(self._trace, indent=2))
        self._trace = None
        self._start_time = None

        return str(filepath)

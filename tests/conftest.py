"""Shared test fixtures for Shipyard tests."""

import pytest
from pathlib import Path


@pytest.fixture
def workspace(tmp_path: Path) -> Path:
    """Create a temporary workspace with a sample file for tool tests."""
    sample = tmp_path / "hello.py"
    sample.write_text('def greet(name):\n    return f"Hello, {name}!"\n')
    return tmp_path


@pytest.fixture
def sample_file(workspace: Path) -> Path:
    """Return the path to the sample file inside the workspace."""
    return workspace / "hello.py"

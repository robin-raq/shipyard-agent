"""Tests for the 5 core tools: read_file, create_file, list_files, edit_file, run_command."""

from pathlib import Path

from shipyard.tools import (
    read_file,
    create_file,
    list_files,
    edit_file,
    run_command,
)


# ---------------------------------------------------------------------------
# read_file
# ---------------------------------------------------------------------------

class TestReadFile:
    def test_returns_content_with_line_numbers(self, sample_file: Path):
        result = read_file.invoke({"path": str(sample_file)})
        assert "1: def greet(name):" in result
        assert '2:     return f"Hello, {name}!"' in result

    def test_nonexistent_returns_error(self, workspace: Path):
        result = read_file.invoke({"path": str(workspace / "nope.py")})
        assert "error" in result.lower()

    def test_empty_file(self, workspace: Path):
        empty = workspace / "empty.txt"
        empty.write_text("")
        result = read_file.invoke({"path": str(empty)})
        # Should not error — just return empty/minimal content
        assert "error" not in result.lower()


# ---------------------------------------------------------------------------
# create_file
# ---------------------------------------------------------------------------

class TestCreateFile:
    def test_writes_content(self, workspace: Path):
        target = workspace / "new.py"
        result = create_file.invoke({"path": str(target), "content": "print('hi')\n"})
        assert target.exists()
        assert target.read_text() == "print('hi')\n"
        assert "created" in result.lower() or "success" in result.lower()

    def test_creates_nested_directories(self, workspace: Path):
        target = workspace / "a" / "b" / "deep.py"
        result = create_file.invoke({"path": str(target), "content": "# deep\n"})
        assert target.exists()
        assert target.read_text() == "# deep\n"

    def test_refuses_overwrite(self, sample_file: Path):
        result = create_file.invoke({"path": str(sample_file), "content": "overwrite!"})
        assert "error" in result.lower() or "exists" in result.lower()
        # Original content should be unchanged
        assert "def greet" in sample_file.read_text()


# ---------------------------------------------------------------------------
# list_files
# ---------------------------------------------------------------------------

class TestListFiles:
    def test_returns_entries(self, workspace: Path):
        result = list_files.invoke({"directory": str(workspace)})
        assert "hello.py" in result

    def test_with_glob_pattern(self, workspace: Path):
        (workspace / "data.txt").write_text("data")
        (workspace / "script.py").write_text("# py")
        result = list_files.invoke({"directory": str(workspace), "pattern": "*.py"})
        assert "hello.py" in result
        assert "script.py" in result
        assert "data.txt" not in result

    def test_nonexistent_directory(self, workspace: Path):
        result = list_files.invoke({"directory": str(workspace / "nope")})
        assert "error" in result.lower()


# ---------------------------------------------------------------------------
# edit_file
# ---------------------------------------------------------------------------

class TestEditFile:
    def test_replaces_unique_anchor(self, sample_file: Path):
        result = edit_file.invoke({
            "path": str(sample_file),
            "old_text": 'return f"Hello, {name}!"',
            "new_text": 'return f"Hi, {name}!"',
        })
        assert "success" in result.lower() or "replaced" in result.lower()
        assert 'return f"Hi, {name}!"' in sample_file.read_text()

    def test_anchor_not_found_returns_error_with_content(self, sample_file: Path):
        result = edit_file.invoke({
            "path": str(sample_file),
            "old_text": "this text does not exist",
            "new_text": "replacement",
        })
        assert "error" in result.lower() or "not found" in result.lower()
        # Error should include the actual file content so LLM can retry
        assert "def greet" in result

    def test_anchor_not_unique_returns_error(self, workspace: Path):
        dupes = workspace / "dupes.py"
        dupes.write_text("x = 1\nx = 1\nx = 1\n")
        result = edit_file.invoke({
            "path": str(dupes),
            "old_text": "x = 1",
            "new_text": "x = 2",
        })
        assert "error" in result.lower() or "unique" in result.lower() or "multiple" in result.lower()

    def test_creates_backup(self, sample_file: Path):
        original = sample_file.read_text()
        edit_file.invoke({
            "path": str(sample_file),
            "old_text": 'return f"Hello, {name}!"',
            "new_text": 'return f"Hi, {name}!"',
        })
        backup = Path(str(sample_file) + ".bak")
        assert backup.exists()
        assert backup.read_text() == original

    def test_verifies_edit_landed(self, sample_file: Path):
        result = edit_file.invoke({
            "path": str(sample_file),
            "old_text": 'return f"Hello, {name}!"',
            "new_text": 'return f"Hi, {name}!"',
        })
        # Result should confirm the new text is in the file
        assert "verified" in result.lower() or "success" in result.lower()

    def test_idempotent_second_edit_fails(self, sample_file: Path):
        # First edit succeeds
        edit_file.invoke({
            "path": str(sample_file),
            "old_text": 'return f"Hello, {name}!"',
            "new_text": 'return f"Hi, {name}!"',
        })
        # Second edit with same old_text fails (it was already replaced)
        result = edit_file.invoke({
            "path": str(sample_file),
            "old_text": 'return f"Hello, {name}!"',
            "new_text": 'return f"Hi, {name}!"',
        })
        assert "error" in result.lower() or "not found" in result.lower()


# ---------------------------------------------------------------------------
# run_command
# ---------------------------------------------------------------------------

class TestRunCommand:
    def test_captures_stdout(self):
        result = run_command.invoke({"command": "echo hello"})
        assert "hello" in result

    def test_captures_stderr(self):
        result = run_command.invoke({"command": "echo error >&2"})
        assert "error" in result

    def test_returns_exit_code(self):
        result = run_command.invoke({"command": "false"})
        assert "exit code" in result.lower() or "1" in result

    def test_rejects_dangerous_commands(self):
        result = run_command.invoke({"command": "rm -rf /"})
        assert "blocked" in result.lower() or "dangerous" in result.lower() or "rejected" in result.lower()

    def test_has_timeout(self):
        # sleep 60 should be killed by the 30s timeout
        result = run_command.invoke({"command": "sleep 60"})
        assert "timeout" in result.lower() or "timed out" in result.lower()

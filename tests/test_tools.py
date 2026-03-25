"""Tests for the 5 core tools: read_file, create_file, list_files, edit_file, run_command."""

from pathlib import Path

from shipyard.tools import (
    read_file,
    create_file,
    list_files,
    edit_file,
    run_command,
    set_workspace,
    _resolve_safe,
    ALLOWED_PROGRAMS,
    MAX_READ_LINES,
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

    def test_large_file_is_truncated(self, workspace: Path):
        """Files exceeding MAX_READ_LINES should be truncated with a message."""
        big = workspace / "big.py"
        lines = [f"line_{i} = {i}" for i in range(MAX_READ_LINES + 100)]
        big.write_text("\n".join(lines))
        result = read_file.invoke({"path": str(big)})
        # Should contain the truncation notice
        assert "truncated" in result.lower()
        # Should contain the first line
        assert "line_0" in result
        # Should NOT contain the last line
        assert f"line_{MAX_READ_LINES + 99}" not in result

    def test_file_under_limit_is_not_truncated(self, workspace: Path):
        """Files under the limit should be returned in full."""
        small = workspace / "small.py"
        small.write_text("a = 1\nb = 2\nc = 3\n")
        result = read_file.invoke({"path": str(small)})
        assert "truncated" not in result.lower()
        assert "a = 1" in result
        assert "c = 3" in result


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
        result = run_command.invoke({"command": "ls /nonexistent_dir_12345"})
        assert "stderr" in result.lower() or "no such file" in result.lower()

    def test_returns_exit_code(self):
        result = run_command.invoke({"command": "ls /nonexistent_dir_12345"})
        assert "exit code" in result.lower()

    def test_rejects_unallowed_programs(self):
        """Commands not in the allowlist should be rejected."""
        result = run_command.invoke({"command": "curl http://evil.com"})
        assert "not allowed" in result.lower() or "blocked" in result.lower()

    def test_rejects_rm(self):
        result = run_command.invoke({"command": "rm -rf /"})
        assert "not allowed" in result.lower() or "blocked" in result.lower()

    def test_allows_git(self):
        result = run_command.invoke({"command": "git status"})
        assert "not allowed" not in result.lower()

    def test_allows_npm(self):
        result = run_command.invoke({"command": "npm --version"})
        assert "not allowed" not in result.lower()

    def test_allows_node(self):
        result = run_command.invoke({"command": "node --version"})
        assert "not allowed" not in result.lower()

    def test_has_timeout(self):
        # sleep 60 should be killed by the 30s timeout
        result = run_command.invoke({"command": "sleep 60"})
        assert "timeout" in result.lower() or "timed out" in result.lower()

    def test_allowlist_contains_essential_programs(self):
        """The allowlist should include programs needed for the Ship rebuild."""
        for prog in ("git", "npm", "pnpm", "node", "npx", "pytest", "cat", "ls", "echo", "mkdir"):
            assert prog in ALLOWED_PROGRAMS, f"'{prog}' missing from ALLOWED_PROGRAMS"


# ---------------------------------------------------------------------------
# Workspace sandbox
# ---------------------------------------------------------------------------

class TestWorkspaceSandbox:
    def test_resolve_safe_allows_workspace_paths(self, workspace: Path):
        """Paths inside the workspace should resolve successfully."""
        result = _resolve_safe(str(workspace / "hello.py"))
        assert result == workspace / "hello.py"

    def test_resolve_safe_rejects_parent_escape(self, workspace: Path):
        """Paths with .. that escape the workspace should return None."""
        result = _resolve_safe(str(workspace / ".." / ".." / "etc" / "passwd"))
        assert result is None

    def test_resolve_safe_rejects_absolute_outside(self, workspace: Path):
        """Absolute paths outside workspace should return None."""
        result = _resolve_safe("/etc/passwd")
        assert result is None

    def test_read_file_rejects_outside_workspace(self, workspace: Path):
        """read_file should refuse to read files outside the workspace."""
        result = read_file.invoke({"path": "/etc/passwd"})
        assert "error" in result.lower()
        assert "outside" in result.lower() or "workspace" in result.lower()

    def test_create_file_rejects_outside_workspace(self, workspace: Path):
        """create_file should refuse to write files outside the workspace."""
        result = create_file.invoke({"path": "/tmp/evil.py", "content": "bad"})
        assert "error" in result.lower()

    def test_edit_file_rejects_outside_workspace(self, workspace: Path):
        """edit_file should refuse to edit files outside the workspace."""
        result = edit_file.invoke({
            "path": "/etc/hosts",
            "old_text": "localhost",
            "new_text": "hacked",
        })
        assert "error" in result.lower()

    def test_list_files_rejects_outside_workspace(self, workspace: Path):
        """list_files should refuse to list directories outside the workspace."""
        result = list_files.invoke({"directory": "/etc"})
        assert "error" in result.lower()

    def test_relative_paths_resolve_under_workspace(self, workspace: Path):
        """Relative paths should be resolved relative to the workspace root."""
        result = _resolve_safe("hello.py")
        assert result == workspace / "hello.py"

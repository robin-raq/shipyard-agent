"""Core tool implementations for the Shipyard agent.

Each tool is a standalone function decorated with @tool. Tools return str
(not exceptions) so the LLM sees errors as data and can self-correct.

All file tools enforce a workspace sandbox — paths that resolve outside
the workspace root are rejected.
"""

import os
import re
import subprocess
from pathlib import Path

from langchain_core.tools import tool


# ---------------------------------------------------------------------------
# Workspace sandbox
# ---------------------------------------------------------------------------

_workspace_root: Path = Path.cwd()

MAX_READ_LINES = 2000
COMMAND_TIMEOUT = 120


def set_workspace(root: Path) -> None:
    """Set the workspace root for all file tools."""
    global _workspace_root
    _workspace_root = root.resolve()


def _resolve_safe(path: str) -> Path | None:
    """Resolve a path and verify it's inside the workspace.

    Relative paths are resolved against the workspace root.
    Returns None if the resolved path escapes the workspace.
    """
    p = Path(path)
    if not p.is_absolute():
        p = _workspace_root / p
    resolved = p.resolve()
    try:
        resolved.relative_to(_workspace_root)
        return resolved
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# read_file
# ---------------------------------------------------------------------------

@tool
def read_file(path: str) -> str:
    """Read a file and return its contents with line numbers.

    Args:
        path: Absolute or relative path to the file.

    Returns:
        File contents with line numbers (e.g., '1: def greet(name):')
        or an error message if the file does not exist.
    """
    p = _resolve_safe(path)
    if p is None:
        return f"Error: Path is outside the workspace: {path}"
    if not p.exists():
        return f"Error: File not found: {path}"
    if not p.is_file():
        return f"Error: Not a file: {path}"

    content = p.read_text()
    if not content:
        return f"(empty file: {path})"

    lines = content.splitlines()
    total = len(lines)
    truncated = total > MAX_READ_LINES
    if truncated:
        lines = lines[:MAX_READ_LINES]

    numbered = [f"{i + 1}: {line}" for i, line in enumerate(lines)]
    result = "\n".join(numbered)

    if truncated:
        result += (
            f"\n\n[Truncated: showing {MAX_READ_LINES} of {total} lines. "
            f"File is too large to read in full.]"
        )
    return result


# ---------------------------------------------------------------------------
# create_file
# ---------------------------------------------------------------------------

@tool
def create_file(path: str, content: str) -> str:
    """Create a new file with the given content.

    Creates parent directories if they don't exist.
    Refuses to overwrite an existing file.

    Args:
        path: Path where the file should be created.
        content: Full content to write.

    Returns:
        Success message or error if the file already exists.
    """
    p = _resolve_safe(path)
    if p is None:
        return f"Error: Path is outside the workspace: {path}"
    if p.exists():
        return f"Error: File already exists: {path}. Use edit_file to modify it."

    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)
    return f"Created {path} ({len(content)} bytes)"


# ---------------------------------------------------------------------------
# list_files
# ---------------------------------------------------------------------------

@tool
def list_files(directory: str, pattern: str = "") -> str:
    """List files in a directory, optionally filtered by glob pattern.

    Args:
        directory: Path to the directory to list.
        pattern: Optional glob pattern (e.g., '*.py'). If empty, lists all.

    Returns:
        Newline-separated list of file/directory names, or error message.
    """
    d = _resolve_safe(directory)
    if d is None:
        return f"Error: Path is outside the workspace: {directory}"
    if not d.exists():
        return f"Error: Directory not found: {directory}"
    if not d.is_dir():
        return f"Error: Not a directory: {directory}"

    if pattern:
        entries = sorted(d.glob(pattern))
    else:
        entries = sorted(d.iterdir())

    if not entries:
        return f"(empty directory: {directory})"

    names = [e.name for e in entries]
    return "\n".join(names)


# ---------------------------------------------------------------------------
# edit_file
# ---------------------------------------------------------------------------

@tool
def edit_file(path: str, old_text: str, new_text: str) -> str:
    """Surgical file edit: find a unique text anchor and replace it.

    The old_text must appear exactly once in the file. If it appears
    zero times or more than once, the edit fails with a helpful error.

    A .bak backup is created before every edit. After editing, the file
    is re-read to verify the change landed.

    Args:
        path: Path to the file to edit.
        old_text: The exact text to find (must be unique in the file).
        new_text: The replacement text.

    Returns:
        Success message with verification, or error with file contents.
    """
    p = _resolve_safe(path)
    if p is None:
        return f"Error: Path is outside the workspace: {path}"
    if not p.exists():
        return f"Error: File not found: {path}"

    content = p.read_text()
    count = content.count(old_text)

    if count == 0:
        numbered = _numbered_content(content)
        return (
            f"Error: old_text not found in {path}.\n"
            f"The text you provided does not exist in the file.\n\n"
            f"Current file contents:\n{numbered}"
        )

    if count > 1:
        locations = _find_match_locations(content, old_text)
        return (
            f"Error: old_text matches {count} locations in {path}. "
            f"Provide a longer, more specific anchor.\n\n"
            f"Match locations:\n{locations}"
        )

    # Exactly one match — proceed with edit
    backup = Path(str(p) + ".bak")
    backup.write_text(content)

    new_content = content.replace(old_text, new_text, 1)
    p.write_text(new_content)

    # Verify the edit landed
    verified = p.read_text()
    if new_text in verified:
        # Build a before/after summary
        old_lines = old_text.splitlines()
        new_lines = new_text.splitlines()
        old_preview = "\n".join(f"  --- {l}" for l in old_lines[:5])
        new_preview = "\n".join(f"  +++ {l}" for l in new_lines[:5])
        if len(old_lines) > 5:
            old_preview += f"\n  --- ... ({len(old_lines) - 5} more lines)"
        if len(new_lines) > 5:
            new_preview += f"\n  +++ ... ({len(new_lines) - 5} more lines)"

        return (
            f"Successfully replaced text in {path}. Edit verified.\n\n"
            f"Before:\n{old_preview}\n\n"
            f"After:\n{new_preview}\n\n"
            f"Backup saved: {backup}"
        )
    else:
        return f"Warning: Edit applied to {path} but verification failed. Check the file."


def _numbered_content(content: str) -> str:
    """Return content with line numbers for error messages."""
    lines = content.splitlines()
    return "\n".join(f"{i + 1}: {line}" for i, line in enumerate(lines))


def _find_match_locations(content: str, text: str) -> str:
    """Find all locations of text in content with surrounding context."""
    lines = content.splitlines()
    results = []
    start = 0

    for i, line in enumerate(lines):
        pos = line.find(text.splitlines()[0] if "\n" in text else text)
        if pos != -1:
            ctx_start = max(0, i - 1)
            ctx_end = min(len(lines), i + 2)
            context_lines = [
                f"  {j + 1}: {lines[j]}" for j in range(ctx_start, ctx_end)
            ]
            results.append(f"Match at line {i + 1}:\n" + "\n".join(context_lines))

    return "\n\n".join(results)


# ---------------------------------------------------------------------------
# run_command
# ---------------------------------------------------------------------------

ALLOWED_PROGRAMS = frozenset({
    # Version control
    "git",
    # Node.js ecosystem
    "node", "npm", "npx", "pnpm", "yarn", "tsc",
    # Python ecosystem
    "pytest", "pip",
    # Build tools
    "make",
    # Safe shell utilities
    "cat", "head", "tail", "less", "wc", "sort", "uniq", "diff", "find", "grep",
    "ls", "echo", "mkdir", "cp", "mv", "touch", "pwd", "which", "env", "printenv",
    "sed", "awk", "tr", "cut", "tee", "xargs",
    # Testing / diagnostics
    "sleep", "true", "false", "test",
})


def _parse_command(command: str) -> list[str]:
    """Split a command string into a list of arguments using shlex."""
    import shlex
    try:
        return shlex.split(command)
    except ValueError:
        return []


@tool
def run_command(command: str) -> str:
    """Execute a command and return stdout, stderr, and exit code.

    Only allowlisted programs can be run (git, npm, node, pytest, etc.).
    Commands time out after 30 seconds. Shell operators (|, ;, &&) are
    not supported — each command runs as a direct process.

    Args:
        command: The command to execute (e.g., 'git status', 'npm test').

    Returns:
        Combined stdout, stderr, and exit code, or error if blocked/timed out.
    """
    args = _parse_command(command)
    if not args:
        return f"Error: Could not parse command: {command}"

    program = Path(args[0]).name
    if program not in ALLOWED_PROGRAMS:
        return f"Blocked: '{program}' is not allowed. Allowed programs: {', '.join(sorted(ALLOWED_PROGRAMS))}"

    try:
        result = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=COMMAND_TIMEOUT,
            cwd=str(_workspace_root),
        )
        parts = []
        if result.stdout:
            parts.append(result.stdout.rstrip())
        if result.stderr:
            parts.append(f"stderr: {result.stderr.rstrip()}")
        parts.append(f"Exit code: {result.returncode}")
        return "\n".join(parts)

    except subprocess.TimeoutExpired:
        return f"Error: Command timed out after {COMMAND_TIMEOUT} seconds: {command}"


# ---------------------------------------------------------------------------
# search_files
# ---------------------------------------------------------------------------

_SKIP_EXTENSIONS = frozenset({
    ".bin", ".exe", ".dll", ".so", ".dylib", ".png", ".jpg", ".jpeg",
    ".gif", ".ico", ".svg", ".woff", ".woff2", ".ttf", ".eot",
    ".zip", ".tar", ".gz", ".bz2", ".pdf", ".mp3", ".mp4",
})

MAX_SEARCH_RESULTS = 100


def _is_binary(path: Path) -> bool:
    """Quick check: skip known binary extensions or files with null bytes."""
    if path.suffix.lower() in _SKIP_EXTENSIONS:
        return True
    try:
        chunk = path.read_bytes()[:512]
        return b"\x00" in chunk
    except (OSError, PermissionError):
        return True


@tool
def search_files(pattern: str, glob: str = "", directory: str = "") -> str:
    """Search for a regex pattern across all text files in the workspace.

    Args:
        pattern: Regular expression to search for.
        glob: Optional glob filter (e.g., '*.py', '*.ts'). If empty, searches all files.
        directory: Optional subdirectory to search in. Defaults to workspace root.

    Returns:
        Matching lines with file paths and line numbers, or a no-matches message.
    """
    if directory:
        search_root = _resolve_safe(directory)
        if search_root is None:
            return f"Error: Path is outside the workspace: {directory}"
        if not search_root.is_dir():
            return f"Error: Not a directory: {directory}"
    else:
        search_root = _workspace_root

    try:
        regex = re.compile(pattern)
    except re.error as e:
        return f"Error: Invalid regex pattern: {e}"

    if glob:
        files = sorted(search_root.rglob(glob))
    else:
        files = sorted(search_root.rglob("*"))

    matches = []
    for f in files:
        if not f.is_file() or _is_binary(f):
            continue
        try:
            lines = f.read_text(errors="replace").splitlines()
        except (OSError, PermissionError):
            continue
        rel = f.relative_to(_workspace_root)
        for i, line in enumerate(lines, 1):
            if regex.search(line):
                matches.append(f"{rel}:{i}: {line}")
                if len(matches) >= MAX_SEARCH_RESULTS:
                    matches.append(
                        f"\n[Truncated: showing first {MAX_SEARCH_RESULTS} matches]"
                    )
                    return "\n".join(matches)

    if not matches:
        return f"No matches found for pattern: {pattern}"
    return "\n".join(matches)


# ---------------------------------------------------------------------------
# scan_workspace
# ---------------------------------------------------------------------------

_EXCLUDED_DIRS = frozenset({
    "node_modules", ".git", "__pycache__", ".venv", "venv",
    ".next", "dist", "build", ".tox", ".mypy_cache", ".pytest_cache",
    ".bak",
})


@tool
def scan_workspace(max_depth: int = 4) -> str:
    """Scan the workspace and return a directory tree.

    Args:
        max_depth: Maximum directory depth to traverse (default 4).

    Returns:
        An indented directory tree showing files and folders.
    """
    lines = []

    def _walk(directory: Path, prefix: str, depth: int):
        if depth > max_depth:
            return
        try:
            entries = sorted(directory.iterdir(), key=lambda e: (not e.is_dir(), e.name))
        except PermissionError:
            return

        dirs = [e for e in entries if e.is_dir() and e.name not in _EXCLUDED_DIRS]
        files = [e for e in entries if e.is_file() and not e.name.endswith(".bak")]

        for f in files:
            lines.append(f"{prefix}{f.name}")
        for d in dirs:
            lines.append(f"{prefix}{d.name}/")
            _walk(d, prefix + "  ", depth + 1)

    lines.append(f"{_workspace_root.name}/")
    _walk(_workspace_root, "  ", 1)
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Tool registry (for agent.py to import)
# ---------------------------------------------------------------------------

ALL_TOOLS = [read_file, create_file, list_files, edit_file, run_command, search_files, scan_workspace]

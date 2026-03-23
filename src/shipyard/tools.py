"""Core tool implementations for the Shipyard agent.

Each tool is a standalone function decorated with @tool. Tools return str
(not exceptions) so the LLM sees errors as data and can self-correct.
"""

import os
import subprocess
from pathlib import Path

from langchain_core.tools import tool


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
    p = Path(path)
    if not p.exists():
        return f"Error: File not found: {path}"
    if not p.is_file():
        return f"Error: Not a file: {path}"

    content = p.read_text()
    if not content:
        return f"(empty file: {path})"

    lines = content.splitlines()
    numbered = [f"{i + 1}: {line}" for i, line in enumerate(lines)]
    return "\n".join(numbered)


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
    p = Path(path)
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
    d = Path(directory)
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
    p = Path(path)
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
        return f"Successfully replaced text in {path}. Edit verified."
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

DANGEROUS_PATTERNS = [
    "rm -rf /",
    "rm -rf /*",
    "sudo ",
    "mkfs",
    "> /dev/",
    "dd if=",
    ":(){ ",
]


@tool
def run_command(command: str) -> str:
    """Execute a shell command and return stdout, stderr, and exit code.

    Dangerous commands (rm -rf /, sudo, etc.) are blocked.
    Commands time out after 30 seconds.

    Args:
        command: The shell command to execute.

    Returns:
        Combined stdout, stderr, and exit code, or error if blocked/timed out.
    """
    for pattern in DANGEROUS_PATTERNS:
        if pattern in command:
            return f"Blocked: Dangerous command rejected. '{command}' matches blocked pattern '{pattern}'."

    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=30,
        )
        parts = []
        if result.stdout:
            parts.append(result.stdout.rstrip())
        if result.stderr:
            parts.append(f"stderr: {result.stderr.rstrip()}")
        parts.append(f"Exit code: {result.returncode}")
        return "\n".join(parts)

    except subprocess.TimeoutExpired:
        return f"Error: Command timed out after 30 seconds: {command}"


# ---------------------------------------------------------------------------
# Tool registry (for agent.py to import)
# ---------------------------------------------------------------------------

ALL_TOOLS = [read_file, create_file, list_files, edit_file, run_command]

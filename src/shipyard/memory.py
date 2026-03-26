"""Persistent file-based memory for the Shipyard agent.

Stores memories as JSON files in .shipyard/memory/ relative to the
workspace root. Memories are loaded on startup and injected into the
system prompt so the agent retains project context across sessions.
"""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from shipyard.tools import _workspace_root


def _memory_dir() -> Path:
    """Return the memory directory, creating it if needed."""
    d = _workspace_root / ".shipyard" / "memory"
    d.mkdir(parents=True, exist_ok=True)
    return d


def save_memory(content: str, tags: list[str] | None = None) -> str:
    """Save a memory to disk.

    Args:
        content: The memory text to store.
        tags: Optional list of tags for categorization.

    Returns:
        The memory ID (used for deletion).
    """
    now = datetime.now(timezone.utc)
    mem_id = f"mem_{now.strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
    data = {
        "id": mem_id,
        "content": content,
        "tags": tags or [],
        "created_at": now.isoformat(),
    }
    mem_dir = _memory_dir()
    (mem_dir / f"{mem_id}.json").write_text(json.dumps(data, indent=2))
    return mem_id


def load_all_memories() -> list[dict]:
    """Load all memories from the memory directory.

    Returns:
        List of memory dicts sorted by creation time.
    """
    mem_dir = _memory_dir()
    memories = []
    for f in sorted(mem_dir.glob("*.json")):
        try:
            memories.append(json.loads(f.read_text()))
        except (json.JSONDecodeError, OSError):
            continue
    return memories


def delete_memory(memory_id: str) -> bool:
    """Delete a memory by ID.

    Returns:
        True if deleted, False if not found.
    """
    mem_file = _memory_dir() / f"{memory_id}.json"
    if mem_file.exists():
        mem_file.unlink()
        return True
    return False


def format_memories_for_prompt(memories: list[dict]) -> str:
    """Format memories as a markdown block for the system prompt.

    Returns:
        Empty string if no memories, otherwise a formatted section.
    """
    if not memories:
        return ""
    lines = []
    for m in memories:
        tags_str = f" [{', '.join(m.get('tags', []))}]" if m.get("tags") else ""
        lines.append(f"- {m['content']}{tags_str}")
    return "\n".join(lines)

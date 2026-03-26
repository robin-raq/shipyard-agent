"""Tests for persistent memory system (TDD — write tests first)."""

import json

import pytest

from shipyard.memory import (
    delete_memory,
    format_memories_for_prompt,
    load_all_memories,
    save_memory,
)


@pytest.fixture
def memory_dir(tmp_path, monkeypatch):
    """Use a temp directory for memory storage."""
    mem_dir = tmp_path / ".shipyard" / "memory"

    def patched_memory_dir():
        mem_dir.mkdir(parents=True, exist_ok=True)
        return mem_dir

    monkeypatch.setattr("shipyard.memory._memory_dir", patched_memory_dir)
    return mem_dir


class TestSaveMemory:
    def test_creates_json_file(self, memory_dir):
        mem_id = save_memory("LangGraph uses StateGraph for orchestration")
        files = list(memory_dir.glob("*.json"))
        assert len(files) == 1
        data = json.loads(files[0].read_text())
        assert data["content"] == "LangGraph uses StateGraph for orchestration"
        assert data["id"] == mem_id

    def test_saves_tags(self, memory_dir):
        save_memory("Use separate tables", tags=["architecture", "database"])
        files = list(memory_dir.glob("*.json"))
        data = json.loads(files[0].read_text())
        assert data["tags"] == ["architecture", "database"]

    def test_multiple_saves_create_unique_ids(self, memory_dir):
        id1 = save_memory("first")
        id2 = save_memory("second")
        assert id1 != id2


class TestLoadAllMemories:
    def test_returns_empty_for_empty_dir(self, memory_dir):
        memory_dir.mkdir(parents=True, exist_ok=True)
        assert load_all_memories() == []

    def test_loads_multiple_memories(self, memory_dir):
        save_memory("memory one")
        save_memory("memory two")
        memories = load_all_memories()
        assert len(memories) == 2
        contents = {m["content"] for m in memories}
        assert contents == {"memory one", "memory two"}


class TestDeleteMemory:
    def test_removes_file(self, memory_dir):
        mem_id = save_memory("to be deleted")
        assert delete_memory(mem_id) is True
        assert load_all_memories() == []

    def test_returns_false_for_nonexistent(self, memory_dir):
        memory_dir.mkdir(parents=True, exist_ok=True)
        assert delete_memory("nonexistent_id") is False


class TestFormatMemoriesForPrompt:
    def test_empty_list_returns_empty_string(self):
        assert format_memories_for_prompt([]) == ""

    def test_formats_memories_as_markdown(self):
        memories = [
            {"id": "m1", "content": "Project uses LangGraph", "tags": ["arch"]},
            {"id": "m2", "content": "Separate tables per entity", "tags": []},
        ]
        result = format_memories_for_prompt(memories)
        assert "Project uses LangGraph" in result
        assert "Separate tables per entity" in result

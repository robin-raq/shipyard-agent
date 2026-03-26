"""Tests for custom rules system (TDD — write tests first)."""

import pytest

from shipyard.rules import (
    format_rules_for_prompt,
    load_all_rules,
    parse_rule_file,
)


@pytest.fixture
def rules_dir(tmp_path, monkeypatch):
    """Use a temp directory for rules storage."""
    r_dir = tmp_path / ".shipyard" / "rules"

    def patched_rules_dir():
        r_dir.mkdir(parents=True, exist_ok=True)
        return r_dir

    monkeypatch.setattr("shipyard.rules._rules_dir", patched_rules_dir)
    return r_dir


class TestParseRuleFile:
    def test_with_frontmatter(self, tmp_path):
        rule_file = tmp_path / "tdd.md"
        rule_file.write_text(
            "---\n"
            "name: TDD First\n"
            "description: Always write tests before implementation\n"
            "---\n"
            "Write tests FIRST before implementing any new feature.\n"
            "Follow the Red-Green-Refactor cycle.\n"
        )
        result = parse_rule_file(rule_file)
        assert result["name"] == "TDD First"
        assert result["description"] == "Always write tests before implementation"
        assert "Write tests FIRST" in result["body"]
        assert "Red-Green-Refactor" in result["body"]

    def test_without_frontmatter(self, tmp_path):
        rule_file = tmp_path / "clean-code.md"
        rule_file.write_text("Keep functions small.\nDRY principle.\n")
        result = parse_rule_file(rule_file)
        assert result["name"] == "clean-code"
        assert result["description"] == ""
        assert "Keep functions small" in result["body"]

    def test_empty_file(self, tmp_path):
        rule_file = tmp_path / "empty.md"
        rule_file.write_text("")
        result = parse_rule_file(rule_file)
        assert result["name"] == "empty"
        assert result["body"] == ""


class TestLoadAllRules:
    def test_empty_directory(self, rules_dir):
        rules_dir.mkdir(parents=True, exist_ok=True)
        assert load_all_rules() == []

    def test_loads_multiple_rules(self, rules_dir):
        rules_dir.mkdir(parents=True, exist_ok=True)
        (rules_dir / "a.md").write_text("Rule A content")
        (rules_dir / "b.md").write_text("Rule B content")
        rules = load_all_rules()
        assert len(rules) == 2

    def test_ignores_non_md_files(self, rules_dir):
        rules_dir.mkdir(parents=True, exist_ok=True)
        (rules_dir / "valid.md").write_text("Valid rule")
        (rules_dir / "ignored.txt").write_text("Not a rule")
        rules = load_all_rules()
        assert len(rules) == 1
        assert rules[0]["name"] == "valid"

    def test_returns_rules_sorted_by_filename(self, rules_dir):
        rules_dir.mkdir(parents=True, exist_ok=True)
        (rules_dir / "z_last.md").write_text("Last rule")
        (rules_dir / "a_first.md").write_text("First rule")
        rules = load_all_rules()
        assert rules[0]["name"] == "a_first"
        assert rules[1]["name"] == "z_last"


class TestFormatRulesForPrompt:
    def test_empty_list_returns_empty_string(self):
        assert format_rules_for_prompt([]) == ""

    def test_formats_rules_with_names(self):
        rules = [
            {"name": "TDD", "description": "Test first", "body": "Write tests before code."},
            {"name": "DRY", "description": "No duplication", "body": "Extract common logic."},
        ]
        result = format_rules_for_prompt(rules)
        assert "TDD" in result
        assert "Write tests before code" in result
        assert "DRY" in result
        assert "Extract common logic" in result

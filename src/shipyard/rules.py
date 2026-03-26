"""Custom rules loader for the Shipyard agent.

Loads .md files from .shipyard/rules/ relative to the workspace root.
Each file can have optional YAML-like frontmatter (name, description)
and a markdown body. Rules are injected into the system prompt.
"""

from pathlib import Path

from shipyard.tools import _workspace_root


def _rules_dir() -> Path:
    """Return the rules directory, creating it if needed."""
    d = _workspace_root / ".shipyard" / "rules"
    d.mkdir(parents=True, exist_ok=True)
    return d


def parse_rule_file(path: Path) -> dict:
    """Parse a rule file with optional frontmatter.

    Frontmatter format (between --- delimiters):
        name: Rule Name
        description: One-line description

    Args:
        path: Path to the .md file.

    Returns:
        Dict with name, description, and body keys.
    """
    text = path.read_text().strip()

    if not text:
        return {"name": path.stem, "description": "", "body": ""}

    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) >= 3:
            frontmatter_raw = parts[1].strip()
            body = parts[2].strip()

            meta = {}
            for line in frontmatter_raw.splitlines():
                if ":" in line:
                    key, value = line.split(":", 1)
                    meta[key.strip()] = value.strip()

            return {
                "name": meta.get("name", path.stem),
                "description": meta.get("description", ""),
                "body": body,
            }

    return {"name": path.stem, "description": "", "body": text}


def load_all_rules() -> list[dict]:
    """Load all .md rule files from the rules directory.

    Returns:
        List of parsed rule dicts, sorted by filename.
    """
    rules_dir = _rules_dir()
    rules = []
    for f in sorted(rules_dir.glob("*.md")):
        rules.append(parse_rule_file(f))
    return rules


def format_rules_for_prompt(rules: list[dict]) -> str:
    """Format rules as a markdown block for the system prompt.

    Returns:
        Empty string if no rules, otherwise a formatted section.
    """
    if not rules:
        return ""
    lines = []
    for r in rules:
        lines.append(f"### {r['name']}")
        if r["description"]:
            lines.append(f"*{r['description']}*")
        if r["body"]:
            lines.append(r["body"])
        lines.append("")
    return "\n".join(lines).strip()

"""Report generation for evaluation results."""

from collections import defaultdict

from shipyard.evals.tasks import EvalResult


def summary_table(results: list[EvalResult]) -> str:
    """Generate a formatted summary table."""
    lines = [
        f"{'Task':<35} {'Category':<16} {'Result':<8} {'Tools':<7} {'Duration'}",
        "-" * 80,
    ]
    for r in results:
        status = "PASS" if r.passed else "FAIL"
        lines.append(
            f"{r.task_name:<35} {r.category:<16} {status:<8} {r.tool_call_count:<7} {r.duration_ms}ms"
        )
    return "\n".join(lines)


def category_summary(results: list[EvalResult]) -> str:
    """Generate pass rates grouped by category."""
    cats: dict[str, list[EvalResult]] = defaultdict(list)
    for r in results:
        cats[r.category].append(r)

    lines = [
        f"{'Category':<20} {'Pass Rate':<15} {'Tasks'}",
        "-" * 60,
    ]
    for cat, cat_results in sorted(cats.items()):
        passed = sum(1 for r in cat_results if r.passed)
        total = len(cat_results)
        pct = f"{passed}/{total} ({100 * passed // total}%)"
        failed_names = [r.task_name for r in cat_results if not r.passed]
        task_note = f" FAILED: {', '.join(failed_names)}" if failed_names else ""
        lines.append(f"{cat:<20} {pct:<15}{task_note}")
    return "\n".join(lines)


def failure_details(results: list[EvalResult]) -> str:
    """Show details for each failed task."""
    failed = [r for r in results if not r.passed]
    if not failed:
        return "No failures."

    lines = []
    for r in failed:
        lines.append(f"\n  {r.task_name} ({r.category}):")
        if r.error:
            lines.append(f"    Error: {r.error}")
        for er in r.expectation_results:
            if not er.passed:
                lines.append(f"    FAIL: {er.detail}")
    return "\n".join(lines)


def generate_report(results: list[EvalResult]) -> str:
    """Generate the full evaluation report."""
    total = len(results)
    passed = sum(1 for r in results if r.passed)
    pct = 100 * passed // total if total > 0 else 0

    avg_tools = (
        sum(r.tool_call_count for r in results) / total if total > 0 else 0
    )
    avg_duration = (
        sum(r.duration_ms for r in results) / total if total > 0 else 0
    )

    sections = [
        "Shipyard Agent Evaluation Report",
        "=" * 50,
        f"\nOverall: {passed}/{total} passed ({pct}%)",
        f"Avg tool calls: {avg_tools:.1f}  |  Avg duration: {avg_duration:.0f}ms\n",
        summary_table(results),
        f"\n{'=' * 50}\nBy Category:\n",
        category_summary(results),
        f"\n{'=' * 50}\nFailures:\n",
        failure_details(results),
    ]
    return "\n".join(sections)


def save_report(results: list[EvalResult], path: str) -> str:
    """Write report to file and return the path."""
    report = generate_report(results)
    with open(path, "w") as f:
        f.write(report)
    return path

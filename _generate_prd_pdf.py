"""Generate the combined Shipyard PRD as a professional PDF."""

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    KeepTogether, HRFlowable, Preformatted
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus.flowables import Flowable
import os

OUTPUT_PATH = "/Users/raqdominique/Documents/Web_Development/gfa/shipYard/shipyard_mvp_and_final_prd.pdf"

# Colors
NAVY = HexColor("#1a2332")
DARK_BLUE = HexColor("#2c3e50")
ACCENT_BLUE = HexColor("#3498db")
LIGHT_GRAY = HexColor("#f5f6fa")
MED_GRAY = HexColor("#dcdde1")
TABLE_HEADER_BG = HexColor("#2c3e50")
TABLE_ALT_ROW = HexColor("#f8f9fa")
CODE_BG = HexColor("#f4f4f4")
BORDER_COLOR = HexColor("#bdc3c7")
CHECK_COLOR = HexColor("#7f8c8d")


class ColoredBox(Flowable):
    """A colored background box with centered text for the title page."""
    def __init__(self, width, height, bg_color, text_lines):
        super().__init__()
        self.box_width = width
        self.box_height = height
        self.bg_color = bg_color
        self.text_lines = text_lines

    def wrap(self, availWidth, availHeight):
        return self.box_width, self.box_height

    def draw(self):
        self.canv.setFillColor(self.bg_color)
        self.canv.roundRect(0, 0, self.box_width, self.box_height, 6, fill=1, stroke=0)
        y = self.box_height - 40
        for text, font, size, color in self.text_lines:
            self.canv.setFillColor(color)
            self.canv.setFont(font, size)
            self.canv.drawCentredString(self.box_width / 2, y, text)
            y -= size + 8


def get_styles():
    """Create all paragraph styles."""
    styles = getSampleStyleSheet()

    custom = {
        "TitlePage_Main": ParagraphStyle(
            "TitlePage_Main", parent=styles["Title"],
            fontName="Helvetica-Bold", fontSize=28, leading=34,
            textColor=NAVY, alignment=TA_CENTER, spaceAfter=6,
        ),
        "TitlePage_Sub": ParagraphStyle(
            "TitlePage_Sub", parent=styles["Normal"],
            fontName="Helvetica", fontSize=14, leading=20,
            textColor=DARK_BLUE, alignment=TA_CENTER, spaceAfter=4,
        ),
        "TitlePage_Detail": ParagraphStyle(
            "TitlePage_Detail", parent=styles["Normal"],
            fontName="Helvetica", fontSize=11, leading=16,
            textColor=CHECK_COLOR, alignment=TA_CENTER, spaceAfter=2,
        ),
        "PhaseHeader": ParagraphStyle(
            "PhaseHeader", parent=styles["Heading1"],
            fontName="Helvetica-Bold", fontSize=22, leading=28,
            textColor=NAVY, spaceBefore=20, spaceAfter=12,
            borderWidth=0, borderPadding=0,
        ),
        "H1": ParagraphStyle(
            "H1", parent=styles["Heading1"],
            fontName="Helvetica-Bold", fontSize=18, leading=22,
            textColor=DARK_BLUE, spaceBefore=18, spaceAfter=8,
        ),
        "H2": ParagraphStyle(
            "H2", parent=styles["Heading2"],
            fontName="Helvetica-Bold", fontSize=14, leading=18,
            textColor=DARK_BLUE, spaceBefore=14, spaceAfter=6,
        ),
        "H3": ParagraphStyle(
            "H3", parent=styles["Heading3"],
            fontName="Helvetica-Bold", fontSize=12, leading=15,
            textColor=DARK_BLUE, spaceBefore=10, spaceAfter=4,
        ),
        "Body": ParagraphStyle(
            "Body", parent=styles["Normal"],
            fontName="Helvetica", fontSize=10, leading=14,
            textColor=black, alignment=TA_JUSTIFY, spaceAfter=6,
        ),
        "BodyBold": ParagraphStyle(
            "BodyBold", parent=styles["Normal"],
            fontName="Helvetica-Bold", fontSize=10, leading=14,
            textColor=black, spaceAfter=6,
        ),
        "Bullet": ParagraphStyle(
            "Bullet", parent=styles["Normal"],
            fontName="Helvetica", fontSize=10, leading=14,
            textColor=black, leftIndent=20, bulletIndent=8,
            spaceAfter=3, bulletFontName="Helvetica",
        ),
        "SubBullet": ParagraphStyle(
            "SubBullet", parent=styles["Normal"],
            fontName="Helvetica", fontSize=10, leading=14,
            textColor=black, leftIndent=40, bulletIndent=28,
            spaceAfter=2, bulletFontName="Helvetica",
        ),
        "Code": ParagraphStyle(
            "Code", parent=styles["Code"],
            fontName="Courier", fontSize=8, leading=11,
            textColor=black, backColor=CODE_BG,
            leftIndent=12, rightIndent=12,
            spaceBefore=4, spaceAfter=4,
            borderWidth=0.5, borderColor=BORDER_COLOR,
            borderPadding=6,
        ),
        "TOC_Phase": ParagraphStyle(
            "TOC_Phase", parent=styles["Normal"],
            fontName="Helvetica-Bold", fontSize=13, leading=20,
            textColor=NAVY, spaceBefore=10, spaceAfter=2,
        ),
        "TOC_Entry": ParagraphStyle(
            "TOC_Entry", parent=styles["Normal"],
            fontName="Helvetica", fontSize=10, leading=16,
            textColor=DARK_BLUE, leftIndent=16, spaceAfter=1,
        ),
        "TOC_SubEntry": ParagraphStyle(
            "TOC_SubEntry", parent=styles["Normal"],
            fontName="Helvetica", fontSize=9.5, leading=14,
            textColor=CHECK_COLOR, leftIndent=32, spaceAfter=1,
        ),
        "Checklist": ParagraphStyle(
            "Checklist", parent=styles["Normal"],
            fontName="Helvetica", fontSize=10, leading=14,
            textColor=black, leftIndent=20, spaceAfter=3,
        ),
        "Caption": ParagraphStyle(
            "Caption", parent=styles["Normal"],
            fontName="Helvetica-Oblique", fontSize=9, leading=12,
            textColor=CHECK_COLOR, alignment=TA_CENTER,
            spaceBefore=2, spaceAfter=8,
        ),
        "Quote": ParagraphStyle(
            "Quote", parent=styles["Normal"],
            fontName="Helvetica-Oblique", fontSize=10, leading=14,
            textColor=CHECK_COLOR, leftIndent=20, rightIndent=20,
            spaceBefore=4, spaceAfter=8,
        ),
    }
    return custom


def make_table(headers, rows, col_widths=None):
    """Create a styled table."""
    data = [headers] + rows
    avail = 6.5 * inch
    if col_widths:
        widths = col_widths
    else:
        n = len(headers)
        widths = [avail / n] * n

    header_style = ParagraphStyle("TH", fontName="Helvetica-Bold", fontSize=9,
                                   leading=12, textColor=white, alignment=TA_LEFT)
    cell_style = ParagraphStyle("TD", fontName="Helvetica", fontSize=9,
                                 leading=12, textColor=black, alignment=TA_LEFT)

    formatted = []
    for i, row in enumerate(data):
        fmt_row = []
        for cell in row:
            s = header_style if i == 0 else cell_style
            fmt_row.append(Paragraph(str(cell), s))
        formatted.append(fmt_row)

    t = Table(formatted, colWidths=widths, repeatRows=1)
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style_cmds.append(("BACKGROUND", (0, i), (-1, i), TABLE_ALT_ROW))
    t.setStyle(TableStyle(style_cmds))
    return t


def esc(text):
    """Escape XML special characters for Paragraph."""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def bold(text):
    return f"<b>{text}</b>"


def code_inline(text):
    return f'<font face="Courier" size="9" color="#c0392b">{esc(text)}</font>'


def build_title_page(story, S):
    story.append(Spacer(1, 1.5 * inch))
    story.append(Paragraph("Shipyard", S["TitlePage_Main"]))
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="40%", thickness=2, color=ACCENT_BLUE,
                             spaceAfter=12, spaceBefore=4))
    story.append(Paragraph("Product Requirements Document", S["TitlePage_Sub"]))
    story.append(Spacer(1, 6))
    story.append(Paragraph("Building an Autonomous Coding Agent", S["TitlePage_Sub"]))
    story.append(Spacer(1, 24))
    story.append(Paragraph(
        "Phase 1: MVP (36-hour gate; ~8 hrs focused implementation after Pre-Search)",
        S["TitlePage_Detail"]))
    story.append(Paragraph("Phase 2: Full-Scale Release (Thursday early + Sunday final)", S["TitlePage_Detail"]))
    story.append(Spacer(1, 24))

    # Decision table split by phase (Issue 2)
    mvp_data = [
        ["Language", "Python 3.11+"],
        ["Agent Framework", "LangGraph"],
        ["LLM", "Claude (Anthropic SDK)"],
        ["File Editing", "Anchor-Based Replacement"],
        ["Observability", "LangSmith"],
    ]
    story.append(Paragraph("<b>MVP Decisions (Tuesday gate)</b>", S["TitlePage_Detail"]))
    story.append(Spacer(1, 4))
    story.append(make_table(["Decision", "Choice"], mvp_data, [2.0 * inch, 3.0 * inch]))
    story.append(Spacer(1, 10))

    final_data = [
        ["Multi-Agent", "Supervisor + Workers (Thursday)"],
        ["Deployment", "Railway (Sunday)"],
        ["Ship Rebuild Stack", "React/Vite + Express + PostgreSQL + TipTap/Yjs"],
    ]
    story.append(Paragraph("<b>Final Release Additions (Thursday / Sunday)</b>", S["TitlePage_Detail"]))
    story.append(Spacer(1, 4))
    story.append(make_table(["Decision", "Choice"], final_data, [2.0 * inch, 3.0 * inch]))
    story.append(Spacer(1, 16))
    story.append(Paragraph("March 2026", S["TitlePage_Detail"]))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "<i>Note: This is a product requirements document, not the Pre-Search Checklist (Appendix items 1\u201313). "
        "See PRESEARCH.md for the official checklist submission.</i>", S["TitlePage_Detail"]))
    story.append(PageBreak())


def build_toc(story, S):
    story.append(Paragraph("Table of Contents", S["PhaseHeader"]))
    story.append(HRFlowable(width="100%", thickness=1, color=MED_GRAY, spaceAfter=12))

    toc_items = [
        ("Phase 1: MVP (36-hour gate)", True, [
            "Problem Statement",
            "User Persona",
            "Core User Flow",
            "Technical Constraints",
            "MVP Feature Set",
            "MVP Non-Features (Out of Scope)",
            "Hour-by-Hour Build Plan",
            "Success Criteria",
            "Trace Requirements (MVP Gate)",
            "Key Risks",
            "Project Structure",
        ]),
        ("Phase 2: Full-Scale Release", True, [
            "Problem Statement (Full Scope)",
            "User Personas",
            "System Architecture",
            "Ship App Rebuild \u2014 Feature Requirements",
            "Comparative Analysis Requirements",
            "Deployment Requirements",
            "Non-Functional Requirements",
            "Cost Analysis Framework",
            "Observability Requirements",
            "Full Deliverables Checklist",
            "Course Alignment Note",
        ]),
    ]
    for phase, is_phase, entries in toc_items:
        story.append(Paragraph(phase, S["TOC_Phase"]))
        for entry in entries:
            story.append(Paragraph(entry, S["TOC_Entry"]))
    story.append(PageBreak())


def build_phase1(story, S):
    # Phase header
    story.append(Paragraph("Phase 1: MVP", S["PhaseHeader"]))
    story.append(HRFlowable(width="100%", thickness=2, color=ACCENT_BLUE, spaceAfter=6))
    story.append(Paragraph(
        "<i>36-hour gate (Tuesday 11:59 PM)  |  ~8 hours estimated focused implementation after Pre-Search</i>",
        S["Quote"]))
    story.append(Spacer(1, 8))

    # Problem Statement
    story.append(Paragraph("Problem Statement", S["H1"]))
    story.append(Paragraph(
        "Development teams use multiple fragmented tools (Claude Code, Cursor, custom scripts) for AI-assisted coding. "
        "None of these are fully transparent \u2014 you can\u2019t see exactly what the agent did, in what order, with what inputs. "
        "Building your own agent from scratch forces you to understand every design decision and produces a system you can "
        "fully trace, debug, and evaluate.", S["Body"]))
    story.append(Paragraph("The MVP must prove three things work:", S["BodyBold"]))
    for item in ["The agent runs continuously and accepts new instructions",
                  "It makes surgical edits (not full-file rewrites)",
                  "Every action is traceable"]:
        story.append(Paragraph(f"\u2022  {item}", S["Bullet"]))
    story.append(Spacer(1, 6))

    # User Persona
    story.append(Paragraph("User Persona", S["H1"]))
    story.append(Paragraph(
        f"{bold('The Operator (you):')} A developer directing the agent via CLI. You type instructions, inject context "
        "(specs, test output), and intervene when the agent gets stuck. You need clear feedback about what the agent did "
        "and whether it worked.", S["Body"]))

    # Core User Flow
    story.append(Paragraph("Core User Flow (Happy Path)", S["H1"]))
    flow_text = (
        "1. Start agent &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&rarr; python -m shipyard &rarr; REPL prompt appears\n"
        '2. Give instruction &nbsp;&rarr; "Add a /health endpoint to api/routes/index.ts"\n'
        "3. Agent reads file &nbsp;&rarr; [read_file] returns file with line numbers\n"
        "4. Agent plans edit &nbsp;&rarr; Identifies insertion point\n"
        "5. Agent applies edit &rarr; [edit_file] replaces anchor with new code\n"
        "6. Agent verifies &nbsp;&nbsp;&nbsp;&nbsp;&rarr; [run_command] runs syntax check &rarr; passes\n"
        '7. Agent reports &nbsp;&nbsp;&nbsp;&nbsp;&rarr; "Added /health endpoint. Syntax check passed."\n'
        "8. Trace logged &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&rarr; Full step-by-step trace saved to traces/\n"
        "9. Await next input &nbsp;&rarr; REPL prompt reappears"
    )
    for line in flow_text.split("\n"):
        story.append(Paragraph(line.strip(), S["Bullet"]))
    story.append(Spacer(1, 6))

    # Technical Constraints
    story.append(Paragraph("Technical Constraints", S["H1"]))
    story.append(make_table(
        ["Constraint", "Detail"],
        [
            ["Language", "Python 3.11+"],
            ["Framework", "LangGraph"],
            ["LLM", "Claude (Anthropic SDK) \u2014 Claude 3.5 Sonnet for development"],
            ["Observability", "LangSmith (set LANGCHAIN_TRACING_V2=true)"],
            ["File editing", "Anchor-based replacement only"],
            ["Runtime", "Local only \u2014 no deployment needed"],
            ["State", "In-memory (Python process = state store)"],
        ],
        [2.0 * inch, 4.5 * inch]
    ))
    story.append(Spacer(1, 8))

    # MVP Feature Set
    story.append(Paragraph("MVP Feature Set (Must-Have)", S["H1"]))

    story.append(Paragraph("1. Persistent Agent Loop", S["H2"]))
    for b in ["Python REPL that stays alive between instructions",
              "Accepts natural language instructions via stdin",
              "Maintains conversation context across turns",
              "Graceful exit with /quit command"]:
        story.append(Paragraph(f"\u2022  {b}", S["Bullet"]))

    story.append(Paragraph("2. Core Tools (5 tools minimum)", S["H2"]))
    story.append(make_table(
        ["Tool", "Signature", "Purpose"],
        [
            ["read_file", "(path: str) \u2192 str", "Read file with line numbers"],
            ["edit_file", "(path: str, old_text: str, new_text: str) \u2192 str", "Anchor-based surgical edit"],
            ["create_file", "(path: str, content: str) \u2192 str", "Create new file"],
            ["list_files", "(directory: str, pattern?: str) \u2192 list[str]", "List directory contents"],
            ["run_command", "(command: str) \u2192 str", "Execute shell command"],
        ],
        [1.2 * inch, 2.8 * inch, 2.5 * inch]
    ))
    story.append(Spacer(1, 6))

    story.append(Paragraph("3. Surgical File Editing", S["H2"]))
    for b in [
        "old_text must be unique in the file (exact match)",
        "If not unique: return all matches with line numbers, ask LLM to be more specific",
        "If not found: return error with actual file content",
        "After each edit: re-read file to verify the change landed",
        "Keep pre-edit backup for revert capability",
    ]:
        story.append(Paragraph(f"\u2022  {b}", S["Bullet"]))

    story.append(Paragraph("4. Context Injection", S["H2"]))
    for b in [
        "/context &lt;filepath&gt; command reads a file and injects it as context",
        "/context paste allows pasting text directly (terminated by empty line)",
        "Context is wrapped in &lt;injected_context&gt; tags and prepended to the next LLM call",
    ]:
        story.append(Paragraph(f"\u2022  {b}", S["Bullet"]))

    story.append(Paragraph("5. Tracing", S["H2"]))
    for b in [
        "LangSmith auto-tracing via environment variables",
        "Local JSON trace files saved to traces/ directory",
        "Each trace includes: instruction, tool calls with I/O, token usage, duration, result",
    ]:
        story.append(Paragraph(f"\u2022  {b}", S["Bullet"]))

    # Non-features
    story.append(Paragraph("MVP Non-Features (Explicitly Out of Scope)", S["H1"]))
    for b in [
        "Multi-agent coordination (Thursday deliverable)",
        "Ship app rebuild (Thursday deliverable)",
        "Web UI / dashboard",
        "Deployment / hosting",
        "AST parsing or language-specific editing",
        "Automatic error recovery beyond 3 retries",
        "Streaming responses",
        "File watching / auto-refresh",
    ]:
        story.append(Paragraph(f"\u2022  {b}", S["Bullet"]))

    # Build plan
    story.append(Paragraph("Hour-by-Hour Build Plan", S["H1"]))
    story.append(make_table(
        ["Hour", "Focus", "Deliverable"],
        [
            ["0\u20131", "Project setup", "Python project, dependencies installed, LangGraph hello world running"],
            ["1\u20132", "LangGraph fundamentals", "Minimal state graph with one node that calls Claude"],
            ["2\u20133", "Tool implementation", "read_file, create_file, list_files tools working"],
            ["3\u20134", "Surgical editing", "edit_file with anchor-based replacement, uniqueness validation"],
            ["4\u20135", "Agent loop", "Persistent REPL, tool calling integrated into LangGraph state graph"],
            ["5\u20136", "Context injection", "/context command, injected context flows to LLM"],
            ["6\u20137", "Tracing + verification", "LangSmith connected, local JSON traces, edit verification"],
            ["7\u20138", "Testing + docs", "Test against real files, fill in CODEAGENT.md MVP sections"],
        ],
        [0.7 * inch, 1.6 * inch, 4.2 * inch]
    ))
    story.append(Spacer(1, 8))

    # Success Criteria
    story.append(Paragraph("Success Criteria (All Required)", S["H1"]))
    for item in [
        "python -m shipyard starts a persistent REPL",
        "Agent makes surgical edits without rewriting entire files",
        "Agent accepts injected context and uses it in generation",
        "Two LangSmith trace links showing different execution paths",
        "PRESEARCH.md complete with all architecture artifacts",
        "CODEAGENT.md has Agent Architecture and File Editing Strategy sections filled in",
        "Runs locally from a fresh git clone + pip install",
    ]:
        story.append(Paragraph(f"\u2610  {item}", S["Checklist"]))

    # Trace Requirements (moved from Phase 2 — Issue 3: MVP gate criteria belong in Phase 1)
    story.append(Paragraph("Trace Requirements (MVP Gate)", S["H1"]))
    story.append(Paragraph(
        "Two shared trace links are required for the Tuesday MVP gate. Both must demonstrate different execution paths.",
        S["Body"]))
    story.append(Paragraph(
        f"\u2022  {bold('Trace 1:')} Normal successful edit (read \u2192 edit \u2192 verify \u2192 success)", S["Bullet"]))
    story.append(Paragraph(
        f"\u2022  {bold('Trace 2:')} Error branch (read \u2192 edit fails \u2192 retry \u2192 success, OR escalate to human)",
        S["Bullet"]))
    story.append(Spacer(1, 6))

    # Key Risks
    story.append(Paragraph("Key Risks", S["H1"]))
    story.append(make_table(
        ["Risk", "Likelihood", "Mitigation"],
        [
            ["LangGraph learning curve eats into coding time", "High",
             "Budget 2 hours for learning; follow official quickstart first"],
            ["LLM produces bad anchors that don't match", "Medium",
             "Good system prompt; require reading file before editing; show line numbers"],
            ["Token costs spiral during development", "Medium",
             "Use Sonnet (not Opus); set token budget alerts; cache file reads"],
            ["Tracing setup takes longer than expected", "Low",
             "LangSmith auto-traces with LangGraph \u2014 just set env vars"],
        ],
        [2.2 * inch, 0.9 * inch, 3.4 * inch]
    ))
    story.append(Spacer(1, 8))

    # Project Structure
    story.append(Paragraph("Minimal Project Structure", S["H1"]))
    struct = [
        "shipyard/",
        "\u251c\u2500\u2500 pyproject.toml           # Dependencies: langgraph, anthropic, langsmith",
        "\u251c\u2500\u2500 src/",
        "\u2502   \u2514\u2500\u2500 shipyard/",
        "\u2502       \u251c\u2500\u2500 __init__.py",
        "\u2502       \u251c\u2500\u2500 __main__.py      # Entry point: REPL loop",
        "\u2502       \u251c\u2500\u2500 agent.py         # LangGraph state graph definition",
        "\u2502       \u251c\u2500\u2500 tools.py         # Tool implementations",
        "\u2502       \u251c\u2500\u2500 state.py         # State schema for LangGraph",
        "\u2502       \u2514\u2500\u2500 prompts.py       # System prompt and tool descriptions",
        "\u251c\u2500\u2500 tests/",
        "\u2502   \u251c\u2500\u2500 test_tools.py        # Unit tests for each tool",
        "\u2502   \u2514\u2500\u2500 test_agent.py        # Integration tests for the agent loop",
        "\u251c\u2500\u2500 traces/                  # Local JSON trace output",
        "\u251c\u2500\u2500 PRESEARCH.md",
        "\u251c\u2500\u2500 CODEAGENT.md",
        "\u2514\u2500\u2500 README.md",
    ]
    for line in struct:
        story.append(Paragraph(line, S["Code"]))

    story.append(PageBreak())


def build_phase2(story, S):
    story.append(Paragraph("Phase 2: Full-Scale Release", S["PhaseHeader"]))
    story.append(HRFlowable(width="100%", thickness=2, color=ACCENT_BLUE, spaceAfter=6))
    story.append(Paragraph(
        "<i>Early Submission: Thursday 11:59 PM  |  Final Submission: Sunday 11:59 PM</i>",
        S["Quote"]))
    story.append(Spacer(1, 8))

    # Problem Statement
    story.append(Paragraph("Problem Statement (Full Scope)", S["H1"]))
    story.append(Paragraph(
        "Build a production-grade multi-agent autonomous coding system that can decompose complex development tasks, "
        "dispatch them to specialized worker agents, and produce a fully functional rebuild of the US Treasury Department\u2019s "
        "Ship app \u2014 a real-time collaborative project management platform. The system must be fully traceable, publicly "
        "deployed, and accompanied by a rigorous comparative analysis.", S["Body"]))

    # User Personas
    story.append(Paragraph("User Personas", S["H1"]))
    story.append(make_table(
        ["Persona", "Context", "Needs"],
        [
            ["Agent Operator", "Directing the agent to rebuild Ship",
             "Clear traces, intervention points, context injection, persistent loop"],
            ["Code Reviewer", "Evaluating agent-built code vs original",
             "Comparative analysis data, architecture documentation"],
            ["Evaluator", "Grading the project deliverables",
             "Working deployed demo, honest shortcomings, cost data, trace links"],
        ],
        [1.3 * inch, 2.2 * inch, 3.0 * inch]
    ))
    story.append(Spacer(1, 8))

    # System Architecture
    story.append(Paragraph("System Architecture", S["H1"]))
    story.append(Paragraph("Multi-Agent Orchestration (Supervisor + Workers)", S["H2"]))
    story.append(Paragraph(
        "A single Supervisor Agent receives high-level instructions, decomposes them into subtasks, "
        "routes each subtask to the appropriate specialized Worker, merges their results, validates the output, "
        "and handles conflict resolution. The Supervisor maintains global project state.", S["Body"]))

    story.append(Paragraph("Worker Specialization", S["H3"]))
    story.append(make_table(
        ["Worker", "Scope", "Tools", "Special Context"],
        [
            ["Backend Worker", "api/ directory", "read, edit, create, run_command", "Express patterns, route conventions"],
            ["Frontend Worker", "web/ directory", "read, edit, create, run_command", "React/Vite patterns, TailwindCSS"],
            ["Database Worker", "migrations, schema", "read, edit, create, run_command", "PostgreSQL DDL, seed data"],
            ["Shared Worker", "shared/ directory", "read, edit, create", "TypeScript interfaces"],
        ],
        [1.3 * inch, 1.3 * inch, 1.9 * inch, 2.0 * inch]
    ))
    story.append(Spacer(1, 6))

    story.append(Paragraph("Communication Flow", S["H3"]))
    for i, item in enumerate([
        'User gives instruction to Supervisor: "Build the Issues feature"',
        "Supervisor decomposes into subtasks (Database, Backend, Frontend, Shared)",
        "Supervisor sequences tasks based on dependencies (D \u2192 A \u2192 B \u2192 C)",
        "Workers execute using surgical edits",
        "Supervisor merges results, runs integration check (pnpm build &amp;&amp; pnpm test)",
    ], 1):
        story.append(Paragraph(f"{i}.  {item}", S["Bullet"]))

    story.append(Paragraph("Conflict Resolution", S["H3"]))
    for item in [
        f"{bold('Same file edit:')} Supervisor serializes \u2014 Worker A edits first, Worker B gets updated file",
        f"{bold('Type mismatch:')} Shared Worker defines interfaces first; other workers consume them",
        f"{bold('Build failure:')} Supervisor runs build after each merge; if it fails, responsible worker gets the error",
    ]:
        story.append(Paragraph(f"\u2022  {item}", S["Bullet"]))

    # Ship App Rebuild
    story.append(Paragraph("Ship App Rebuild \u2014 Feature Requirements", S["H1"]))
    story.append(Paragraph(
        "The agent must rebuild these features from the original Ship app. Listed in priority/dependency order.",
        S["Body"]))

    story.append(Paragraph("Foundation (Thursday Target)", S["H2"]))

    story.append(Paragraph("1.1 Monorepo Scaffold", S["H3"]))
    for b in [
        "pnpm workspace with web/, api/, shared/ packages",
        "Docker Compose for local development (PostgreSQL container)",
        "Shared TypeScript configuration",
        "Environment variable management (.env.example)",
    ]:
        story.append(Paragraph(f"\u2022  {b}", S["Bullet"]))

    story.append(Paragraph("1.2 Database Schema", S["H3"]))
    for b in [
        "PostgreSQL with normalized schema",
        "Central documents table with document_type discriminator",
        "Document types: Doc, Issue, Project, Week/Plan, Team",
        "Migration system (up/down migrations)",
        "Seed data for development",
    ]:
        story.append(Paragraph(f"\u2022  {b}", S["Bullet"]))

    story.append(Paragraph("1.3 API Server (Express)", S["H3"]))
    for b in [
        "Express.js on port 3000",
        "RESTful routes: GET/POST/PUT/DELETE /api/documents",
        "OpenAPI/Swagger documentation at /api/docs",
        "Session management (15-minute idle timeout)",
        "Audit logging for all document operations",
    ]:
        story.append(Paragraph(f"\u2022  {b}", S["Bullet"]))

    story.append(Paragraph("1.4 Web Client (React + Vite)", S["H3"]))
    for b in [
        "React SPA at port 5173",
        "TailwindCSS for styling",
        "Four primary views: Docs, Issues, Projects, Teams",
        "Basic CRUD UI for each view",
        "Responsive layout",
    ]:
        story.append(Paragraph(f"\u2022  {b}", S["Bullet"]))

    story.append(Paragraph("Rich Features (Thursday \u2192 Sunday)", S["H2"]))

    story.append(Paragraph("2.1 Real-Time Collaborative Editing", S["H3"]))
    for b in [
        "TipTap rich text editor integration",
        "Yjs for operational transform / conflict resolution",
        "WebSocket server for real-time sync",
        'Visible cursor tracking for concurrent editors',
        '"Server is truth" \u2014 backend maintains authoritative document state',
    ]:
        story.append(Paragraph(f"\u2022  {b}", S["Bullet"]))

    story.append(Paragraph("2.2 Plans &amp; Weeks", S["H3"]))
    for b in [
        "Weekly planning view \u2014 set intentions for the week",
        "Visual escalation indicators (yellow \u2192 red for aging docs)",
        "Retrospective capability",
    ]:
        story.append(Paragraph(f"\u2022  {b}", S["Bullet"]))

    story.append(Paragraph("2.3 Issue Tracking Features", S["H3"]))
    for b in [
        "Status fields (open, in progress, done)",
        "Priority levels",
        "Rich content (full TipTap editor, not just plain text)",
        "Cross-linking between issues, docs, and projects",
    ]:
        story.append(Paragraph(f"\u2022  {b}", S["Bullet"]))

    story.append(Paragraph("2.4 Accessibility (Section 508 / WCAG 2.1 AA)", S["H3"]))
    for b in [
        "4.5:1 color contrast minimum",
        "Full keyboard navigation",
        "Screen reader support (ARIA labels)",
        "Visible focus indicators",
        "No external CDN \u2014 all assets served internally",
    ]:
        story.append(Paragraph(f"\u2022  {b}", S["Bullet"]))

    # Comparative Analysis
    story.append(Paragraph("Comparative Analysis Requirements", S["H1"]))
    story.append(Paragraph(
        "After the rebuild, produce a 7-section analysis. This is the <b>most heavily weighted deliverable</b>.",
        S["Body"]))

    sections = [
        ("1. Executive Summary", "One paragraph: what you built, how the rebuild went overall."),
        ("2. Architectural Comparison",
         "Structural differences between agent-built and original. What choices did the agent make that a human wouldn't? "
         "Focus on: file organization, API design patterns, component structure, database schema differences."),
        ("3. Performance Benchmarks",
         "Measurable comparisons: lines of code (total, per feature), code complexity, test coverage percentage, "
         "build time, bundle size (frontend), load time (first meaningful paint)."),
        ("4. Shortcomings",
         "Every failure, intervention, and incorrect output from the rebuild log. What broke, what you did to fix it, "
         "and what it reveals about the agent's limitations."),
        ("5. Advances",
         "Where the agent outperformed manual development: speed (time per feature), consistency (boilerplate generation), "
         "completeness (e.g., generated tests alongside code)."),
        ("6. Trade-off Analysis",
         "For each major architecture decision in the agent: was it the right call? What would you change? "
         "How did it affect the rebuild quality?"),
        ("7. If You Built It Again",
         "What would be different about: agent architecture, file editing strategy, context management, "
         "multi-agent coordination, token budget / cost management."),
    ]
    for title, desc in sections:
        story.append(Paragraph(f"<b>{title}</b>", S["Body"]))
        story.append(Paragraph(desc, S["Bullet"]))

    # Deployment
    story.append(Paragraph("Deployment Requirements", S["H1"]))
    story.append(Paragraph("Platform: Railway", S["H2"]))
    story.append(make_table(
        ["Component", "Deployment"],
        [
            ["Shipyard Agent", "Python Docker container on Railway"],
            ["Ship App (API)", "Node.js Docker container on Railway"],
            ["Ship App (Web)", "Static build served by API or separate container"],
            ["PostgreSQL", "Railway managed PostgreSQL addon"],
        ],
        [2.0 * inch, 4.5 * inch]
    ))
    story.append(Spacer(1, 6))
    story.append(Paragraph("Deployment Checklist", S["H3"]))
    for item in [
        "Agent accessible via public URL",
        "Ship app accessible via public URL (all four views functional)",
        "PostgreSQL provisioned with seed data",
        "Environment variables configured (API keys, database URL)",
        "README includes one-command local setup instructions",
    ]:
        story.append(Paragraph(f"\u2610  {item}", S["Checklist"]))

    # Cost Analysis
    story.append(Paragraph("Cost Analysis Framework", S["H1"]))
    story.append(Paragraph("Development Costs (Track During Build)", S["H2"]))
    story.append(make_table(
        ["Item", "Amount"],
        [
            ["Claude API \u2014 input tokens", "(track during build)"],
            ["Claude API \u2014 output tokens", "(track during build)"],
            ["Total invocations during development", "(track during build)"],
            ["Total development spend", "(track during build)"],
        ],
        [3.2 * inch, 3.3 * inch]
    ))
    story.append(Spacer(1, 8))

    story.append(Paragraph("Production Cost Model", S["H2"]))
    story.append(Paragraph(
        f"{bold('Assumptions:')} 10 invocations/user/day, 4,000 input tokens/invocation, "
        "2,000 output tokens/invocation, Claude Sonnet pricing ($3/M input, $15/M output).",
        S["Body"]))
    story.append(Paragraph(f"{bold('Per-invocation cost:')} $0.012 input + $0.030 output = $0.042 total", S["Body"]))
    story.append(make_table(
        ["Scale", "Daily Invocations", "Monthly Cost"],
        [
            ["100 users", "1,000/day", "~$1,260/month"],
            ["1,000 users", "10,000/day", "~$12,600/month"],
            ["10,000 users", "100,000/day", "~$126,000/month"],
        ],
        [2.0 * inch, 2.0 * inch, 2.5 * inch]
    ))
    story.append(Spacer(1, 6))
    story.append(Paragraph("Cost Optimization Levers", S["H3"]))
    for b in [
        "Caching: cache file reads to reduce input tokens",
        "Smaller model for simple tasks (Haiku for list_files, Sonnet for edit_file)",
        "Token budget caps per invocation",
        "Prompt compression for long conversations",
    ]:
        story.append(Paragraph(f"\u2022  {b}", S["Bullet"]))

    # Non-Functional Requirements (Issue 4)
    story.append(Paragraph("Non-Functional Requirements", S["H1"]))
    story.append(Paragraph(
        "For a publicly deployed agent and Ship app, the following non-functional requirements apply. "
        "These are not MVP-blocking but are expected in the Final Submission.", S["Body"]))

    story.append(Paragraph("Security", S["H2"]))
    for b in [
        f"{bold('run_command sandboxing:')} Agent shell commands must be scoped to the project directory; "
        "reject commands containing rm -rf /, sudo, or paths outside the workspace",
        f"{bold('Secrets handling:')} API keys (ANTHROPIC_API_KEY, LANGCHAIN_API_KEY, DATABASE_URL) stored in "
        "environment variables only; never logged in traces or committed to git",
        f"{bold('Auth for public agent URL:')} Deployed agent endpoint must require an API key or basic auth; "
        "do not expose an unauthenticated endpoint that can run arbitrary shell commands",
        f"{bold('Input validation:')} Sanitize file paths passed to tools (no path traversal via ../)",
    ]:
        story.append(Paragraph(f"\u2022  {b}", S["Bullet"]))

    story.append(Paragraph("Reliability", S["H2"]))
    for b in [
        f"{bold('Rate limiting:')} Agent should respect Anthropic API rate limits; implement exponential backoff on 429 responses",
        f"{bold('Idempotency:')} edit_file on the same anchor twice with the same new_text should be a no-op, not a duplicate insertion",
        f"{bold('Graceful degradation:')} If LangSmith is unreachable, traces fall back to local JSON logging; agent does not crash",
    ]:
        story.append(Paragraph(f"\u2022  {b}", S["Bullet"]))

    story.append(Paragraph("Error Handling", S["H2"]))
    for b in [
        f"{bold('Structured errors:')} Tool failures return a consistent schema: "
        "{{\"error\": true, \"type\": \"...\", \"message\": \"...\", \"recoverable\": true/false}}",
        f"{bold('Max retry budget:')} 3 retries per tool call; after that, escalate to user; never infinite-loop",
        f"{bold('File backup before edit:')} Every edit_file call saves a .bak copy; revert is always possible",
    ]:
        story.append(Paragraph(f"\u2022  {b}", S["Bullet"]))

    # Observability
    story.append(Paragraph("Observability Requirements", S["H1"]))
    story.append(Paragraph("LangSmith Integration", S["H2"]))
    for b in [
        "Set LANGCHAIN_TRACING_V2=true and LANGCHAIN_API_KEY",
        "All LangGraph runs auto-traced",
        "Tag traces by: task type, worker agent, success/failure",
    ]:
        story.append(Paragraph(f"\u2022  {b}", S["Bullet"]))

    story.append(Paragraph("Trace Requirements (MVP Gate)", S["H2"]))
    story.append(Paragraph(
        f"\u2022  {bold('Trace 1:')} Normal successful edit (read \u2192 edit \u2192 verify \u2192 success)", S["Bullet"]))
    story.append(Paragraph(
        f"\u2022  {bold('Trace 2:')} Error branch (read \u2192 edit fails \u2192 retry \u2192 success, OR escalate to human)",
        S["Bullet"]))

    story.append(Paragraph("Rebuild Logging", S["H2"]))
    story.append(Paragraph("Every human intervention logged with:", S["Body"]))
    for b in ["Timestamp", "What broke", "What you did", "Time to resolve",
              "What it reveals about the agent"]:
        story.append(Paragraph(f"\u2022  {b}", S["Bullet"]))

    # Deliverables
    story.append(Paragraph("Full Deliverables Checklist", S["H1"]))
    story.append(make_table(
        ["Deliverable", "Deadline", "Status"],
        [
            ["PRESEARCH.md (all phases)", "Pre-Search", "\u2610"],
            ["CODEAGENT.md (MVP sections)", "Tuesday", "\u2610"],
            ["Persistent agent loop", "Tuesday", "\u2610"],
            ["Surgical file editing", "Tuesday", "\u2610"],
            ["Context injection", "Tuesday", "\u2610"],
            ["Two LangSmith trace links", "Tuesday", "\u2610"],
            ["Multi-agent coordination", "Thursday", "\u2610"],
            ["Ship rebuild complete", "Thursday", "\u2610"],
            ["Comparative analysis draft", "Thursday", "\u2610"],
            ["CODEAGENT.md (all sections)", "Sunday", "\u2610"],
            ["AI Development Log", "Sunday", "\u2610"],
            ["AI Cost Analysis", "Sunday", "\u2610"],
            ["Deployed application", "Sunday", "\u2610"],
            ["Demo video (3\u20135 min)", "Sunday", "\u2610"],
            ["Social post (@GauntletAI)", "Sunday", "\u2610"],
        ],
        [2.8 * inch, 1.5 * inch, 2.2 * inch]
    ))
    story.append(Spacer(1, 12))

    # Course Alignment Note (Issue 5)
    story.append(Paragraph("Course Alignment Note", S["H1"]))
    story.append(Paragraph(
        "This document is a <b>product requirements document</b> (MVP scope + full release scope). "
        "It is <b>not</b> a substitute for the official Pre-Search Checklist required by the course assignment.",
        S["Body"]))
    story.append(Paragraph(
        "The course\u2019s <i>Appendix: Pre-Search Checklist</i> (items 1\u201313) requires a specific format covering "
        "open-source research, architecture design, and stack/operations decisions. That checklist is maintained "
        "separately in <b>PRESEARCH.md</b> and should be submitted as the official pre-search deliverable.",
        S["Body"]))
    story.append(Paragraph("Relationship between documents:", S["BodyBold"]))
    story.append(make_table(
        ["Document", "Purpose", "Submission Role"],
        [
            ["PRESEARCH.md", "Numbered checklist (items 1\u201313) matching course appendix",
             "Official pre-search deliverable"],
            ["This PDF (shipyard_mvp_and_final_prd.pdf)", "Product requirements for MVP + final release",
             "Internal planning reference"],
            ["CODEAGENT.md", "Agent architecture, file editing, multi-agent, traces, rebuild log",
             "Official agent documentation deliverable"],
        ],
        [2.2 * inch, 2.3 * inch, 2.0 * inch]
    ))


def add_page_number(canvas_obj, doc):
    """Add page numbers and footer line."""
    page_num = canvas_obj.getPageNumber()
    if page_num > 1:  # Skip title page
        canvas_obj.setStrokeColor(MED_GRAY)
        canvas_obj.setLineWidth(0.5)
        canvas_obj.line(inch, 0.6 * inch, 7.5 * inch, 0.6 * inch)
        canvas_obj.setFont("Helvetica", 8)
        canvas_obj.setFillColor(CHECK_COLOR)
        canvas_obj.drawCentredString(4.25 * inch, 0.4 * inch, f"Shipyard PRD  \u2014  Page {page_num}")


def main():
    doc = SimpleDocTemplate(
        OUTPUT_PATH,
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.85 * inch,
        title="Shipyard \u2014 Product Requirements Document",
        author="Shipyard Team",
        subject="Building an Autonomous Coding Agent",
    )

    S = get_styles()
    story = []

    build_title_page(story, S)
    build_toc(story, S)
    build_phase1(story, S)
    build_phase2(story, S)

    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
    print(f"PDF created: {OUTPUT_PATH}")
    print(f"Size: {os.path.getsize(OUTPUT_PATH) / 1024:.1f} KB")


if __name__ == "__main__":
    main()

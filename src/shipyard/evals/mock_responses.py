"""Pre-built mock LLM responses for deterministic evaluation tasks.

Each function returns a list of AIMessage objects that simulate the
LLM's behavior for a specific task. Tool calls use unique IDs.
"""

from langchain_core.messages import AIMessage


# --- Task 1: create_new_file ---
def create_new_file_responses():
    return [
        AIMessage(content="", tool_calls=[{
            "id": "c1_1",
            "name": "create_file",
            "args": {
                "path": "utils.py",
                "content": "def add(a, b):\n    return a + b\n",
            },
        }]),
        AIMessage(content="Created utils.py with an add function."),
    ]


# --- Task 2: create_nested_file ---
def create_nested_file_responses():
    return [
        AIMessage(content="", tool_calls=[{
            "id": "c2_1",
            "name": "create_file",
            "args": {
                "path": "src/helpers/string_utils.py",
                "content": (
                    "def capitalize_first(text: str) -> str:\n"
                    '    return text[0].upper() + text[1:] if text else ""\n'
                ),
            },
        }]),
        AIMessage(content="Created src/helpers/string_utils.py."),
    ]


# --- Task 3: read_and_summarize ---
def read_and_summarize_responses():
    return [
        AIMessage(content="", tool_calls=[{
            "id": "c3_1",
            "name": "read_file",
            "args": {"path": "hello.py"},
        }]),
        AIMessage(
            content="The file defines one function: `greet(name)` which "
            "returns a greeting string like 'Hello, {name}!'."
        ),
    ]


# --- Task 4: surgical_edit_add_function ---
def surgical_edit_add_function_responses():
    return [
        AIMessage(content="", tool_calls=[{
            "id": "c4_1",
            "name": "read_file",
            "args": {"path": "hello.py"},
        }]),
        AIMessage(content="", tool_calls=[{
            "id": "c4_2",
            "name": "edit_file",
            "args": {
                "path": "hello.py",
                "old_text": 'def greet(name):\n    return f"Hello, {name}!"',
                "new_text": (
                    'def greet(name):\n    return f"Hello, {name}!"\n\n\n'
                    'def farewell(name):\n    return f"Goodbye, {name}!"'
                ),
            },
        }]),
        AIMessage(content="Added farewell function to hello.py."),
    ]


# --- Task 5: surgical_edit_modify ---
def surgical_edit_modify_responses():
    return [
        AIMessage(content="", tool_calls=[{
            "id": "c5_1",
            "name": "read_file",
            "args": {"path": "hello.py"},
        }]),
        AIMessage(content="", tool_calls=[{
            "id": "c5_2",
            "name": "edit_file",
            "args": {
                "path": "hello.py",
                "old_text": 'return f"Hello, {name}!"',
                "new_text": 'return f"Hey, {name}!"',
            },
        }]),
        AIMessage(content="Changed greeting from Hello to Hey."),
    ]


# --- Task 6: multi_step_read_edit_verify ---
def multi_step_read_edit_verify_responses():
    return [
        AIMessage(content="", tool_calls=[{
            "id": "c6_1",
            "name": "read_file",
            "args": {"path": "config.json"},
        }]),
        AIMessage(content="", tool_calls=[{
            "id": "c6_2",
            "name": "edit_file",
            "args": {
                "path": "config.json",
                "old_text": '"port": 3000',
                "new_text": '"port": 8080',
            },
        }]),
        AIMessage(content="", tool_calls=[{
            "id": "c6_3",
            "name": "read_file",
            "args": {"path": "config.json"},
        }]),
        AIMessage(content="Changed port from 3000 to 8080. Verified the change."),
    ]


# --- Task 7: error_recovery_missing_file ---
def error_recovery_missing_file_responses():
    return [
        AIMessage(content="", tool_calls=[{
            "id": "c7_1",
            "name": "read_file",
            "args": {"path": "server.py"},
        }]),
        # read_file will return "Error: File not found"
        # Agent recovers by creating the file
        AIMessage(content="", tool_calls=[{
            "id": "c7_2",
            "name": "create_file",
            "args": {
                "path": "server.py",
                "content": (
                    "import logging\n\n"
                    "logging.basicConfig(level=logging.INFO)\n"
                    "logger = logging.getLogger(__name__)\n\n\n"
                    "def start_server():\n"
                    '    logger.info("Server starting")\n'
                ),
            },
        }]),
        AIMessage(content="server.py didn't exist. Created it with logging."),
    ]


# --- Task 8: error_recovery_bad_anchor ---
def error_recovery_bad_anchor_responses():
    return [
        AIMessage(content="", tool_calls=[{
            "id": "c8_1",
            "name": "edit_file",
            "args": {
                "path": "hello.py",
                "old_text": "def greet(name) -> string:",
                "new_text": "def greet(name) -> str:",
            },
        }]),
        # edit_file returns error — anchor doesn't match
        # Agent reads the file to see actual content
        AIMessage(content="", tool_calls=[{
            "id": "c8_2",
            "name": "read_file",
            "args": {"path": "hello.py"},
        }]),
        # Agent retries with correct anchor
        AIMessage(content="", tool_calls=[{
            "id": "c8_3",
            "name": "edit_file",
            "args": {
                "path": "hello.py",
                "old_text": 'def greet(name):\n    return f"Hello, {name}!"',
                "new_text": 'def greet(name: str) -> str:\n    return f"Hello, {name}!"',
            },
        }]),
        AIMessage(content="Added type hints after correcting my anchor."),
    ]


# --- Task 9: context_injection_edit ---
def context_injection_edit_responses():
    return [
        AIMessage(content="", tool_calls=[{
            "id": "c9_1",
            "name": "create_file",
            "args": {
                "path": "handler.py",
                "content": (
                    "from flask import jsonify\n\n\n"
                    "def get_users():\n"
                    '    return jsonify({"users": []})\n'
                ),
            },
        }]),
        AIMessage(content="Created handler.py based on the API spec in context."),
    ]


# --- Task 10: multi_file_creation ---
def multi_file_creation_responses():
    return [
        AIMessage(content="", tool_calls=[{
            "id": "c10_1",
            "name": "create_file",
            "args": {
                "path": "utils.py",
                "content": "def helper():\n    return 42\n",
            },
        }]),
        AIMessage(content="", tool_calls=[{
            "id": "c10_2",
            "name": "create_file",
            "args": {
                "path": "index.py",
                "content": "from utils import helper\n\nresult = helper()\n",
            },
        }]),
        AIMessage(content="Created utils.py and index.py."),
    ]


# --- Task 11: complex_refactor ---
def complex_refactor_responses():
    return [
        AIMessage(content="", tool_calls=[{
            "id": "c11_1",
            "name": "read_file",
            "args": {"path": "calculator.py"},
        }]),
        AIMessage(content="", tool_calls=[{
            "id": "c11_2",
            "name": "create_file",
            "args": {
                "path": "operations.py",
                "content": (
                    "def add(a, b):\n    return a + b\n\n\n"
                    "def subtract(a, b):\n    return a - b\n"
                ),
            },
        }]),
        AIMessage(content="", tool_calls=[{
            "id": "c11_3",
            "name": "edit_file",
            "args": {
                "path": "calculator.py",
                "old_text": (
                    "def add(a, b):\n    return a + b\n\n\n"
                    "def subtract(a, b):\n    return a - b\n\n\n"
                    "def calculate(op, a, b):\n"
                    "    ops = {'add': add, 'subtract': subtract}\n"
                    "    return ops[op](a, b)"
                ),
                "new_text": (
                    "from operations import add, subtract\n\n\n"
                    "def calculate(op, a, b):\n"
                    "    ops = {'add': add, 'subtract': subtract}\n"
                    "    return ops[op](a, b)"
                ),
            },
        }]),
        AIMessage(content="Extracted add/subtract into operations.py."),
    ]


# --- Task 12: multi_agent_decomposition ---
def multi_agent_supervisor_responses():
    """Supervisor LLM responses — returns JSON task plan."""
    plan = (
        '```json\n'
        '[\n'
        '  {"worker": "shared", "description": "Create types.py with User dataclass"},\n'
        '  {"worker": "backend", "description": "Create api.py that imports User from types"}\n'
        ']\n'
        '```'
    )
    return [
        AIMessage(content=plan),
        # Validation call — plan is valid, return same
        AIMessage(content=plan),
    ]


def multi_agent_worker_responses():
    """Worker LLM responses — each worker creates its file."""
    return [
        # Worker 1 (shared): create types.py
        AIMessage(content="", tool_calls=[{
            "id": "w1_1",
            "name": "create_file",
            "args": {
                "path": "types.py",
                "content": (
                    "from dataclasses import dataclass\n\n\n"
                    "@dataclass\nclass User:\n"
                    "    name: str\n    email: str\n"
                ),
            },
        }]),
        AIMessage(content="Created types.py with User dataclass."),
        # Worker 2 (backend): create api.py
        AIMessage(content="", tool_calls=[{
            "id": "w2_1",
            "name": "create_file",
            "args": {
                "path": "api.py",
                "content": (
                    "from types import User\n\n\n"
                    "def get_user(name: str) -> User:\n"
                    '    return User(name=name, email=f"{name}@example.com")\n'
                ),
            },
        }]),
        AIMessage(content="Created api.py using User from types."),
    ]

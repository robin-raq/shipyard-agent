"""The 12 evaluation tasks for the Shipyard agent."""

from shipyard.evals.mock_responses import (
    complex_refactor_responses,
    context_injection_edit_responses,
    create_nested_file_responses,
    create_new_file_responses,
    error_recovery_bad_anchor_responses,
    error_recovery_missing_file_responses,
    multi_agent_supervisor_responses,
    multi_agent_worker_responses,
    multi_file_creation_responses,
    multi_step_read_edit_verify_responses,
    read_and_summarize_responses,
    surgical_edit_add_function_responses,
    surgical_edit_modify_responses,
)
from shipyard.evals.tasks import EvalTask, Expectation, FileSetup

HELLO_PY = 'def greet(name):\n    return f"Hello, {name}!"\n'

CALCULATOR_PY = (
    "def add(a, b):\n    return a + b\n\n\n"
    "def subtract(a, b):\n    return a - b\n\n\n"
    "def calculate(op, a, b):\n"
    "    ops = {'add': add, 'subtract': subtract}\n"
    "    return ops[op](a, b)\n"
)

CONFIG_JSON = '{\n  "port": 3000,\n  "host": "localhost"\n}\n'

API_SPEC_CONTEXT = (
    "API Spec:\n"
    "  GET /users -> returns list of users as JSON\n"
    "  Response: {users: []}\n"
    "  Framework: Flask\n"
)


EVAL_TASKS: list[EvalTask] = [
    # 1. Create new file
    EvalTask(
        name="create_new_file",
        category="create",
        instruction="Create a file called utils.py with a function add(a, b) that returns a + b",
        setup_files=[],
        expectations=[
            Expectation(type="file_exists", path="utils.py"),
            Expectation(type="file_contains", path="utils.py", value="def add(a, b)"),
            Expectation(type="file_contains", path="utils.py", value="return a + b"),
        ],
        mock_responses=create_new_file_responses(),
    ),
    # 2. Create nested file
    EvalTask(
        name="create_nested_file",
        category="create",
        instruction="Create src/helpers/string_utils.py with a capitalize_first function",
        setup_files=[],
        expectations=[
            Expectation(type="file_exists", path="src/helpers/string_utils.py"),
            Expectation(
                type="file_contains",
                path="src/helpers/string_utils.py",
                value="def capitalize_first",
            ),
        ],
        mock_responses=create_nested_file_responses(),
    ),
    # 3. Read and summarize
    EvalTask(
        name="read_and_summarize",
        category="read",
        instruction="Read hello.py and tell me what functions are defined",
        setup_files=[FileSetup(path="hello.py", content=HELLO_PY)],
        expectations=[
            Expectation(type="response_contains", value="greet"),
        ],
        mock_responses=read_and_summarize_responses(),
    ),
    # 4. Surgical edit — add function
    EvalTask(
        name="surgical_edit_add_function",
        category="edit",
        instruction="Add a farewell function to hello.py that returns 'Goodbye, {name}!'",
        setup_files=[FileSetup(path="hello.py", content=HELLO_PY)],
        expectations=[
            Expectation(type="file_contains", path="hello.py", value="def farewell"),
            Expectation(type="file_contains", path="hello.py", value="Goodbye"),
            Expectation(type="file_contains", path="hello.py", value="def greet"),
        ],
        mock_responses=surgical_edit_add_function_responses(),
    ),
    # 5. Surgical edit — modify existing
    EvalTask(
        name="surgical_edit_modify",
        category="edit",
        instruction="Change the greet function in hello.py to say 'Hey' instead of 'Hello'",
        setup_files=[FileSetup(path="hello.py", content=HELLO_PY)],
        expectations=[
            Expectation(type="file_contains", path="hello.py", value="Hey"),
            Expectation(type="file_not_contains", path="hello.py", value='"Hello,'),
        ],
        mock_responses=surgical_edit_modify_responses(),
    ),
    # 6. Multi-step read-edit-verify
    EvalTask(
        name="multi_step_read_edit_verify",
        category="multi-step",
        instruction="Read config.json, change the port from 3000 to 8080, then verify by reading again",
        setup_files=[FileSetup(path="config.json", content=CONFIG_JSON)],
        expectations=[
            Expectation(type="file_contains", path="config.json", value="8080"),
            Expectation(type="file_not_contains", path="config.json", value="3000"),
        ],
        mock_responses=multi_step_read_edit_verify_responses(),
    ),
    # 7. Error recovery — missing file
    EvalTask(
        name="error_recovery_missing_file",
        category="error-recovery",
        instruction="Add logging to server.py",
        setup_files=[],  # No server.py — agent must handle gracefully
        expectations=[
            Expectation(type="file_exists", path="server.py"),
            Expectation(type="file_contains", path="server.py", value="logging"),
        ],
        mock_responses=error_recovery_missing_file_responses(),
    ),
    # 8. Error recovery — bad anchor
    EvalTask(
        name="error_recovery_bad_anchor",
        category="error-recovery",
        instruction="Add type hints to the greet function in hello.py",
        setup_files=[FileSetup(path="hello.py", content=HELLO_PY)],
        expectations=[
            Expectation(type="file_contains", path="hello.py", value="-> str"),
            Expectation(type="file_contains", path="hello.py", value="def greet"),
        ],
        mock_responses=error_recovery_bad_anchor_responses(),
    ),
    # 9. Context injection
    EvalTask(
        name="context_injection_edit",
        category="context",
        instruction="Based on the API spec in context, create a route handler",
        setup_files=[],
        context=API_SPEC_CONTEXT,
        expectations=[
            Expectation(type="file_exists", path="handler.py"),
            Expectation(type="file_contains", path="handler.py", value="users"),
        ],
        mock_responses=context_injection_edit_responses(),
    ),
    # 10. Multi-file creation
    EvalTask(
        name="multi_file_creation",
        category="multi-step",
        instruction=(
            "Create an index.py that imports from utils.py, "
            "and create utils.py with a helper function"
        ),
        setup_files=[],
        expectations=[
            Expectation(type="file_exists", path="utils.py"),
            Expectation(type="file_exists", path="index.py"),
            Expectation(type="file_contains", path="index.py", value="from utils import"),
            Expectation(type="file_contains", path="utils.py", value="def helper"),
        ],
        mock_responses=multi_file_creation_responses(),
    ),
    # 11. Complex refactor
    EvalTask(
        name="complex_refactor",
        category="complex",
        instruction=(
            "Refactor calculator.py: extract add and subtract into operations.py, "
            "then update calculator.py to import from it"
        ),
        setup_files=[FileSetup(path="calculator.py", content=CALCULATOR_PY)],
        expectations=[
            Expectation(type="file_exists", path="operations.py"),
            Expectation(type="file_contains", path="operations.py", value="def add"),
            Expectation(type="file_contains", path="operations.py", value="def subtract"),
            Expectation(
                type="file_contains",
                path="calculator.py",
                value="from operations import",
            ),
            Expectation(
                type="file_not_contains",
                path="calculator.py",
                value="def add(a, b):",
            ),
        ],
        mock_responses=complex_refactor_responses(),
    ),
    # 12. Multi-agent decomposition
    EvalTask(
        name="multi_agent_decomposition",
        category="multi-agent",
        instruction=(
            "Create a shared types.py with a User dataclass, "
            "then create a backend api.py that uses it"
        ),
        setup_files=[],
        expectations=[
            Expectation(type="file_exists", path="types.py"),
            Expectation(type="file_contains", path="types.py", value="class User"),
            Expectation(type="file_exists", path="api.py"),
            Expectation(type="file_contains", path="api.py", value="import"),
        ],
        mock_responses=[],  # Multi-agent uses separate supervisor/worker mocks
        agent_mode="multi",
    ),
]

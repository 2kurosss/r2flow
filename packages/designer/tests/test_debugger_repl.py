"""REPL sandbox: expressions over debug variables, assignment to existing only."""

from __future__ import annotations

import pytest

from r2flow_designer.debugger import DebugError, _eval_repl


def test_expression_reads_variables() -> None:
    assert _eval_repl("a + 1", {"a": 1}) == "2"
    assert _eval_repl("len(items)", {"items": [1, 2, 3]}) == "3"
    assert _eval_repl('row["text"]', {"row": {"text": "hi"}}) == "'hi'"


def test_assign_existing_variable() -> None:
    variables: dict[str, object] = {"items": [1, 2]}
    assert _eval_repl("items = [1, 2, 3]", variables) == "[1, 2, 3]"
    assert variables["items"] == [1, 2, 3]


def test_assign_new_variable_rejected() -> None:
    """Debug scope mirrors the flow: no inventing names the run never has."""
    variables: dict[str, object] = {"a": 1}
    with pytest.raises(DebugError, match="assign only to existing variables"):
        _eval_repl("brand_new = 123", variables)
    assert "brand_new" not in variables


def test_unknown_name_rejected() -> None:
    with pytest.raises(DebugError, match="is not defined"):
        _eval_repl("nope + 1", {"a": 1})


def test_unsafe_syntax_rejected() -> None:
    with pytest.raises(DebugError):
        _eval_repl("__import__('os').system('x')", {})
    with pytest.raises(DebugError):
        _eval_repl("[x for x in range(3)]", {})
    with pytest.raises(DebugError):
        _eval_repl("a.b", {"a": {"b": 1}})

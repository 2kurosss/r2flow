"""LogStreamer must emit lowercase wire values (server LogLevel contract)."""

from __future__ import annotations

import pytest

from r2flow_agent.streamer import _scrub_line, LogStreamer


def test_parse_structured_line_lowercases_level() -> None:
    entry = LogStreamer._parse_line("[INFO] hello", "stdout")
    assert entry["level"] == "info"
    assert entry["message"] == "hello"
    assert entry["source"] == "stdout"
    assert "timestamp" in entry


def test_parse_plain_line_defaults_to_info() -> None:
    entry = LogStreamer._parse_line("plain output", "stderr")
    assert entry["level"] == "info"
    assert entry["message"] == "plain output"


@pytest.mark.parametrize(
    "line",
    [
        "plain output without secrets",
        "[info] ▶ windows.delay {}",
        "Authorization: Bearer abcdef123",
        "token=supersecretvalue",
        "R2FLOW_AGENT_TOKEN=supersecretvalue",
        "password: hunter2",
    ],
)
def test_scrub_line_never_raises(line: str) -> None:
    # Regression: every pattern must be callable on any line — a replacement
    # referencing a missing group used to raise re.PatternError and fail runs.
    _scrub_line(line)


def test_scrub_line_masks_secrets() -> None:
    assert _scrub_line("Authorization: Bearer abcdef123") == "Authorization: Bearer ***"
    assert _scrub_line("R2FLOW_AGENT_TOKEN=abc") == "R2FLOW_AGENT_TOKEN=***"
    assert _scrub_line("nothing secret here") == "nothing secret here"

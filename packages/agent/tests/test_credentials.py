"""Restart UX: saved agent credentials are reused for the same orchestrator+name."""

from __future__ import annotations

from pathlib import Path

import pytest

from r2flow_agent import config as agent_config
from r2flow_agent import main as agent_main


@pytest.fixture()
def isolated_config(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(agent_config, "CONFIG_DIR", tmp_path)
    monkeypatch.setattr(agent_config, "CONFIG_PATH", tmp_path / "config.json")


def test_no_credentials_when_nothing_saved(isolated_config: None) -> None:
    assert agent_main._saved_credentials("https://cloud.example.com", "a") == (None, None)


def test_credentials_roundtrip_with_trailing_slash_variants(isolated_config: None) -> None:
    agent_config.save_config(
        "https://cloud.example.com/",
        "a",
        "http://localhost:8001",
        agent_id="id-1",
        agent_secret="s-1",
    )
    assert agent_main._saved_credentials("https://cloud.example.com", "a") == ("id-1", "s-1")
    assert agent_main._saved_credentials("https://cloud.example.com/", "a") == ("id-1", "s-1")


def test_credentials_ignored_for_other_orchestrator_or_name(isolated_config: None) -> None:
    agent_config.save_config(
        "https://cloud.example.com",
        "a",
        "http://localhost:8001",
        agent_id="id-1",
        agent_secret="s-1",
    )
    assert agent_main._saved_credentials("https://other.example.com", "a") == (None, None)
    assert agent_main._saved_credentials("https://cloud.example.com", "b") == (None, None)

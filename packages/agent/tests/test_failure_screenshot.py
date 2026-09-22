"""Failure screenshot must never wedge the agent event loop.

Regression: ``_attach_failure_screenshot`` used to call the synchronous
``capture_screenshot()`` inline, so a hung screen grab (locked session,
display off) silently stopped heartbeats and command polling.
"""

from __future__ import annotations

import asyncio
import threading
import time
from typing import Any

import r2flow_agent.main as main
import r2flow_agent.screenshot as shot


class _FakeClient:
    def __init__(self) -> None:
        self.artifacts: list[tuple[str, str, str, bytes]] = []

    async def push_artifact(
        self, run_id: str, filename: str, content_type: str, data: bytes
    ) -> None:
        self.artifacts.append((run_id, filename, content_type, data))


async def test_hanging_capture_does_not_block_loop(monkeypatch: Any, caplog: Any) -> None:
    """A capture that hangs must time out while the loop keeps ticking."""
    monkeypatch.setattr(main, "_SCREENSHOT_TIMEOUT_SECONDS", 0.2)

    def hanging_capture() -> Any:
        time.sleep(5)  # far beyond the 0.2s timeout; must not wedge the loop
        return None

    monkeypatch.setattr(shot, "capture_screenshot", hanging_capture)
    ticks = 0

    async def ticker() -> None:
        nonlocal ticks
        for _ in range(5):
            await asyncio.sleep(0.05)
            ticks += 1

    client = _FakeClient()
    with caplog.at_level("WARNING", logger="r2flow_agent"):
        await asyncio.gather(main._attach_failure_screenshot(client, "run-1"), ticker())
    assert ticks == 5  # loop stayed responsive throughout
    assert client.artifacts == []  # nothing to upload on timeout
    assert "timed out" in caplog.text


async def test_capture_runs_off_the_event_loop(monkeypatch: Any) -> None:
    """Happy path still uploads, and capture runs in a worker thread."""
    loop_thread = threading.get_ident()
    seen: dict[str, int] = {}

    def fast_capture() -> tuple[bytes, str]:
        seen["thread"] = threading.get_ident()
        return b"\x89PNGdata", "failure-20260101-000000.png"

    monkeypatch.setattr(shot, "capture_screenshot", fast_capture)
    client = _FakeClient()
    await main._attach_failure_screenshot(client, "run-2")
    assert seen["thread"] != loop_thread
    assert client.artifacts == [
        ("run-2", "failure-20260101-000000.png", "image/png", b"\x89PNGdata")
    ]


async def test_opt_out_skips_capture(monkeypatch: Any) -> None:
    """R2FLOW_SCREENSHOT_ON_FAILURE=0 must not touch the screen at all."""
    monkeypatch.setenv("R2FLOW_SCREENSHOT_ON_FAILURE", "0")
    called = False

    def boom() -> Any:
        nonlocal called
        called = True
        return None

    monkeypatch.setattr(shot, "capture_screenshot", boom)
    await main._attach_failure_screenshot(_FakeClient(), "run-3")
    assert called is False

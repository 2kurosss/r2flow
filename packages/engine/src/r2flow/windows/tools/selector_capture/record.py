"""Programmatic series recorder — record clicks and typed text to nodes.

The blocking companion to the CLI ``series`` mode, driven by a
``threading.Event`` instead of the global Ctrl+Shift+F2 hotkey so a server
(see ``r2flow-designer``) can start/stop it over HTTP.

Every mouse click captures the element under the cursor and emits a
``windows.click`` node. Printable keys are buffered and flushed — when the
next click arrives or recording stops — into a ``windows.input_text`` node
targeting the element that had focus when typing started. Unlike the CLI
series mode, the **typed text is preserved**.

    import threading
    from r2flow.windows.tools.selector_capture import record_series

    stop = threading.Event()
    nodes = record_series(stop)          # click around, type, then:
    stop.set()
"""

from __future__ import annotations

import logging
import queue
import threading
from collections.abc import Callable
from typing import cast

from r2flow.windows.tools.selector_capture.capture import (
    BestSelector,
    PathNode,
    capture_at_point,
)
from r2flow.windows.tools.selector_capture.generate import (
    FlowNode,
    GenerateParams,
    ToolType,
)
from r2flow.windows.tools.selector_capture.recorder import (
    SeriesEvent,
    _ListenerGroup,
    _mouse_listener,
    _nodes_for_capture,
    _require_pynput,
    _series_listener,
)

logger = logging.getLogger(__name__)


def _reduce_events(
    events: queue.Queue[SeriesEvent],
    stop: threading.Event,
    *,
    capture_point: Callable[[float, float], tuple[list[PathNode], BestSelector]],
    mouse_position: Callable[[], tuple[float, float]],
    emit: Callable[[FlowNode], None],
    timeout: float = 0.1,
    clock: Callable[[], float] | None = None,
    min_delay_gap: float = 1.0,
    max_delay_ms: int = 10000,
) -> None:
    """Drain recorder *events* into flow nodes until *stop* or a stop event.

    Split out from :func:`record_series` so the event handling (click →
    ``windows.click``, buffered text → ``windows.input_text``, special
    keys → ``windows.keyboard``) is testable without pynput or a real
    desktop.
    """
    import time as _time

    _clock = clock or _time.monotonic
    text: list[str] = []
    last_selector: BestSelector | None = None
    last_path: list[PathNode] | None = None
    last_emit_at: float | None = None

    def _event_time(event: SeriesEvent) -> float:
        ts = getattr(event, "timestamp", None)
        if isinstance(ts, (int, float)):
            return float(ts)
        return _clock()

    def _emit_with_pacing(node: FlowNode, at: float) -> None:
        nonlocal last_emit_at
        if last_emit_at is not None and min_delay_gap > 0:
            gap = at - last_emit_at
            if gap >= min_delay_gap:
                delay_ms = min(int(gap * 1000), max_delay_ms)
                if delay_ms > 0:
                    emit(FlowNode(tool="windows.delay", args={"duration_ms": delay_ms}))
        emit(node)
        last_emit_at = at

    def flush_text(at: float | None = None) -> None:
        nonlocal text
        if not text:
            return
        value = "".join(text)
        text = []
        if not value:
            return
        stamp = at if at is not None else _clock()
        if last_selector is None:
            # Typed into the already-focused window without a prior click:
            # keep the text (InputTextTool types into focus when no
            # selector is given) instead of silently dropping it.
            _emit_with_pacing(FlowNode(tool="windows.input_text", args={"text": value}), stamp)
            return
        for node in _nodes_for_capture(
            last_selector, last_path, ToolType.INPUT_TEXT, GenerateParams(text=value), None
        ):
            _emit_with_pacing(node, stamp)

    while not stop.is_set():
        try:
            event = events.get(timeout=timeout)
        except queue.Empty:
            continue
        if event.kind == "stop":
            break
        if event.kind == "mouse_down":
            now = _event_time(event)
            flush_text(now)
            button = getattr(event, "button", None) or "left"
            if button not in ("left", "right"):
                button = "left"
            ex = getattr(event, "x", None)
            ey = getattr(event, "y", None)
            try:
                if isinstance(ex, (int, float)) and isinstance(ey, (int, float)):
                    x, y = float(ex), float(ey)
                else:
                    x, y = mouse_position()
                path, selector = capture_point(float(x), float(y))
            except Exception:
                logger.exception("Could not capture element at mouse position")
                continue
            last_selector = selector
            last_path = path
            params = GenerateParams(button=button) if button != "left" else GenerateParams()
            for node in _nodes_for_capture(selector, path, ToolType.CLICK, params, None):
                _emit_with_pacing(node, now)
        elif event.kind == "input":
            char = event.char or ""
            if char == "\b":
                if text:
                    text.pop()
            elif char:
                text.append(char)
        elif event.kind == "key":
            now = _event_time(event)
            flush_text(now)
            keys = getattr(event, "key", None) or ""
            if keys:
                _emit_with_pacing(FlowNode(tool="windows.keyboard", args={"keys": keys}), now)
    flush_text()


def record_series(
    stop: threading.Event,
    *,
    on_step: Callable[[FlowNode], None] | None = None,
) -> list[FlowNode]:
    """Record clicks and typed text until *stop* is set.

    Args:
        stop: Set from another thread to end the recording.
        on_step: Optional callback invoked for each generated node as it is
            recorded (used for live progress in a UI).

    Returns:
        The recorded nodes, in order.

    Raises:
        ImportError: ``pynput`` is not installed (``r2flow[capture]``).
    """
    _require_pynput()

    events: queue.Queue[SeriesEvent] = queue.Queue()
    nodes: list[FlowNode] = []

    def emit(node: FlowNode) -> None:
        nodes.append(node)
        if on_step is not None:
            try:
                on_step(node)
            except Exception:
                logger.exception("record on_step callback failed")

    def capture_point(x: float, y: float) -> tuple[list[PathNode], BestSelector]:
        from r2flow.core.blocking import _run_with_com

        result = _run_with_com(capture_at_point, x, y)
        return cast("tuple[list[PathNode], BestSelector]", result)

    def mouse_position() -> tuple[float, float]:
        from pynput.mouse import Controller as MouseCtrl

        x, y = MouseCtrl().position
        return float(x), float(y)

    with _ListenerGroup([_series_listener(events), _mouse_listener(events)]):
        _reduce_events(
            events,
            stop,
            capture_point=capture_point,
            mouse_position=mouse_position,
            emit=emit,
        )
    return nodes

"""Default Windows toolset factory."""

from __future__ import annotations

from collections.abc import Iterable
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from r2flow.core.tool import Tool

__all__ = ["windows_tools"]


def windows_tools(
    *,
    allowed_commands: Iterable[str] | None = None,
) -> list[Tool]:
    """Build the default Windows tool set for :class:`R2Flow`.

    Imports are function-local so that importing this package stays cheap
    and never pulls UIA dependencies at module import time::

        from r2flow.windows.tools import windows_tools

        bot = R2Flow(tools=windows_tools())

    Args:
        allowed_commands: Forwarded to :class:`ProcessTool` — executables
            the bot may start. ``None`` means the built-in demo list (or
            the ``R2FLOW_ALLOWED_COMMANDS`` env override when set).
    """
    from r2flow.core.asset_tools import AssetCredentialTool, AssetGetTool
    from r2flow.core.excel import ExcelAppendTool, ExcelReadTool, ExcelWriteTool
    from r2flow.core.files import FileTool
    from r2flow.windows.tools.click import ClickTool
    from r2flow.windows.tools.clipboard import ClipboardTool
    from r2flow.windows.tools.control_action import ControlActionTool
    from r2flow.windows.tools.delay import DelayTool
    from r2flow.windows.tools.drag import DragTool
    from r2flow.windows.tools.exists import ExistsTool
    from r2flow.windows.tools.get_element import GetElementTool
    from r2flow.windows.tools.get_table import GetTableTool
    from r2flow.windows.tools.get_text import GetTextTool
    from r2flow.windows.tools.highlight import HighlightTool
    from r2flow.windows.tools.hover import HoverTool
    from r2flow.windows.tools.image import ClickImageTool, FindImageTool
    from r2flow.windows.tools.input_text import InputTextTool
    from r2flow.windows.tools.keyboard import KeyboardTool
    from r2flow.windows.tools.list_elements import ListElementsTool
    from r2flow.windows.tools.ocr import OcrTool
    from r2flow.windows.tools.process import ProcessTool
    from r2flow.windows.tools.screenshot import ScreenshotTool
    from r2flow.windows.tools.scroll import ScrollTool
    from r2flow.windows.tools.select import SelectTool
    from r2flow.windows.tools.set_text import SetTextTool
    from r2flow.windows.tools.wait import WaitTool
    from r2flow.windows.tools.window import WindowTool

    return [
        ProcessTool(allowed_commands=allowed_commands),
        ClickTool(),
        WaitTool(),
        DelayTool(),
        ScreenshotTool(),
        InputTextTool(),
        KeyboardTool(),
        SetTextTool(),
        GetElementTool(),
        ScrollTool(),
        HoverTool(),
        ExistsTool(),
        GetTextTool(),
        WindowTool(),
        SelectTool(),
        DragTool(),
        ClipboardTool(),
        ListElementsTool(),
        HighlightTool(),
        GetTableTool(),
        ControlActionTool(),
        FindImageTool(),
        ClickImageTool(),
        OcrTool(),
        FileTool(),
        ExcelReadTool(),
        ExcelWriteTool(),
        ExcelAppendTool(),
        AssetGetTool(),
        AssetCredentialTool(),
    ]

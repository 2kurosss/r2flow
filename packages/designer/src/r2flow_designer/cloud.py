"""Persistent orchestrator connection for the designer.

The designer talks to a (possibly remote) r2flow-cloud orchestrator for
publishing. Remembering the URL + API token in a user-level config file
(``~/.r2flow/cloud.json``, owner-only permissions) means "connect once,
work": the header badge shows live status and Publish defaults to the
saved connection instead of asking for credentials every time.
"""

from __future__ import annotations

import contextlib
import json
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from urllib.request import Request, urlopen


def config_path() -> Path:
    """User-level cloud connection file (override via ``R2FLOW_HOME``)."""
    home = os.environ.get("R2FLOW_HOME")
    base = Path(home) if home else Path.home() / ".r2flow"
    return base / "cloud.json"


@dataclass
class CloudConnection:
    url: str
    token: str


def load_connection(path: Path | None = None) -> CloudConnection | None:
    """Read the saved connection; ``None`` when absent or malformed."""
    target = path or config_path()
    try:
        raw: Any = json.loads(target.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, UnicodeDecodeError):
        return None
    if not isinstance(raw, dict):
        return None
    url = raw.get("url")
    token = raw.get("token")
    if not isinstance(url, str) or not url.strip():
        return None
    if not isinstance(token, str) or not token.strip():
        return None
    return CloudConnection(url=url.strip().rstrip("/"), token=token.strip())


def save_connection(url: str, token: str, path: Path | None = None) -> Path:
    """Persist the connection atomically with owner-only permissions."""
    target = path or config_path()
    target.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps({"url": url.strip().rstrip("/"), "token": token.strip()}, indent=2) + "\n"
    fd, tmp_name = tempfile.mkstemp(dir=str(target.parent), prefix=".cloud-", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(text)
        with contextlib.suppress(OSError):
            os.chmod(tmp_name, 0o600)
        Path(tmp_name).replace(target)
        with contextlib.suppress(OSError):
            os.chmod(target, 0o600)
    finally:
        with contextlib.suppress(OSError):
            Path(tmp_name).unlink()
    return target


def clear_connection(path: Path | None = None) -> bool:
    """Forget the saved connection; ``True`` when something was removed."""
    target = path or config_path()
    try:
        target.unlink()
        return True
    except OSError:
        return False


def check_url(raw: str) -> str:
    """Normalize a base URL; reject non-http(s) and bare hostnames."""
    url = (raw or "").strip().rstrip("/")
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ValueError("url must be an http(s) URL, e.g. https://cloud.r2flow.ru")
    return url


def verify_connection(url: str, token: str, timeout: float = 10.0) -> dict[str, Any]:
    """Prove the credentials against the orchestrator; return the ``/me`` payload.

    Raises:
        ValueError: When the orchestrator rejects the token or is unreachable.
    """
    req = Request(
        f"{url.rstrip('/')}/api/auth/me",
        headers={"Authorization": f"Bearer {token.strip()}"},
        method="GET",
    )
    try:
        with urlopen(req, timeout=timeout) as resp:
            payload: Any = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        raise ValueError(f"orchestrator rejected the connection: {exc}") from exc
    if not isinstance(payload, dict):
        raise ValueError("orchestrator returned an unexpected /me payload")
    return payload

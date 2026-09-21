"""Self-heal: 401 (rotated secret) or 404 (deleted agent row) re-registers."""

from __future__ import annotations

import time

import httpx
import pytest

from r2flow_agent.client import OrchestratorClient, OrchestratorError


def _client(handler: object, join_token: str | None = "join") -> OrchestratorClient:
    client = OrchestratorClient(
        "http://orch",
        "agent",
        "http://agent",
        join_token=join_token,
        agent_id="old-id",
        agent_secret="old-secret",
    )
    client._http = httpx.AsyncClient(
        transport=httpx.MockTransport(handler),
        base_url="http://orch",  # type: ignore[arg-type]
    )
    return client


@pytest.mark.parametrize("status", [401, 404])
async def test_poll_re_registers_on_gone_agent(status: int) -> None:
    calls: list[str] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        calls.append(f"{request.method} {request.url.path}")
        if request.url.path == "/api/agents" and request.method == "POST":
            return httpx.Response(200, json={"id": "new-id", "secret": "new-secret"})
        if request.url.path == "/api/agents/old-id/poll":
            return httpx.Response(status, text="gone")
        return httpx.Response(200, json=[])

    client = _client(handler)
    assert await client.poll() == []
    assert client.agent_id == "new-id"
    assert "POST /api/agents" in calls


@pytest.mark.parametrize("status", [401, 404])
async def test_heartbeat_re_registers_on_gone_agent(status: int) -> None:
    calls: list[str] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        calls.append(f"{request.method} {request.url.path}")
        if request.url.path == "/api/agents" and request.method == "POST":
            return httpx.Response(200, json={"id": "new-id", "secret": "new-secret"})
        return httpx.Response(status, text="gone")

    client = _client(handler)
    await client.heartbeat()
    assert client.agent_id == "new-id"
    assert "POST /api/agents" in calls


async def test_poll_404_without_join_token_raises() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/agents":
            raise AssertionError("must not re-register without a join token")
        return httpx.Response(404, text="gone")

    client = _client(handler, join_token=None)
    with pytest.raises(OrchestratorError):
        await client.poll()


async def test_first_reauth_allowed_right_after_boot(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """time.monotonic() counts from boot: a fresh machine has tiny values.

    The "last attempt" sentinel must not collide with them, or the first
    re-registration after a reboot is refused as "attempted recently".
    """
    monkeypatch.setattr(time, "monotonic", lambda: 5.0)

    async def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/agents" and request.method == "POST":
            return httpx.Response(200, json={"id": "new-id", "secret": "new-secret"})
        if request.url.path == "/api/agents/old-id/poll":
            return httpx.Response(404, text="gone")
        return httpx.Response(200, json=[])

    client = _client(handler)
    assert await client.poll() == []
    assert client.agent_id == "new-id"
